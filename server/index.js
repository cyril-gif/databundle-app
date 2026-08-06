import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { reconcilePendingOrders } from "./controllers/orderController.js";

import authRoutes from "./routes/authRoutes.js";
import bundleRoutes from "./routes/bundleRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import checkerRoutes from "./routes/checkerRoutes.js";
import referralRoutes from "./routes/referralRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import configRoutes from "./routes/configRoutes.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
// `verify` stashes the raw request body on req.rawBody so the Paystack webhook
// handler can compute an HMAC signature over the exact bytes Paystack sent.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/bundles", bundleRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checker", checkerRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/config", configRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Automatically sweep orders stuck in "processing" every 5 minutes, catching
// cases where iDataGH hadn't finished the top-up at the moment we first
// checked. This means orders update on their own — no need to click
// "Reconcile Now" manually unless you want an immediate check.
cron.schedule("*/5 * * * *", async () => {
  try {
    const results = await reconcilePendingOrders();
    if (results.length > 0) {
      console.log(`[auto-reconcile] Checked ${results.length} pending orders:`, results);
    }
  } catch (err) {
    console.error("[auto-reconcile] Failed:", err.message);
  }
});
