// Exposes non-sensitive, frontend-safe config values. The Paystack PUBLIC key
// (unlike the secret key) is designed to be exposed client-side — that's how
// Paystack's own Popup checkout works everywhere.
import Settings from "../models/Settings.js";

export const getPublicConfig = async (req, res, next) => {
  try {
    const settings = await Settings.getSingleton();
    
    // Get Paystack public key from environment
    const paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY || null;
    const paystackEnabled = !!paystackPublicKey;
    
    res.json({
      success: true,
      data: {
        paystackPublicKey: paystackPublicKey,
        paystackEnabled: paystackEnabled,
        checkerPrice: settings.checkerPrice,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        websiteName: process.env.WEBSITE_NAME || 'AncestorDataHub'
      }
    });
  } catch (err) {
    next(err);
  }
};
