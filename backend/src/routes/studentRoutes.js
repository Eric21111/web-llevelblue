import express from "express";
import { getStudents, addStudent, deleteStudent, getMentorsForStudent } from "../controllers/studentController.js";

const router = express.Router();

router.get("/", getStudents);
router.post("/", addStudent);
router.delete("/:id", deleteStudent);
router.get("/:id/mentors", getMentorsForStudent);

export default router;
