import Referral from "../models/Referral.js";
import User from "../models/User.js";

// @desc Get logged-in user's referral stats
// @route GET /api/referrals/my-stats
export const getMyReferralStats = async (req, res, next) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id }).sort({ createdAt: -1 });

    const totalReferrals = referrals.length;
    const totalEarned = referrals
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + r.rewardAmount, 0);
    const pending = referrals.filter((r) => r.status === "pending").length;

    res.json({
      referralCode: req.user.referralCode,
      referralLink: `${process.env.CLIENT_URL}/signup.html?ref=${req.user.referralCode}`,
      totalReferrals,
      totalEarned,
      pendingCount: pending,
      history: referrals,
    });
  } catch (err) {
    next(err);
  }
};

// @desc Withdraw referral earnings to wallet / MoMo
// @route POST /api/referrals/withdraw
export const withdrawEarnings = async (req, res, next) => {
  try {
    const completed = await Referral.find({ referrer: req.user._id, status: "completed", rewardAmount: { $gt: 0 } });
    const total = completed.reduce((sum, r) => sum + r.rewardAmount, 0);

    if (total <= 0) {
      return res.status(400).json({ message: "No earnings available to withdraw" });
    }

    // --- PAYOUT INTEGRATION POINT ---
    // Trigger a MoMo disbursement to req.user's registered phone here.

    await Referral.updateMany(
      { referrer: req.user._id, status: "completed", rewardAmount: { $gt: 0 } },
      { rewardAmount: 0 }
    );

    const user = await User.findById(req.user._id);
    user.walletBalance += total;
    await user.save();

    res.json({ message: `GH₵${total} withdrawn to your wallet`, amount: total });
  } catch (err) {
    next(err);
  }
};
