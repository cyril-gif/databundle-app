import express from "express";
import { checkWalletBalance, reconcileOrders, getSettings, updateSettings } from "../controllers/adminController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

router.get("/wallet-balance", protect, admin, checkWalletBalance);
router.post("/reconcile-orders", protect, admin, reconcileOrders);
router.get("/settings", protect, admin, getSettings);
router.put("/settings", protect, admin, updateSettings);

export default router;
