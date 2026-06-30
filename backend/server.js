import express from "express";
import cors from "cors";
import morgan from "morgan";
import { connectDB } from "./src/config/db.js";

// Import Routes
import authRoutes from "./src/routes/authRoutes.js";
import studentRoutes from "./src/routes/studentRoutes.js";
import teacherRoutes from "./src/routes/teacherRoutes.js";
import contentBankRoutes from "./src/routes/contentBankRoutes.js";
import logRoutes from "./src/routes/logRoutes.js";
import feedbackRoutes from "./src/routes/feedbackRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Cloud Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/content-bank", contentBankRoutes);
app.use("/api/system-logs", logRoutes);
app.use("/api/usability-feedback", feedbackRoutes);
app.use("/api/analytics", analyticsRoutes);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
