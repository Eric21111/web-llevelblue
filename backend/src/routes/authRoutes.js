import express from "express";
import { login, registerSuperAdmin, updateProfile, completeInvite, sendVerificationCode, verifyCode, getMe } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/register-super-admin", registerSuperAdmin);
router.get("/me", authMiddleware, getMe);
router.put("/profile", authMiddleware, updateProfile);
router.put("/complete-invite", completeInvite);
router.post("/send-verification", sendVerificationCode);
router.post("/verify-code", verifyCode);

export default router;
