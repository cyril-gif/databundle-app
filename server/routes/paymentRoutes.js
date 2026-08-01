import express from "express";
import { paystackWebhook } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/paystack/webhook", paystackWebhook);

export default router;
