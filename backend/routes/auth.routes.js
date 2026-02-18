import express from "express";
const router = express.Router();

import {
  signupController,
  confirmOTPController,
  loginController,
  forgotPasswordController,
  confirmForgotPasswordController,
  getCurrentUserController,
  logoutController,
  resendConfirmationController,
} from "../controllers/auth.controller.js";

router.use((req, res, next) => {
  console.log(`[Express Router] ${req.method} ${req.path}`);
  console.log("Body parser should have run:", req.body !== undefined);
  next();
});

router.post("/signup", signupController);
router.post("/confirm", confirmOTPController);
router.post("/login", loginController);
router.post("/forgot-password", forgotPasswordController);
router.post("/confirm-forgot-password", confirmForgotPasswordController);
router.post("/resend-confirmation", resendConfirmationController);

router.get("/me", getCurrentUserController);
router.post("/logout", logoutController);

export default router;
