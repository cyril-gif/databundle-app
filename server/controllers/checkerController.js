import CheckerOrder from "../models/CheckerOrder.js";
import Voucher from "../models/Voucher.js";
import Settings from "../models/Settings.js";
import { generateOrderRef } from "../utils/generateRef.js";

const VALID_EXAM_TYPES = ["BECE", "WASSCE", "PRIVATE"];

// @desc Create a pending voucher order. Payment is handled entirely by the
// Paystack Popup on the frontend — this just reserves the order so the popup
// has a reference/amount to attach payment to.
// @route POST /api/checker/buy
export const buyVoucher = async (req, res, next) => {
  try {
    const { examType, year, buyerPhone, quantity } = req.body;

    if (!examType || !VALID_EXAM_TYPES.includes(examType)) {
      return res.status(400).json({ message: "Select a valid exam type (BECE, WASSCE, or Private)" });
    }
    if (!year || !buyerPhone) {
      return res.status(400).json({ message: "Year and phone number are required" });
    }
    if (!/^0\d{9}$/.test(buyerPhone)) {
      return res.status(400).json({ message: "Enter a valid 10-digit Ghanaian phone number" });
    }

    const settings = await Settings.getSingleton();
    const qty = Math.max(1, parseInt(quantity) || 1);
    const amountDue = settings.checkerPrice * qty;

    const checkerOrder = await CheckerOrder.create({
      reference: generateOrderRef("CHK"),
      examType,
      year,
      buyerPhone,
      paymentPhone: buyerPhone,
      paymentMethod: "Paystack Popup",
      quantity: qty,
      status: "pending_payment",
    });

    res.status(201).json({ order: checkerOrder, amountDue });
  } catch (err) {
    next(err);
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
    { examType: checkerOrder.examType, year: checkerOrder.year, used: false },
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
        message: "Out of stock for this exam type/year. Customer should be refunded.",
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

// @desc Admin: bulk-load voucher stock for a given exam type + year
// @route POST /api/checker/vouchers/bulk
export const bulkAddVouchers = async (req, res, next) => {
  try {
    const { examType, year, vouchers } = req.body; // vouchers: [{ serial, pin }, ...]

    if (!examType || !VALID_EXAM_TYPES.includes(examType)) {
      return res.status(400).json({ message: "Select a valid exam type (BECE, WASSCE, or Private)" });
    }
    if (!year || !Array.isArray(vouchers) || vouchers.length === 0) {
      return res.status(400).json({ message: "Year and a non-empty vouchers array are required" });
    }

    const docs = vouchers.map((v) => ({
      examType,
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

// @desc Admin: check remaining voucher stock per exam type + year
// @route GET /api/checker/vouchers/stock
export const getVoucherStock = async (req, res, next) => {
  try {
    const stock = await Voucher.aggregate([
      { $group: { _id: { examType: "$examType", year: "$year", used: "$used" }, count: { $sum: 1 } } },
      { $sort: { "_id.examType": 1, "_id.year": -1 } },
    ]);
    res.json(stock);
  } catch (err) {
    next(err);
  }
};
