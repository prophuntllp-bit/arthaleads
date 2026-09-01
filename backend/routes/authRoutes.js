// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { protect, authorize } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { authLimiter, signupPollLimiter } = require("../middlewares/rateLimiters");
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
router.post("/google/signup-profile", authLimiter, authController.googleSignupProfile);
router.post("/signup/send-otp",    authLimiter, authController.signupSendOtp);     // signup: mail the link + code
router.post("/signup/verify-otp",  authLimiter, authController.signupVerifyOtp);   // signup: confirm the emailed code
router.post("/signup/confirm-link", authLimiter, authController.signupConfirmLink); // signup: confirm the emailed link
router.post("/signup/link-status",  signupPollLimiter, authController.signupLinkStatus); // signup: originating tab polls
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/account/deletion-request", authLimiter, authController.publicDeletionRequest); // public: no session
router.post("/reset-password/:token", authLimiter, authController.resetPassword);

// Logout must be public - cookie must clear even if JWT is expired/invalid
router.post("/logout",        authController.logout);

// Restoring a super admin's session after impersonation must be public too -
// the current cookie at that point belongs to the impersonated org admin.
router.post("/restore-admin-session", authController.restoreAdminSession);

// Protected routes
router.use(protect);
router.get("/me",             authController.getMe);

// Account deletion. These stay reachable while an org is frozen for deletion —
// see the DELETION_ROUTES exemption in middlewares/auth.js.
router.get("/account/deletion",    authController.accountDeletionStatus);
router.post("/account/deletion",   authLimiter, authController.requestAccountDeletion);
router.delete("/account/deletion", authLimiter, authController.cancelAccountDeletion);
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
