import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 8);

// Generates order/reference codes e.g. DB-7F3K9QRT
export const generateOrderRef = (prefix = "DB") => `${prefix}-${nanoid()}`;

// Generates a referral code from a name e.g. CYRIL-4K9Q
export const generateReferralCode = (name = "USER") => {
  const clean = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 6) || "USER";
  return `${clean}-${nanoid().slice(0, 4)}`;
};
