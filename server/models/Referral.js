import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredPhone: { type: String, required: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
    rewardAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Referral", referralSchema);
