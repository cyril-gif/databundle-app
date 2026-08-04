import Order from "../models/Order.js";
import Bundle from "../models/Bundle.js";
import Referral from "../models/Referral.js";
import { generateOrderRef } from "../utils/generateRef.js";
import { placeOrder, getOrderStatus } from "../utils/idatagh.js";

// @desc Create a new pending order. Payment itself is handled entirely by the
// Paystack Popup on the frontend (Inline.js) — this just reserves the order so
// the popup has a reference/amount to attach the payment to. Fulfillment only
// ever happens via the Paystack webhook once payment is confirmed (fulfillOrder).
// @route POST /api/orders
export const createOrder = async (req, res, next) => {
  try {
    const { bundleId, deliveryPhone } = req.body;

    if (!bundleId || !deliveryPhone) {
      return res.status(400).json({ message: "Bundle and delivery number are required" });
    }
    if (!/^0\d{9}$/.test(deliveryPhone)) {
      return res.status(400).json({ message: "Enter a valid 10-digit Ghanaian phone number" });
    }

    const bundle = await Bundle.findById(bundleId);
    if (!bundle || !bundle.active) {
      return res.status(404).json({ message: "Selected bundle is unavailable" });
    }

    // Guard: block duplicate orders for the same number within 5 minutes
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const duplicate = await Order.findOne({
      deliveryPhone,
      createdAt: { $gte: fiveMinsAgo },
      status: { $in: ["pending_payment", "processing"] },
    });
    if (duplicate) {
      return res.status(429).json({
        message: "You already have a pending order for this number. Please wait a few minutes before ordering again.",
      });
    }

    const order = await Order.create({
      reference: generateOrderRef("DB"),
      user: req.user?._id || null,
      network: bundle.network,
      bundle: bundle._id,
      bundleSize: bundle.size,
      price: bundle.price,
      deliveryPhone,
      paymentPhone: deliveryPhone,
      paymentMethod: "Paystack Popup",
      status: "pending_payment",
    });

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
};

/**
 * Marks an order paid and triggers data delivery. This is the ONLY place order
 * fulfillment should happen — it is called from the Paystack webhook handler
 * (server/controllers/paymentController.js) once `charge.success` is confirmed.
 * Never call this directly from a route the browser can trigger.
 */
export const fulfillOrder = async (order) => {
  if (order.status !== "pending_payment") return order;

  order.status = "processing";
  await order.save();

  if (order.user) {
    await Referral.findOneAndUpdate(
      { referredUser: order.user, status: "pending" },
      { status: "completed", rewardAmount: 2 } // GH₵2 reward, adjust as needed
    );
  }

  // --- DATA DELIVERY: iDataGH ---
  try {
    const placeRes = await placeOrder({
      network: order.network,
      beneficiary: order.deliveryPhone,
      dataSize: await getBundleDataSize(order),
    });

    order.providerOrderId = String(placeRes.order_id);
    await order.save();
  } catch (err) {
    // The order was genuinely never placed with iDataGH — this is a real failure.
    // The customer has already paid via Paystack, so this means a manual refund
    // or retry is owed. Check the admin dashboard for orders stuck here.
    order.status = "failed";
    await order.save();
    console.error(`iDataGH order placement failed for order ${order.reference}: ${err.message}`);
    return order;
  }

  // The order WAS placed successfully at this point. Now try one immediate status
  // check as a bonus — but a failure here must NOT undo a real success. If this
  // check fails or the order is still "Pending", just leave it as "processing";
  // reconcilePendingOrders() will catch up on it shortly after.
  try {
    const statusRes = await getOrderStatus(order.providerOrderId);
    if (statusRes.order_status === "Completed") {
      order.status = "delivered";
      order.deliveredAt = new Date();
      await order.save();
    } else if (statusRes.order_status === "Failed") {
      order.status = "failed";
      await order.save();
    }
    // Otherwise (e.g. "Pending") — leave as "processing" and let reconcile catch it.
  } catch (err) {
    console.error(`iDataGH status check failed for order ${order.reference} (order still placed, left as processing): ${err.message}`);
    // Do NOT mark as failed here — the order was already placed successfully above.
  }

  return order;
};

// Fallback lookup if the bundle wasn't populated on the order object
async function getBundleDataSize(order) {
  const bundle = await Bundle.findById(order.bundle);
  if (!bundle?.providerDataSize) {
    throw new Error(`No providerDataSize set on bundle for order ${order.reference} — run npm run sync-packages`);
  }
  return bundle.providerDataSize;
}

/**
 * Sweeps orders stuck in "processing" and checks their real status with
 * iDataGH, marking them delivered once completed. iDataGH's place-order can
 * return before the top-up actually finishes, so this catches those cases.
 * Wire this up to a scheduled job (cron, or a hosting platform's scheduled
 * task) to run every few minutes.
 */
export const reconcilePendingOrders = async () => {
  const pending = await Order.find({ status: "processing", providerOrderId: { $ne: null } });
  const results = [];

  for (const order of pending) {
    try {
      const statusRes = await getOrderStatus(order.providerOrderId);
      if (statusRes.order_status === "Completed") {
        order.status = "delivered";
        order.deliveredAt = new Date();
        await order.save();
        results.push({ reference: order.reference, status: "delivered" });
      } else if (statusRes.order_status === "Failed") {
        order.status = "failed";
        await order.save();
        results.push({ reference: order.reference, status: "failed" });
      }
    } catch (err) {
      results.push({ reference: order.reference, status: "check_failed", error: err.message });
    }
  }

  return results;
};

// @desc DEV-ONLY manual fulfillment trigger. Useful for local testing before your
// webhook URL is publicly reachable. Remove or lock this behind admin auth before
// going live — real fulfillment must come from the Paystack webhook only.
// @route POST /api/orders/:reference/dev-confirm
export const devConfirmOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ reference: req.params.reference });
    if (!order) return res.status(404).json({ message: "Order not found" });
    const updated = await fulfillOrder(order);
    res.json({ message: "Order manually fulfilled (dev mode)", order: updated });
  } catch (err) {
    next(err);
  }
};

// @desc Get order status by reference (used by the frontend to poll for completion)
// @route GET /api/orders/:reference
export const getOrderByReference = async (req, res, next) => {
  try {
    const order = await Order.findOne({ reference: req.params.reference }).populate("bundle");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// @desc Get logged-in user's order history
// @route GET /api/orders/my-orders
export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

// @desc Get recent delivered orders (for homepage social-proof ticker)
// @route GET /api/orders/recent-activity
export const getRecentActivity = async (req, res, next) => {
  try {
    const recent = await Order.find({ status: "delivered" })
      .sort({ deliveredAt: -1 })
      .limit(8)
      .select("reference deliveryPhone bundleSize network deliveredAt");

    const masked = recent.map((o) => ({
      reference: o.reference,
      network: o.network,
      bundleSize: o.bundleSize,
      deliveredAt: o.deliveredAt,
      phone: o.deliveryPhone.replace(/(\d{3})\d{4}(\d{2,3})/, "$1XXXX$2"),
    }));

    res.json(masked);
  } catch (err) {
    next(err);
  }
};

// @desc Get all orders (admin)
// @route GET /api/orders
export const getAllOrders = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

// @desc Update order status manually (admin)
// @route PUT /api/orders/:id/status
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    if (status === "delivered") order.deliveredAt = new Date();
    await order.save();

    res.json(order);
  } catch (err) {
    next(err);
  }
};
