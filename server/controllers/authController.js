import User from "../models/User.js";
import Referral from "../models/Referral.js";
import generateToken from "../utils/generateToken.js";
import { generateReferralCode } from "../utils/generateRef.js";

// @desc Register new user (phone + name + 4-digit PIN)
// @route POST /api/auth/register
export const registerUser = async (req, res, next) => {
  try {
    const { name, phone, pin, referralCode } = req.body;

    if (!name || !phone || !pin) {
      return res.status(400).json({ message: "Name, phone and PIN are required" });
    }
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be exactly 4 digits" });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: "An account with this phone number already exists" });
    }

    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const user = await User.create({
      name,
      phone,
      pin,
      referralCode: generateReferralCode(name),
      referredBy,
    });

    if (referredBy) {
      await Referral.create({
        referrer: referredBy,
        referredPhone: phone,
        referredUser: user._id,
        status: "pending", // becomes "completed" after their first order
        rewardAmount: 0,
      });
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      referralCode: user.referralCode,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    next(err);
  }
};

// @desc Login with phone + PIN
// @route POST /api/auth/login
export const loginUser = async (req, res, next) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ message: "Phone and PIN are required" });
    }

    const user = await User.findOne({ phone });
    if (!user || !(await user.comparePin(pin))) {
      return res.status(401).json({ message: "Invalid phone number or PIN" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "This account has been suspended" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      walletBalance: user.walletBalance,
      referralCode: user.referralCode,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    next(err);
  }
};

// @desc Get logged-in user profile
// @route GET /api/auth/me
export const getProfile = async (req, res, next) => {
  try {
    res.json(req.user);
  } catch (err) {
    next(err);
  }
};
