import express from "express";
import { addTeacher } from "../controllers/teacherController.js";

const router = express.Router();

router.post("/", addTeacher);

export default router;
