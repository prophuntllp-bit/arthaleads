// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { protect, authorize } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const {
  signupSchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
} = require("../validations/schemas");

// Public routes
router.post("/signup",         validate(signupSchema), authController.signup);
router.post("/login",          validate(loginSchema),  authController.login);
router.post("/google",         authController.googleAuth);
router.post("/otp/send",       authController.sendOtp);      // MSG91 OTP send
router.post("/otp/verify",     authController.verifyOtp);    // MSG91 OTP verify + login
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

// Logout must be public - cookie must clear even if JWT is expired/invalid
router.post("/logout",        authController.logout);

// Protected routes
router.use(protect);
router.get("/me",             authController.getMe);
router.put("/me",             validate(updateProfileSchema), authController.updateProfile);
router.get("/agents",         authController.getAgents);
router.get("/performance",    authorize("admin", "manager"), authController.getPerformance);

// Admin only
router.get("/users",          authorize("admin"),  authController.getAllUsers);
router.post("/users",         authorize("admin"), validate(createUserSchema), authController.createUser);
router.patch("/users/:id",    authorize("admin"), validate(updateUserSchema), authController.updateUser);
router.patch("/users/:id/toggle", authorize("admin"), authController.toggleUserActive);
router.delete("/users/:id",   authorize("admin"), authController.deleteUser);

module.exports = router;
