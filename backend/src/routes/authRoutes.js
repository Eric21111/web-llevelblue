import express from "express";
import { login, registerSuperAdmin } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", login);
router.post("/register-super-admin", registerSuperAdmin);

export default router;
