import mongoose from "mongoose";

const checkerOrderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    examType: { type: String, enum: ["BECE", "WASSCE", "PRIVATE"], required: true },
    year: { type: Number, required: true },
    buyerPhone: { type: String, required: true },
    paymentPhone: { type: String, required: true },
     paymentMethod: { type: String, default: "Paystack Popup" },

    paymentReference: { type: String, default: null },
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null },
    quantity: { type: Number, default: 1 }, // for bulk buys
    status: {
      type: String,
      enum: ["pending_payment", "paid", "delivered", "failed"],
      default: "pending_payment",
    },
  },
  { timestamps: true }
);

export default mongoose.model("CheckerOrder", checkerOrderSchema);
