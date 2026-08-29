// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { protect, authorize } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { authLimiter } = require("../middlewares/rateLimiters");
const {
  signupSchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
} = require("../validations/schemas");

// Public routes
router.post("/signup",         authLimiter, validate(signupSchema), authController.signup);
router.post("/login",          authLimiter, validate(loginSchema),  authController.login);
router.post("/admin-login",    authLimiter, authController.adminLogin); // super_admin only
router.post("/google",         authLimiter, authController.googleAuth);
router.post("/otp/send",           authLimiter, authController.sendOtp);          // login: email OTP send
router.post("/otp/verify",         authLimiter, authController.verifyOtp);         // login: email OTP verify + login
router.post("/signup/send-otp",    authLimiter, authController.signupSendOtp);     // signup: phone verify OTP send
router.post("/signup/verify-otp",  authLimiter, authController.signupVerifyOtp);   // signup: phone verify OTP confirm
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password/:token", authLimiter, authController.resetPassword);

// Logout must be public - cookie must clear even if JWT is expired/invalid
router.post("/logout",        authController.logout);

// Restoring a super admin's session after impersonation must be public too -
// the current cookie at that point belongs to the impersonated org admin.
router.post("/restore-admin-session", authController.restoreAdminSession);

// Protected routes
router.use(protect);
router.get("/me",             authController.getMe);
router.put("/me",             validate(updateProfileSchema), authController.updateProfile);
router.get("/agents",         authController.getAgents);
router.get("/performance",    authorize("admin", "manager"), authController.getPerformance);

// Team list is viewable by admin + manager; managers see it read-only
// (create/edit/toggle/delete stay admin-only — same split the UI already
// enforces via disabled buttons for non-admins).
router.get("/users",          authorize("admin", "manager"),  authController.getAllUsers);
router.post("/users",         authorize("admin"), validate(createUserSchema), authController.createUser);
router.patch("/users/:id",    authorize("admin"), validate(updateUserSchema), authController.updateUser);
router.patch("/users/:id/toggle", authorize("admin"), authController.toggleUserActive);
router.delete("/users/:id",   authorize("admin"), authController.deleteUser);

module.exports = router;
