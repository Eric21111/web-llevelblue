import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";

// ─── Startup Security Guard ───────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error("CRITICAL: JWT_SECRET is not defined in .env. Refusing to start.");
  process.exit(1);
}

// Import Routes
import authRoutes from "./src/routes/authRoutes.js";
import studentRoutes from "./src/routes/studentRoutes.js";
import teacherRoutes from "./src/routes/teacherRoutes.js";
import contentBankRoutes from "./src/routes/contentBankRoutes.js";
import logRoutes from "./src/routes/logRoutes.js";
import feedbackRoutes from "./src/routes/feedbackRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import settingsRoutes from "./src/routes/settingsRoutes.js";
import sectionsRoutes from "./src/routes/sectionsRoutes.js";
import { authMiddleware } from "./src/middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Rate Limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,                  // max 15 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please try again in 15 minutes." },
});

// ─── Core Middleware ───────────────────────────────────────────────────────────
app.use(compression());               // Gzip all responses (60-80% size reduction)
app.use(helmet());                    // Sets secure HTTP headers
app.use(cors());
app.use(express.json({ limit: "1mb" })); // Guard against large payload attacks
app.use(morgan("dev"));

// ─── Mount Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes); // Rate-limit all auth endpoints
app.use("/api/students", authMiddleware, studentRoutes);
app.use("/api/teachers", authMiddleware, teacherRoutes);
app.use("/api/content-bank", authMiddleware, contentBankRoutes);
app.use("/api/system-logs", authMiddleware, logRoutes);
app.use("/api/usability-feedback", authMiddleware, feedbackRoutes);
app.use("/api/analytics", authMiddleware, analyticsRoutes);
app.use("/api/settings", authMiddleware, settingsRoutes);
app.use("/api/sections", authMiddleware, sectionsRoutes);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("Connected to Supabase");
});
