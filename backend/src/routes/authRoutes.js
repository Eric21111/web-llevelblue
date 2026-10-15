import express from "express";
import { login, registerSuperAdmin, updateProfile, completeInvite, sendVerificationCode, verifyCode, getMe, resendTeacherInvite, verifyTeacherInvite, activateTeacherInvite } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/teacher-invite/resend", resendTeacherInvite);
router.post("/teacher-invite/verify", verifyTeacherInvite);
router.post("/teacher-invite/activate", activateTeacherInvite);
router.post("/register-super-admin", registerSuperAdmin);
router.get("/me", authMiddleware, getMe);
router.put("/profile", authMiddleware, updateProfile);
router.put("/complete-invite", authMiddleware, completeInvite);
router.post("/send-verification", sendVerificationCode);
router.post("/verify-code", verifyCode);

export default router;
