import mongoose from "mongoose";

// Pool of BECE result checker PINs (admin-loaded stock)
const voucherSchema = new mongoose.Schema(
  {
    examType: { type: String, enum: ["BECE"], default: "BECE" },
    year: { type: Number, required: true },
    serial: { type: String, required: true },
    pin: { type: String, required: true },
    used: { type: Boolean, default: false },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "CheckerOrder", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Voucher", voucherSchema);
