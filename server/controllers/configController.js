// Exposes non-sensitive, frontend-safe config values. The Paystack PUBLIC key
// (unlike the secret key) is designed to be exposed client-side — that's how
// Paystack's own Popup checkout works everywhere.
import Settings from "../models/Settings.js";

export const getPublicConfig = async (req, res, next) => {
  try {
    const settings = await Settings.getSingleton();
    res.json({
      paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
      checkerPrice: settings.checkerPrice,
    });
  } catch (err) {
    next(err);
  }
};
