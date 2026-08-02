import { getWalletBalance } from "../utils/idatagh.js";
import { reconcilePendingOrders } from "./orderController.js";
import Settings from "../models/Settings.js";
import Bundle from "../models/Bundle.js";

// @desc Check your iDataGH wallet balance (top this up so orders don't fail)
// @route GET /api/admin/wallet-balance
export const checkWalletBalance = async (req, res, next) => {
  try {
    const data = await getWalletBalance();
    res.json({ balance: data.balance });
  } catch (err) {
    next(err);
  }
};

// @desc Manually trigger a sweep of orders stuck in "processing" to check
// their real iDataGH status. Wire this to a scheduled job in production.
// @route POST /api/admin/reconcile-orders
export const reconcileOrders = async (req, res, next) => {
  try {
    const results = await reconcilePendingOrders();
    res.json({ message: `Checked ${results.length} pending orders`, results });
  } catch (err) {
    next(err);
  }
};

// @desc Get current business settings (data bundle markup %, BECE checker price)
// @route GET /api/admin/settings
export const getSettings = async (req, res, next) => {
  try {
    const settings = await Settings.getSingleton();
    res.json(settings);
  } catch (err) {
    next(err);
  }
};

// @desc Update markup % and/or checker price. Changing markup instantly
// recalculates every bundle's selling price from its stored iDataGH cost price
// (no need to re-run sync-packages or wait for a redeploy).
// @route PUT /api/admin/settings
export const updateSettings = async (req, res, next) => {
  try {
    const { markupPercent, checkerPrice } = req.body;

    if (markupPercent !== undefined && (isNaN(markupPercent) || markupPercent < 0)) {
      return res.status(400).json({ message: "Markup percent must be a positive number" });
    }
    if (checkerPrice !== undefined && (isNaN(checkerPrice) || checkerPrice < 0)) {
      return res.status(400).json({ message: "Checker price must be a positive number" });
    }

    const settings = await Settings.getSingleton();

    if (markupPercent !== undefined) settings.markupPercent = markupPercent;
    if (checkerPrice !== undefined) settings.checkerPrice = checkerPrice;
    await settings.save();

    // Recompute every bundle's selling price from its stored cost price so the
    // new markup takes effect immediately, without needing sync-packages re-run.
    let bundlesUpdated = 0;
    if (markupPercent !== undefined) {
      const bundles = await Bundle.find({ providerPrice: { $ne: null } });
      for (const bundle of bundles) {
        bundle.price = Math.round(bundle.providerPrice * (1 + settings.markupPercent / 100) * 100) / 100;
        await bundle.save();
        bundlesUpdated++;
      }
    }

    res.json({ message: "Settings updated", settings, bundlesUpdated });
  } catch (err) {
    next(err);
  }
};
