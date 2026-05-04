const authService = require("../services/authService");
const { AppError } = require("../middlewares/errorHandler");

// Shared cookie options — httpOnly prevents JS access (XSS protection)
// sameSite: "strict" blocks cross-origin requests (CSRF protection)
const cookieOptions = () => ({
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict",
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
    res.clearCookie("crm_token", cookieOptions());
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
      const user = await authService.updateUser(req.params.id, req.body, req.user._id);
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  },

  async toggleUserActive(req, res, next) {
    try {
      const user = await authService.toggleUserActive(req.params.id, req.user._id);
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      await authService.deleteUser(req.params.id, req.user._id);
      res.json({ success: true, message: "User removed successfully" });
    } catch (err) {
      next(err);
    }
  },

  async getPerformance(req, res, next) {
    try {
      const performance = await authService.getPerformance(req.user);
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
