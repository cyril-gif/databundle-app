import crypto from "crypto";
import Order from "../models/Order.js";
import CheckerOrder from "../models/CheckerOrder.js";
import { fulfillOrder } from "./orderController.js";
import { fulfillCheckerOrder } from "./checkerController.js";

// @desc Receives payment status events from Paystack. This is the ONLY trusted
// source of truth for whether a Mobile Money payment actually succeeded — the
// direct /charge response only tells you the prompt was sent, not that the
// customer approved it.
// @route POST /api/payments/paystack/webhook
export const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const expectedHash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest("hex");

    // Reject anything that isn't provably from Paystack
    if (!signature || signature !== expectedHash) {
      return res.sendStatus(401);
    }

    // Acknowledge immediately - Paystack expects a fast response and will retry
    // if it doesn't get one, which could cause duplicate processing.
    res.sendStatus(200);

    const event = req.body;
    if (event.event !== "charge.success") return;

    const reference = event.data.reference;

    const order = await Order.findOne({ reference });
    if (order) {
      await fulfillOrder(order);
      return;
    }

    const checkerOrder = await CheckerOrder.findOne({ reference });
    if (checkerOrder) {
      await fulfillCheckerOrder(checkerOrder);
    }
  } catch (err) {
    console.error("Paystack webhook error:", err.message);
    if (!res.headersSent) res.sendStatus(500);
  }
};
