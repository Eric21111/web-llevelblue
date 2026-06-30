import express from "express";
import { getStudents, addStudent, deleteStudent } from "../controllers/studentController.js";

const router = express.Router();

router.get("/", getStudents);
router.post("/", addStudent);
router.delete("/:id", deleteStudent);

export default router;
