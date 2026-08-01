import express from "express";
import { getMyReferralStats, withdrawEarnings } from "../controllers/referralController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/my-stats", protect, getMyReferralStats);
router.post("/withdraw", protect, withdrawEarnings);

export default router;
