import express from "express";
import {
  createBounty,
  getStudentBounties,
  acceptBounty,
  verifyOtp,
  getMenteeCode,
  validateBounty,
  selfClearBounty,
  getAllBounties,
  deleteBounty
} from "../controllers/bountyController.js";

const router = express.Router();

router.post("/", createBounty);
router.get("/", getAllBounties);
router.delete("/:id", deleteBounty);
router.get("/student/:id", getStudentBounties);
router.get("/mentee-code/:bountyId", getMenteeCode);
router.put("/:id/accept", acceptBounty);
router.post("/:id/verify-otp", verifyOtp);
router.put("/:id/validate", validateBounty);
router.put("/:id/self-clear", selfClearBounty);

export default router;
