import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    network: { type: String, enum: ["MTN", "Telecel", "AirtelTigo"], required: true },
    bundle: { type: mongoose.Schema.Types.ObjectId, ref: "Bundle", required: true },
    bundleSize: { type: String, required: true },
    price: { type: Number, required: true },
    deliveryPhone: { type: String, required: true },
    paymentPhone: { type: String, required: true },
    paymentMethod: {
      type: String,
      enum: ["MTN MoMo", "Telecel Cash", "AirtelTigo Money"],
      required: true,
    },
    paymentReference: { type: String, default: null },
    providerOrderId: { type: String, default: null }, // iDataGH's order_id, for status checks
    status: {
      type: String,
      enum: ["pending_payment", "processing", "delivered", "failed"],
      default: "pending_payment",
    },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
