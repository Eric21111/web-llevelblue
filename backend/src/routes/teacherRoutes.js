import express from "express";
import { getTeachers, addTeacher, deleteTeacher } from "../controllers/teacherController.js";

const router = express.Router();

router.get("/", getTeachers);
router.post("/", addTeacher);
router.delete("/:id", deleteTeacher);

export default router;
