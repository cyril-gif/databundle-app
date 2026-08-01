import CheckerOrder from "../models/CheckerOrder.js";
import Voucher from "../models/Voucher.js";
import { generateOrderRef } from "../utils/generateRef.js";
import { initiateMobileMoneyCharge, PAYSTACK_PROVIDER_MAP, submitOtp } from "../utils/paystack.js";

const CHECKER_PRICE = 15; // GH₵ per voucher, adjust to your actual WAEC voucher cost + margin

// @desc Buy a BECE result checker voucher (initiates Paystack Mobile Money charge)
// @route POST /api/checker/buy
export const buyVoucher = async (req, res, next) => {
  try {
    const { year, buyerPhone, paymentPhone, paymentMethod, quantity } = req.body;

    if (!year || !buyerPhone || !paymentPhone || !paymentMethod) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const provider = PAYSTACK_PROVIDER_MAP[paymentMethod];
    if (!provider) {
      return res.status(400).json({ message: "Unsupported payment method" });
    }

    const qty = Math.max(1, parseInt(quantity) || 1);
    const amountDue = CHECKER_PRICE * qty;

    const checkerOrder = await CheckerOrder.create({
      reference: generateOrderRef("BECE"),
      year,
      buyerPhone,
      paymentPhone,
      paymentMethod,
      quantity: qty,
      status: "pending_payment",
    });

    try {
      const chargeRes = await initiateMobileMoneyCharge({
        amountPesewas: Math.round(amountDue * 100),
        email: `${paymentPhone.replace(/\D/g, "")}@${process.env.CUSTOMER_EMAIL_DOMAIN || "customer.databundlegh.com"}`,
        phone: paymentPhone,
        provider,
        reference: checkerOrder.reference,
      });

      checkerOrder.paymentReference = chargeRes.data.reference;
      await checkerOrder.save();

      return res.status(201).json({
        message: "Approve the payment prompt sent to your phone to complete this order.",
        order: checkerOrder,
        amountDue,
        paystackStatus: chargeRes.data.status,
      });

      console.error(...)
      
    } catch (paymentErr) {
      checkerOrder.status = "failed";
      await checkerOrder.save();
      return res.status(502).json({ message: `Payment could not be started: ${paymentErr.message}` });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Submits an OTP for a pending Mobile Money charge (same pattern as orders).
 * @route POST /api/checker/:reference/submit-otp
 */
export const submitVoucherOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: "OTP is required" });

    const checkerOrder = await CheckerOrder.findOne({ reference: req.params.reference });
    if (!checkerOrder) return res.status(404).json({ message: "Order not found" });
    if (!checkerOrder.paymentReference) {
      return res.status(400).json({ message: "No pending payment found for this order" });
    }

    const result = await submitOtp({ otp, reference: checkerOrder.paymentReference });
    res.json({ message: "OTP submitted, waiting for payment confirmation", status: result.data.status });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Marks a voucher order paid and issues a PIN from stock. Called ONLY from the
 * Paystack webhook handler once `charge.success` is confirmed — never expose
 * this to a route the browser can trigger directly.
 */
export const fulfillCheckerOrder = async (checkerOrder) => {
  if (checkerOrder.status !== "pending_payment") return checkerOrder;

  const voucher = await Voucher.findOneAndUpdate(
    { examType: "BECE", year: checkerOrder.year, used: false },
    { used: true, usedBy: checkerOrder._id },
    { new: true }
  );

  if (!voucher) {
    checkerOrder.status = "failed";
    await checkerOrder.save();
    return checkerOrder;
  }

  checkerOrder.voucher = voucher._id;
  checkerOrder.status = "delivered";
  await checkerOrder.save();
  return checkerOrder;
};

// @desc DEV-ONLY manual fulfillment trigger for local testing before your webhook
// URL is publicly reachable. Remove or lock behind admin auth before going live.
// @route POST /api/checker/:reference/dev-confirm
export const devConfirmVoucher = async (req, res, next) => {
  try {
    const checkerOrder = await CheckerOrder.findOne({ reference: req.params.reference });
    if (!checkerOrder) return res.status(404).json({ message: "Order not found" });

    const updated = await fulfillCheckerOrder(checkerOrder);
    if (updated.status === "failed") {
      return res.status(409).json({
        message: "Out of stock for this year's checker vouchers. Customer should be refunded.",
      });
    }

    const voucher = await Voucher.findById(updated.voucher);
    res.json({
      message: "Order manually fulfilled (dev mode)",
      serial: voucher.serial,
      pin: voucher.pin,
    });
  } catch (err) {
    next(err);
  }
};

// @desc Check status / retrieve voucher for an order reference (used for polling)
// @route GET /api/checker/:reference
export const getCheckerOrder = async (req, res, next) => {
  try {
    const order = await CheckerOrder.findOne({ reference: req.params.reference }).populate("voucher");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const response = { ...order.toObject() };
    if (order.status !== "delivered") {
      delete response.voucher; // don't leak PIN before payment confirmed
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
};

// @desc Admin: bulk-load voucher stock
// @route POST /api/checker/vouchers/bulk
export const bulkAddVouchers = async (req, res, next) => {
  try {
    const { year, vouchers } = req.body; // vouchers: [{ serial, pin }, ...]
    if (!year || !Array.isArray(vouchers) || vouchers.length === 0) {
      return res.status(400).json({ message: "Year and a non-empty vouchers array are required" });
    }

    const docs = vouchers.map((v) => ({
      examType: "BECE",
      year,
      serial: v.serial,
      pin: v.pin,
    }));

    const inserted = await Voucher.insertMany(docs, { ordered: false });
    res.status(201).json({ message: `${inserted.length} vouchers added`, count: inserted.length });
  } catch (err) {
    next(err);
  }
};

// @desc Admin: check remaining voucher stock per year
// @route GET /api/checker/vouchers/stock
export const getVoucherStock = async (req, res, next) => {
  try {
    const stock = await Voucher.aggregate([
      { $match: { examType: "BECE" } },
      { $group: { _id: { year: "$year", used: "$used" }, count: { $sum: 1 } } },
    ]);
    res.json(stock);
  } catch (err) {
    next(err);
  }
};
