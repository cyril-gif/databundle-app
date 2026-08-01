import mongoose from "mongoose";

const bundleSchema = new mongoose.Schema(
  {
    network: {
      type: String,
      enum: ["MTN", "Telecel", "AirtelTigo"],
      required: true,
    },
    size: { type: String, required: true }, // e.g. "1GB", "5GB"
    sizeInMB: { type: Number, required: true }, // for sorting
    price: { type: Number, required: true }, // GH₵
    validity: { type: String, default: "Non-Expiry" },
    popular: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    stock: { type: Number, default: -1 }, // -1 = unlimited

    // Links this bundle to iDataGH's catalog so orders can be placed automatically.
    providerPackageId: { type: Number, default: null }, // their package_id, for reference
    providerDataSize: { type: Number, required: true }, // GB value sent as pa_data-bundle-packages
  },
  { timestamps: true }
);

export default mongoose.model("Bundle", bundleSchema);
