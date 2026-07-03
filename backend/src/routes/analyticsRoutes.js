import express from "express";
import { getAnalytics, getAtRisk } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/", getAnalytics);
router.get("/at-risk", getAtRisk);

export default router;
