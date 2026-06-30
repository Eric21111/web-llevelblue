import express from "express";
import { getContentBank, addContentBankItem } from "../controllers/contentBankController.js";

const router = express.Router();

router.get("/", getContentBank);
router.post("/", addContentBankItem);

export default router;
