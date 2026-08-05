import express from "express";
import {
  buyVoucher,
  devConfirmVoucher,
  getCheckerOrder,
  bulkAddVouchers,
  getVoucherStock,
} from "../controllers/checkerController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

router.post("/buy", buyVoucher);
router.get("/vouchers/stock", protect, admin, getVoucherStock);
router.post("/vouchers/bulk", protect, admin, bulkAddVouchers);

// DEV-ONLY: manual fulfillment for local testing before your webhook is live.
// Remove this route (or lock it behind protect+admin) before deploying to production.
router.post("/:reference/dev-confirm", devConfirmVoucher);

router.get("/:reference", getCheckerOrder);

export default router;
