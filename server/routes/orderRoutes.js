import express from "express";
import {
  createOrder,
  devConfirmOrder,
  getOrderByReference,
  getMyOrders,
  getRecentActivity,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

// Public/optional-auth: guests can buy data without an account
router.post("/", createOrder);
router.get("/recent-activity", getRecentActivity);
router.get("/my-orders", protect, getMyOrders);
router.get("/:reference", getOrderByReference);

// DEV-ONLY: manual fulfillment for local testing before your webhook is live.
// Remove this route (or lock it behind protect+admin) before deploying to production.
router.post("/:reference/dev-confirm", devConfirmOrder);

// Admin
router.get("/", protect, admin, getAllOrders);
router.put("/:id/status", protect, admin, updateOrderStatus);

export default router;
