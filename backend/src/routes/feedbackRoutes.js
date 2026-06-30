import express from "express";
import { getFeedback, addFeedback } from "../controllers/feedbackController.js";

const router = express.Router();

router.get("/", getFeedback);
router.post("/", addFeedback);

export default router;
