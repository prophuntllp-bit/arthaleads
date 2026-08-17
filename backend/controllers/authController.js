const crypto      = require("crypto");
const jwt         = require("jsonwebtoken");
const authService = require("../services/authService");
const otpService  = require("../services/otpService");
const SignupOtp   = require("../models/SignupOtp");
const User        = require("../models/User");
const AuditLog    = require("../models/AuditLog");
const { AppError } = require("../middlewares/errorHandler");
const { verifyRecaptcha } = require("../utils/recaptcha");
const { isDisposableEmail } = require("../utils/emailDomains");
const { sendSignupPendingEmail, notifySuperAdminsOfSignup } = require("../utils/email");

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
      // reCAPTCHA check temporarily disabled — same production misconfiguration
      // (secret key / Google siteverify reachability) that blocked all logins was
      // also blocking every signup. Re-enable once RECAPTCHA_SECRET_KEY is
      // verified against the site key baked into the frontend build.
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
      // reCAPTCHA check temporarily disabled — misconfiguration on the
      // deployed backend (secret key / Google siteverify reachability) was
      // rejecting every login attempt in production, locking out all agents.
      // Re-enable once RECAPTCHA_SECRET_KEY is verified against the site key
      // baked into the frontend build. Account lockout + failure logging in
      // authService.login still protect against brute force in the meantime.
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
      const { email, recaptchaToken } = req.body;
      const ok = await verifyRecaptcha(recaptchaToken, "signup_send_otp");
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
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Upsert: one live code per address. Resending replaces the previous code
      // and resets the guess counter, but keeps counting sends.
      // (Computed rather than $inc'd because $inc and $setOnInsert on the same
      // path is a Mongo update conflict. sendCount is a soft anti-mail-bomb
      // cap, not a security boundary, so a racy double-send is acceptable —
      // the auth rate limiter is the hard backstop.)
      await SignupOtp.findOneAndUpdate(
        { email: normEmail },
        {
          email: normEmail, otpHash, expiresAt, attempts: 0,
          ip: req.ip || "",
          sendCount: existing ? existing.sendCount + 1 : 1,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Send OTP to the email the user typed in the signup form
      const { Resend } = require("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from   = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";

      await resend.emails.send({
        from,
        to:      normEmail,
        subject: `${otp} — Verify your email to start your Arthaleads trial`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <img src="https://www.arthaleads.com/logo.png" alt="Arthaleads" width="48" height="48"
            style="display:inline-block;border-radius:14px;" />
        </td></tr>
        <tr><td style="background:#1c1917;border-radius:20px;padding:40px 36px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#f97316;letter-spacing:.08em;text-transform:uppercase;">Email Verification</p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#fff;">Verify your email address</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#a8a29e;line-height:1.6;">
            Use the code below to continue setting up your Arthaleads trial. It expires in <strong style="color:#fff;">10 minutes</strong>.
          </p>
          <div style="background:#292524;border:1px solid #3d3835;border-radius:14px;padding:24px;text-align:center;margin-bottom:28px;">
            <span style="font-size:40px;font-weight:900;letter-spacing:.25em;color:#f97316;">${otp}</span>
          </div>
          <p style="margin:0;font-size:13px;color:#78716c;">Never share this OTP with anyone. Arthaleads will never ask for your OTP.</p>
        </td></tr>
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#a8a29e;">© ${new Date().getFullYear()} Arthaleads. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });

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

      // Short-lived proof-of-email-ownership, submitted with the signup form.
      const signupToken = jwt.sign(
        { email: normEmail, type: "signup_verify" },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      // Delete the used OTP record
      await SignupOtp.deleteOne({ email: normEmail });

      res.json({ success: true, signupToken });
    } catch (err) {
      next(new AppError(err.message || "OTP verification failed", 500));
    }
  },

  // ── MSG91 OTP ────────────────────────────────────────────────────────────────
  async sendOtp(req, res, next) {
    try {
      const { phone, recaptchaToken } = req.body;
      const ok = await verifyRecaptcha(recaptchaToken, "login_send_otp");
      if (!ok) return next(new AppError("Verification failed. Please refresh and try again.", 400));
      if (!phone) return next(new AppError("Phone number is required", 400));
      const digits = String(phone).replace(/\D/g, "");
      if (digits.length < 10) return next(new AppError("Enter a valid 10-digit mobile number", 400));
      await otpService.sendOtp(phone);
      res.json({ success: true, message: "OTP sent successfully" });
    } catch (err) {
      next(new AppError(err.message || "Failed to send OTP", 500));
    }
  },

  async verifyOtp(req, res, next) {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) return next(new AppError("Phone and OTP are required", 400));
      if (String(otp).length !== 6) return next(new AppError("OTP must be 6 digits", 400));

      await otpService.verifyOtp(phone, otp);

      // OTP verified — log the user in by phone number
      const data = await authService.loginByPhone(phone);
      sendAuthResponse(res, 200, data);
    } catch (err) {
      // Distinguish OTP mismatch from other errors
      const msg = err.message || "";
      if (msg.toLowerCase().includes("not match") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")) {
        return next(new AppError("Invalid or expired OTP. Please try again.", 400));
      }
      next(new AppError(msg || "OTP verification failed", 500));
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
