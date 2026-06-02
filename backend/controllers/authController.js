const crypto      = require("crypto");
const jwt         = require("jsonwebtoken");
const authService = require("../services/authService");
const otpService  = require("../services/otpService");
const SignupOtp   = require("../models/SignupOtp");
const User        = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");

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
  async signup(req, res, next) {
    try {
      const data = await authService.signup(req.body);
      sendAuthResponse(res, 201, data);
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
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
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      await authService.deleteUser(req.params.id, req.user._id, req.user.orgId);
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

  // ── Signup phone verification ─────────────────────────────────────────────
  async signupSendOtp(req, res, next) {
    try {
      const { phone, email } = req.body;
      if (!phone || !email) return next(new AppError("Phone and email are required", 400));

      const norm = normPhone(phone);
      if (norm.length !== 10) return next(new AppError("Enter a valid 10-digit mobile number", 400));

      // Reject if phone is already used by an existing account
      const taken = await User.findOne({ phone: { $in: [norm, `+91${norm}`, `91${norm}`, `0${norm}`] } });
      if (taken) return next(new AppError("This phone number is already registered. Please use a different number or log in.", 409));

      const otp     = String(crypto.randomInt(100000, 999999));
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Upsert: one record per phone (replace any previous attempt)
      await SignupOtp.findOneAndUpdate(
        { phone: norm },
        { phone: norm, email: email.toLowerCase().trim(), otpHash, expiresAt },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Send OTP to the email the user typed in the signup form
      const { Resend } = require("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from   = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";

      await resend.emails.send({
        from,
        to:      email.toLowerCase().trim(),
        subject: `${otp} — Verify your phone number on Arthaleads`,
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
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#f97316;letter-spacing:.08em;text-transform:uppercase;">Phone Verification</p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#fff;">Verify your mobile number</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#a8a29e;line-height:1.6;">
            Use the code below to verify your mobile number during signup. It expires in <strong style="color:#fff;">5 minutes</strong>.
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
      const [local, domain] = email.split("@");
      const masked = local.length <= 2 ? `${local[0]}***@${domain}` : `${local[0]}${local[1]}***@${domain}`;
      res.json({ success: true, maskedEmail: masked });
    } catch (err) {
      next(new AppError(err.message || "Failed to send OTP", 500));
    }
  },

  async signupVerifyOtp(req, res, next) {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) return next(new AppError("Phone and OTP are required", 400));
      if (String(otp).length !== 6) return next(new AppError("OTP must be 6 digits", 400));

      const norm   = normPhone(phone);
      const record = await SignupOtp.findOne({ phone: norm });

      if (!record)                                    return next(new AppError("OTP not found. Please request a new one.", 400));
      if (Date.now() > new Date(record.expiresAt).getTime()) return next(new AppError("OTP has expired. Please request a new one.", 400));

      const hash = crypto.createHash("sha256").update(String(otp)).digest("hex");
      if (hash !== record.otpHash) return next(new AppError("Invalid OTP. Please check and try again.", 400));

      // Issue a short-lived phone-verified token (15 min) — included in signup body
      const phoneToken = jwt.sign(
        { phone: norm, email: record.email, type: "phone_verify" },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );

      // Delete the used OTP record
      await SignupOtp.deleteOne({ phone: norm });

      res.json({ success: true, phoneToken });
    } catch (err) {
      next(new AppError(err.message || "OTP verification failed", 500));
    }
  },

  // ── MSG91 OTP ────────────────────────────────────────────────────────────────
  async sendOtp(req, res, next) {
    try {
      const { phone } = req.body;
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
      if (!password || password.length < 6) {
        return next(new AppError("Password must be at least 6 characters", 400));
      }
      const data = await authService.resetPassword(token, password);
      sendAuthResponse(res, 200, data);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
