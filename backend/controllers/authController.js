const crypto      = require("crypto");
const jwt         = require("jsonwebtoken");
const authService = require("../services/authService");
const accountDeletion = require("../services/accountDeletionService");
const { invalidateOrgCache } = require("../middlewares/auth");
const SignupOtp   = require("../models/SignupOtp");
const User        = require("../models/User");
const AuditLog    = require("../models/AuditLog");
const Organization = require("../models/Organization");
const logger      = require("../config/logger");
const { AppError } = require("../middlewares/errorHandler");
const { checkRecaptcha } = require("../utils/recaptcha");
const { isDisposableEmail } = require("../utils/emailDomains");
const { sendSignupPendingEmail, notifySuperAdminsOfSignup, sendSignupVerifyEmail,
        sendAccountDeletionRequestEmails } = require("../utils/email");

// Signup email-verification code lifetime. The email quotes this same
// constant, so the promised window and the real one cannot drift apart.
const OTP_TTL_MS = 15 * 60 * 1000;
const SIGNUP_SITE = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

/** Issues the short-lived proof-of-email-ownership the signup form submits. */
function issueSignupToken(email) {
  return jwt.sign({ email, type: "signup_verify" }, process.env.JWT_SECRET, { expiresIn: "30m" });
}

function _auditLog(req, action, extras = {}) {
  AuditLog.create({
    requestId:      req.requestId,
    action,
    performedBy:    req.user?._id,
    performedByName: req.user?.name,
    targetOrg:      req.user?.orgId,
    ip:             req.ip,
    userAgent:      req.headers["user-agent"],
    ...extras,
  }).catch(() => {}); // non-blocking — never fail the main request
}

// Normalise phone to bare 10-digit string
function normPhone(raw) {
  return String(raw).replace(/\D/g, "").replace(/^91(\d{10})$/, "$1").replace(/^0(\d{10})$/, "$1").slice(-10);
}

// Shared cookie options - httpOnly prevents JS access (XSS protection)
// sameSite: "none" + secure: true allows the cookie to be sent on all
// cross-site XHR requests (www.arthaleads.com → api.arthaleads.com).
// Mobile browsers (Android Chrome, iOS Safari) are stricter than desktop
// and require SameSite=None for reliable cross-subdomain cookie delivery.
const cookieOptions = () => ({
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  domain:   process.env.NODE_ENV === "production" ? ".arthaleads.com" : undefined,
  maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days in ms
});

// Helper: set auth cookie + respond
function sendAuthResponse(res, statusCode, data) {
  res.cookie("crm_token", data.token, cookieOptions());
  res.status(statusCode).json({ success: true, ...data });
}

const authController = {
  // Step 3 of 3: create the account. Requires the signupToken minted by
  // signupVerifyOtp, so an account can only ever be created on an address
  // someone proved they can read.
  async signup(req, res, next) {
    try {
      // Bot check. A positive bot verdict blocks; an outage never does — see
      // utils/recaptcha.js. Account creation additionally requires signupToken
      // below, so a reCAPTCHA outage does not leave this endpoint open.
      const verdict = await checkRecaptcha(req.body.recaptchaToken, "signup");
      if (verdict === "bot") {
        logger.warn(`[signup] blocked by reCAPTCHA - ip: ${req.ip}`);
        return next(new AppError("Could not verify this request. Please try again.", 400));
      }
      if (verdict === "unavailable") {
        logger.error("[signup] reCAPTCHA unavailable - allowing request, check RECAPTCHA_SECRET_KEY and outbound access to google.com");
      } else if (verdict === "missing") {
        logger.warn(`[signup] no reCAPTCHA token - allowing request, ip: ${req.ip}. If this is every signup, the widget is not loading (check the site CSP allows www.google.com).`);
      }

      const { signupToken, ...rest } = req.body;

      // This check is the whole point of the OTP step. Before, the token was
      // issued and then never looked at again — and the Joi schema's
      // stripUnknown quietly dropped it from the body anyway — so signup was
      // wide open to anyone POSTing straight at the endpoint.
      if (!signupToken) {
        return next(new AppError("Please verify your email address before creating an account.", 400));
      }
      let payload;
      try {
        payload = jwt.verify(signupToken, process.env.JWT_SECRET);
      } catch {
        return next(new AppError("Your email verification expired. Please verify again.", 400));
      }
      if (payload.type !== "signup_verify") {
        return next(new AppError("Invalid verification token.", 400));
      }
      // The verified address must be the one being registered — otherwise a
      // token earned for an address you control could be used to open an
      // account under someone else's.
      const claimed = String(rest.email || "").toLowerCase().trim();
      if (String(payload.email || "").toLowerCase() !== claimed) {
        return next(new AppError("Verification doesn't match this email address.", 400));
      }

      const { user, org } = await authService.signup(rest, {
        ip:        req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Fire-and-forget: confirm to the applicant, and ping the super admins
      // so a pending request doesn't sit unnoticed in the queue.
      sendSignupPendingEmail(user.email, user.name, org.name)
        .catch((e) => console.error("[signup] applicant email failed:", e.message));
      notifySuperAdminsOfSignup({ name: user.name, email: user.email, phone: user.phone, orgName: org.name })
        .catch((e) => console.error("[signup] super-admin notify failed:", e.message));

      // Deliberately NO auth cookie — the org is pending review and must not
      // get a session until a super admin approves it.
      res.status(201).json({
        success: true,
        pending: true,
        message: "Thanks! Your trial request is under review. We'll email you as soon as it's activated.",
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      // Deliberately no reCAPTCHA on login.
      //
      // The Flutter app cannot mint a v3 token (it is a browser-only widget),
      // so enforcing here would either lock out every mobile agent or require
      // a shared bypass secret shipped inside the APK — which anyone can
      // decompile, and which therefore protects nothing while looking like it
      // does. Brute force is instead handled where it actually can be:
      // authService.login locks an account for 15 minutes after 5 failed
      // attempts and logs every failure, and authLimiter caps attempts per IP.
      //
      // The abuse-prone endpoints — signup and both OTP senders — do enforce
      // it, because those cost money to serve and are reachable from a
      // browser that can produce a token.
      const ip   = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const data = await authService.login(req.body.email, req.body.password, ip);
      sendAuthResponse(res, 200, data);
    } catch (err) {
      next(err);
    }
  },

  async adminLogin(req, res, next) {
    try {
      const ip   = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const { email, password } = req.body;
      if (!email || !password) return next(new AppError("Email and password are required", 400));
      const data = await authService.adminLogin(email, password, ip);
      sendAuthResponse(res, 200, data);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/auth/google/signup-profile
  //
  // Google sign-UP used to call googleAuth, which creates the org and the user
  // on the spot and names the workspace "<Their Name>'s Workspace". The person
  // was never asked for their company name, their phone, or a password — they
  // went straight from the Google popup to "awaiting approval", and the admin
  // panel filled up with orgs called "Someone's Workspace".
  //
  // This returns the verified profile and creates nothing, so the normal signup
  // form can be prefilled and completed. The signupToken it mints is the same
  // shape the OTP step issues: Google having verified the address is the same
  // proof of ownership that receiving a code proves, so the rest of signup is
  // unchanged and still checks the token matches the address submitted.
  async googleSignupProfile(req, res, next) {
    try {
      const { credential } = req.body || {};
      if (!credential) return next(new AppError("Google credential is required", 400));

      const { email, name, picture } = await authService.googleProfile(credential);

      // Already registered — send them down the sign-in path instead of
      // walking them through a signup that would fail on a duplicate email.
      const existing = await User.findOne({ email }).select("_id").lean();
      if (existing) return res.json({ success: true, existing: true, email });

      const signupToken = jwt.sign(
        { email: String(email).toLowerCase().trim(), type: "signup_verify" },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      res.json({
        success: true,
        existing: false,
        email,
        name: name || "",
        picture: picture || "",
        signupToken,
      });
    } catch (err) { next(err); }
  },

  async googleAuth(req, res, next) {
    try {
      const { credential } = req.body;
      if (!credential) return next(new AppError("Google credential is required", 400));
      const data = await authService.googleAuth(credential);
      sendAuthResponse(res, 200, data);
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res) {
    const isProd = process.env.NODE_ENV === "production";
    // Clear cookie matching exactly how it was SET (domain + sameSite must match)
    res.clearCookie("crm_token", {
      httpOnly: true,
      secure:   isProd,
      sameSite: isProd ? "none" : "lax",
      domain:   isProd ? ".arthaleads.com" : undefined,
      expires:  new Date(0),
    });
    // Safety net: also clear without domain in case browser stored it on the exact host
    res.clearCookie("crm_token", {
      httpOnly: true,
      secure:   isProd,
      sameSite: isProd ? "none" : "lax",
      expires:  new Date(0),
    });
    res.json({ success: true, message: "Logged out" });
  },

  // POST /api/auth/restore-admin-session — re-set the super admin's own cookie
  // after they exit an impersonated org session, so they land back in the
  // admin panel instead of having to log in again. Public route (the current
  // cookie belongs to the impersonated org admin, not the super admin) - the
  // security boundary is verifying the token itself, not who's currently
  // logged in.
  async restoreAdminSession(req, res, next) {
    try {
      const { token } = req.body;
      if (!token) return next(new AppError("Token is required", 400));

      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return next(new AppError("Your session has expired — please log in again", 401));
      }

      const user = await User.findById(payload.id).select("role isActive");
      if (!user || user.role !== "super_admin" || !user.isActive) {
        return next(new AppError("Invalid session", 401));
      }

      res.cookie("crm_token", token, cookieOptions());
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async getMe(req, res, next) {
    try {
      const { user, org } = await authService.getMe(req.user._id);
      res.json({ success: true, user, org });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const user = await authService.updateProfile(req.user._id, req.body, req.user);
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  },

  async getAgents(req, res, next) {
    try {
      const agents = await authService.getAllAgents(req.orgId);
      res.json({ success: true, agents });
    } catch (err) {
      next(err);
    }
  },

  async getAllUsers(req, res, next) {
    try {
      const users = await authService.getAllUsers(req.orgId);
      res.json({ success: true, users });
    } catch (err) {
      next(err);
    }
  },

  async createUser(req, res, next) {
    try {
      const user = await authService.createUser(req.body, req.orgId, req.user?.name);
      _auditLog(req, "user_created", { targetUser: user._id, targetUserName: user.name });
      res.status(201).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req, res, next) {
    try {
      const user = await authService.updateUser(req.params.id, req.body, req.user._id, req.user.orgId);
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  },

  async toggleUserActive(req, res, next) {
    try {
      const user = await authService.toggleUserActive(req.params.id, req.user._id, req.user.orgId);
      const action = user.isActive ? "user_reactivated" : "user_deactivated";
      _auditLog(req, action, { targetUser: user._id, targetUserName: user.name });
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      await authService.deleteUser(req.params.id, req.user._id, req.user.orgId);
      _auditLog(req, "user_deactivated", { targetUser: req.params.id, details: { permanently: true } });
      res.json({ success: true, message: "User removed successfully" });
    } catch (err) {
      next(err);
    }
  },

  async getPerformance(req, res, next) {
    try {
      const { dateFrom, dateTo } = req.query;
      const performance = await authService.getPerformance(req.user, { dateFrom, dateTo });
      res.json({ success: true, performance });
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) return next(new AppError("Email is required", 400));
      await authService.forgotPassword(email);
      res.json({ success: true, message: "If that email exists, a reset link has been sent." });
    } catch (err) {
      next(err);
    }
  },

  // ── Signup email verification ─────────────────────────────────────────────
  // Step 1 of 3: prove the person controls the address they signed up with.
  // (This step previously claimed to verify a PHONE number but mailed the code
  // to the typed email — so it never proved anything about the phone. Phone
  // verification is deliberately out of scope for now; the approval queue is
  // what actually screens signups.)
  async signupSendOtp(req, res, next) {
    try {
      const { email, recaptchaToken, handoffHash } = req.body;
      const ok = (await checkRecaptcha(recaptchaToken, "signup_send_otp")) !== "bot";
      if (!ok) return next(new AppError("Verification failed. Please refresh and try again.", 400));
      if (!email) return next(new AppError("Email is required", 400));

      const normEmail = String(email).toLowerCase().trim();
      // Same shape check the signup schema enforces, applied up front so a
      // typo'd address fails here rather than after an OTP is burnt on it.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail)) {
        return next(new AppError("Enter a valid email address", 400));
      }
      if (isDisposableEmail(normEmail)) {
        return next(new AppError(
          "Temporary/disposable email addresses aren't accepted. Please sign up with your regular work or personal email.",
          400
        ));
      }

      // Reject if the address already has an account
      const taken = await User.findOne({ email: normEmail });
      if (taken) return next(new AppError("This email is already registered. Please log in instead.", 409));

      // Cap resends per address so this can't be used to mail-bomb someone.
      // The record is TTL'd at expiresAt, so the window resets naturally.
      const existing = await SignupOtp.findOne({ email: normEmail });
      if (existing && existing.sendCount >= 5) {
        return next(new AppError("Too many codes requested for this email. Please wait a few minutes and try again.", 429));
      }

      const otp     = String(crypto.randomInt(100000, 999999));
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
      // The link half. 32 bytes so it cannot be guessed the way a 6-digit code
      // can — the code survives only because it is rate limited and capped at
      // five attempts, and neither of those applies to a URL.
      const linkToken     = crypto.randomBytes(32).toString("hex");
      const linkTokenHash = crypto.createHash("sha256").update(linkToken).digest("hex");
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);

      // Upsert: one live code per address. Resending replaces the previous code
      // and resets the guess counter, but keeps counting sends.
      // (Computed rather than $inc'd because $inc and $setOnInsert on the same
      // path is a Mongo update conflict. sendCount is a soft anti-mail-bomb
      // cap, not a security boundary, so a racy double-send is acceptable —
      // the auth rate limiter is the hard backstop.)
      await SignupOtp.findOneAndUpdate(
        { email: normEmail },
        {
          email: normEmail, otpHash, linkTokenHash, expiresAt, attempts: 0,
          verified: false,
          handoffHash: String(handoffHash || ""),
          ip: req.ip || "",
          sendCount: existing ? existing.sendCount + 1 : 1,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const verifyUrl = `${SIGNUP_SITE}/verify-email?t=${linkToken}`;
      await sendSignupVerifyEmail(normEmail, verifyUrl, otp, OTP_TTL_MS / 60000);

      // Return masked email so frontend can show "OTP sent to ab***@gmail.com"
      const atIdx  = normEmail.lastIndexOf("@");
      const local  = normEmail.slice(0, atIdx);
      const domain = normEmail.slice(atIdx + 1);
      const masked = local.length <= 2 ? `${local[0]}***@${domain}` : `${local[0]}${local[1]}***@${domain}`;
      res.json({ success: true, maskedEmail: masked });
    } catch (err) {
      next(new AppError(err.message || "Failed to send OTP", 500));
    }
  },

  // Step 2 of 3: exchange a correct code for a short-lived signup token.
  // That token is what proves the email was verified — signup() below refuses
  // to create an account without a valid one.
  async signupVerifyOtp(req, res, next) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return next(new AppError("Email and OTP are required", 400));
      if (String(otp).length !== 6) return next(new AppError("OTP must be 6 digits", 400));

      const normEmail = String(email).toLowerCase().trim();
      const record    = await SignupOtp.findOne({ email: normEmail });

      if (!record)                                          return next(new AppError("Code not found. Please request a new one.", 400));
      if (Date.now() > new Date(record.expiresAt).getTime()) return next(new AppError("Code has expired. Please request a new one.", 400));

      const hash = crypto.createHash("sha256").update(String(otp)).digest("hex");
      if (hash !== record.otpHash) {
        // Count this failure. A 6-digit OTP is only 1,000,000 combinations, so the
        // IP rate limiter alone is bypassable with rotating proxies. Cap guesses per
        // OTP to 5 — after that the record is destroyed and a new OTP is required.
        const updated = await SignupOtp.findOneAndUpdate(
          { email: normEmail },
          { $inc: { attempts: 1 } },
          { new: true }
        );
        if (updated && updated.attempts >= 5) {
          await SignupOtp.deleteOne({ email: normEmail });
          return next(new AppError("Too many incorrect attempts. Please request a new code.", 429));
        }
        return next(new AppError("Invalid code. Please check and try again.", 400));
      }

      const signupToken = issueSignupToken(normEmail);

      // Delete the used OTP record
      await SignupOtp.deleteOne({ email: normEmail });

      res.json({ success: true, signupToken });
    } catch (err) {
      next(new AppError(err.message || "OTP verification failed", 500));
    }
  },

  // Confirms the emailed verification link.
  //
  // POST, deliberately, and the GET at /verify-email is only the page: mail
  // security suites (Defender Safe Links, Proofpoint, Mimecast) fetch every
  // URL in a message before the recipient sees it. If a GET consumed the
  // token, the scanner would burn it and the human would land on "already
  // used" -- which, for corporate signups, means every time. Scanners issue
  // GETs and do not run JavaScript, so the page POSTs on mount instead.
  async signupConfirmLink(req, res, next) {
    try {
      const { token } = req.body;
      if (!token) return next(new AppError("Verification token is required", 400));

      const hash   = crypto.createHash("sha256").update(String(token)).digest("hex");
      const record = await SignupOtp.findOne({ linkTokenHash: hash });

      if (!record) return next(new AppError("This link is no longer valid. Please request a new one.", 400));
      if (Date.now() > new Date(record.expiresAt).getTime()) {
        return next(new AppError("This link has expired. Please request a new one.", 400));
      }

      // Single use: clearing the hash means a forwarded copy of the mail, or a
      // second click, cannot mint another token. The record itself survives so
      // the tab that started the signup can still collect the result.
      await SignupOtp.updateOne({ _id: record._id }, { verified: true, linkTokenHash: "" });

      res.json({ success: true, email: record.email, signupToken: issueSignupToken(record.email) });
    } catch (err) {
      next(new AppError(err.message || "Could not verify this link", 500));
    }
  },

  // Polled by the tab that started the signup, so opening the link on a phone
  // advances the laptop the form is sitting on.
  //
  // The caller has to present the handoff secret its own browser generated;
  // only its hash was ever sent to us. Knowing the email address is therefore
  // not enough to collect somebody else's signup token. A mismatch returns
  // the same "not yet" as an unverified record rather than an error, so this
  // cannot be used to probe which addresses are mid-signup.
  async signupLinkStatus(req, res, next) {
    try {
      const { email, handoff } = req.body;
      if (!email || !handoff) return next(new AppError("email and handoff are required", 400));

      const normEmail = String(email).toLowerCase().trim();
      const record    = await SignupOtp.findOne({ email: normEmail });
      if (!record || !record.verified || !record.handoffHash) return res.json({ verified: false });

      const given    = Buffer.from(crypto.createHash("sha256").update(String(handoff)).digest("hex"));
      const expected = Buffer.from(record.handoffHash);
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        return res.json({ verified: false });
      }

      await SignupOtp.deleteOne({ _id: record._id });
      res.json({ verified: true, signupToken: issueSignupToken(normEmail) });
    } catch (err) {
      next(new AppError(err.message || "Status check failed", 500));
    }
  },

  // ── Account deletion ───────────────────────────────────────────────────────
  // Play's User Data policy asks for a real erase rather than a deactivation.
  // What happens depends on whether anyone is left to hand the organisation
  // to -- see services/accountDeletionService.js.
  // The public route, for people who cannot sign in any more -- someone who
  // left the company, or lost access to the address. Play asks for a deletion
  // route that works outside the app, and the in-app one requires a session.
  //
  // The response is identical whether or not the address is registered. A form
  // that answers "no such account" is a way to test which addresses are.
  async publicDeletionRequest(req, res, next) {
    const GENERIC = { success: true, message: "If that address has an Arthaleads account, we've emailed you to confirm the request." };
    try {
      const email = String(req.body.email || "").toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return next(new AppError("Enter a valid email address", 400));
      }

      const user = await User.findOne({ email }).select("name email role orgId").lean();
      if (user) {
        const org = user.orgId
          ? await Organization.findById(user.orgId).select("name").lean()
          : null;
        await sendAccountDeletionRequestEmails(user, org ? org.name : null);
        AuditLog.create({
          action: "user_deactivated",
          targetUser: user._id,
          targetOrg: user.orgId || null,
          details: { deletionRequestedVia: "public form" },
          ip: req.ip || "",
        }).catch(() => {});
      }
      res.json(GENERIC);
    } catch (err) {
      // Still generic on failure: a 500 only for this address would leak the
      // same fact the generic response exists to hide.
      logger.error(`[deletion-request] ${err.message}`);
      res.json(GENERIC);
    }
  },

  async requestAccountDeletion(req, res, next) {
    try {
      const result = await accountDeletion.requestDeletion(req.user);
      if (result.outcome === "scheduled") {
        invalidateOrgCache(req.user.orgId);
        _auditLog(req, "org_deletion_scheduled", {
          targetOrg: req.user.orgId,
          details: { scheduledFor: result.scheduledFor },
        });
        return res.json({
          success: true,
          outcome: "scheduled",
          scheduledFor: result.scheduledFor,
          graceDays: result.graceDays,
        });
      }
      _auditLog(req, "user_deactivated", { targetUser: req.user._id, details: { selfDeleted: true } });
      res.json({ success: true, outcome: "erased" });
    } catch (err) {
      next(new AppError(err.message || "Could not delete the account", 500));
    }
  },

  async cancelAccountDeletion(req, res, next) {
    try {
      const result = await accountDeletion.cancelDeletion(req.user);
      if (!result.cancelled) return next(new AppError("No deletion is scheduled for this organisation.", 400));
      invalidateOrgCache(req.user.orgId);
      _auditLog(req, "org_deletion_cancelled", { targetOrg: req.user.orgId });
      res.json({ success: true });
    } catch (err) {
      next(new AppError(err.message || "Could not cancel the deletion", 500));
    }
  },

  async accountDeletionStatus(req, res, next) {
    try {
      const org = req.user.orgId
        ? await Organization.findById(req.user.orgId).select("name deletionScheduledAt").lean()
        : null;
      const lastAdmin = req.user.role === "admin" && (await accountDeletion.isLastAdmin(req.user));
      res.json({
        success: true,
        orgName: org ? org.name : null,
        scheduledFor: org ? org.deletionScheduledAt : null,
        graceDays: accountDeletion.GRACE_DAYS,
        // Tells the client which warning to show before anything is destroyed.
        willCloseOrganisation: lastAdmin,
      });
    } catch (err) {
      next(new AppError(err.message || "Could not read deletion status", 500));
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { token } = req.params;
      const { password } = req.body;
      if (!password || password.length < 8) {
        return next(new AppError("Password must be at least 8 characters", 400));
      }
      const data = await authService.resetPassword(token, password);
      sendAuthResponse(res, 200, data);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
