import mongoose from "mongoose";

// Single-document collection holding admin-adjustable business settings.
// Use Settings.getSingleton() to always get (or auto-create) the one doc.
const settingsSchema = new mongoose.Schema(
  {
    markupPercent: { type: Number, default: 8 }, // % added on top of iDataGH's cost price for data bundles
    checkerPrice: { type: Number, default: 15 }, // GH₵ price per BECE checker voucher
  },
  { timestamps: true }
);

settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model("Settings", settingsSchema);
