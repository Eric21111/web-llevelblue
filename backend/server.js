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
import { createWorkspaceRoutes } from './src/routes/workspaceRoutes.js';
import {createEnrollmentRoutes} from './src/routes/enrollmentRoutes.js';
import { createBountyRoutes } from './src/routes/scopedBounties.js';
import { createCurriculumRoutes, createMobileContentRoutes } from './src/routes/curriculumRoutes.js';
import { supabase } from './src/config/db.js';
import { headOnly } from './src/services/access.js';
import teacherRoutes from "./src/routes/teacherRoutes.js";
import contentBankRoutes from "./src/routes/contentBankRoutes.js";
import logRoutes from "./src/routes/logRoutes.js";
import feedbackRoutes from "./src/routes/feedbackRoutes.js";
import settingsRoutes from "./src/routes/settingsRoutes.js";
import { authMiddleware } from "./src/middleware/auth.js";
import { createRecoveryRoutes } from './src/routes/recoveryRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;
// Set only when the deployment has exactly this many trusted reverse proxies.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (![0, 1].includes(proxyHops)) throw new Error('TRUST_PROXY_HOPS must be 0 or 1');
app.set('trust proxy', proxyHops);

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
const recovery = createRecoveryRoutes(supabase);
app.use('/api/student-recovery', recovery.publicRoutes);
app.use('/api/password-assistance', authMiddleware, recovery.staffRoutes);


app.use("/api/content-bank", authMiddleware, headOnly, contentBankRoutes);
app.use("/api/system-logs", authMiddleware, headOnly, logRoutes);
app.use("/api/usability-feedback", authMiddleware, feedbackRoutes);


app.use("/api/settings", authMiddleware, headOnly, settingsRoutes);

app.use('/api/bounties', authMiddleware, createBountyRoutes(supabase));
app.use('/api/curriculum', authMiddleware, createCurriculumRoutes(supabase));
app.use('/api/mobile/content', authMiddleware, createMobileContentRoutes(supabase));
app.use('/api', authMiddleware, createWorkspaceRoutes(supabase));
app.use('/api/enrollment', authMiddleware, createEnrollmentRoutes(supabase));
app.use('/api/teachers', headOnly, teacherRoutes);
app.use((error, req, res, next) => {
  console.error('Workspace request failed:', error.code || error.message);
  if(res.headersSent) return next(error);
  const setup=['42P01','42703','PGRST204','PGRST202','PGRST205'].includes(error.code);
  if(setup&&(req.originalUrl.startsWith('/api/enrollment')||req.originalUrl.startsWith('/api/teacher-activity')))return res.status(503).json({error:'Apply backend/migrations/20261011_enrollment.sql to enable the enrollment checklist and current enrollment counts.'});
  res.status(error.status || (setup ? 503 : error.code==='23505' || error.code==='P0001' ? 409 : 500)).json({error: setup ? (req.originalUrl.startsWith('/api/curriculum') || req.originalUrl.startsWith('/api/mobile/content') ? 'Curriculum publishing is not configured yet. Apply backend/migrations/20261008_curriculum.sql.' : 'Web foundations are not configured yet. Apply the database migrations and assign faculty sections.') : error.status || error.code==='P0001' ? error.message : 'This request could not be completed. Please retry.'});
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("Connected to Supabase");
});
