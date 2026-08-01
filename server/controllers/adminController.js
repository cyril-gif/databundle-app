import { getWalletBalance } from "../utils/idatagh.js";
import { reconcilePendingOrders } from "./orderController.js";

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
