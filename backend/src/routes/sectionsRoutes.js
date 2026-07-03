import express from "express";
import { getSections, addSection, deleteSection } from "../controllers/sectionsController.js";

const router = express.Router();

router.get("/", getSections);
router.post("/", addSection);
router.delete("/:id", deleteSection);

export default router;
