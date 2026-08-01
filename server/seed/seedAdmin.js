// Run with: npm run seed
// Creates your first admin account. Run `npm run sync-packages` separately
// (and any time after) to load/refresh real bundle pricing from iDataGH.
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import { generateReferralCode } from "../utils/generateRef.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const adminPhone = process.env.ADMIN_PHONE || "0500000000";
  const adminExists = await User.findOne({ phone: adminPhone });

  if (!adminExists) {
    await User.create({
      name: "Admin",
      phone: adminPhone,
      pin: process.env.ADMIN_PIN || "1234",
      role: "admin",
      referralCode: generateReferralCode("ADMIN"),
    });
    console.log(`Admin user created: ${adminPhone}`);
  } else {
    console.log("Admin user already exists");
  }

  mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
