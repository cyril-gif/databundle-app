// Run with: npm run sync-packages
// Pulls the live package catalog from iDataGH for each network and upserts
// them into the Bundle collection, applying your markup on top of their cost
// price. Safe to re-run any time their prices change — run it on a schedule
// (e.g. a daily cron job) to stay in sync.
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Bundle from "../models/Bundle.js";
import { fetchPackages } from "../utils/idatagh.js";

dotenv.config();

const NETWORKS = ["MTN", "Telecel", "AirtelTigo"];
const MARKUP_PERCENT = Number(process.env.PRICE_MARKUP_PERCENT || 8); // your profit margin, adjust freely

const run = async () => {
  await connectDB();

  let totalSynced = 0;

  for (const network of NETWORKS) {
    console.log(`Fetching ${network} packages from iDataGH...`);
    let res;
    try {
      res = await fetchPackages(network);
    } catch (err) {
      console.error(`Failed to fetch ${network} packages: ${err.message}`);
      continue;
    }

    for (const pkg of res.packages) {
      const sellingPrice = Math.round(pkg.price * (1 + MARKUP_PERCENT / 100) * 100) / 100;

      await Bundle.findOneAndUpdate(
        { network, providerPackageId: pkg.package_id },
        {
          network,
          size: `${pkg.data_size}GB`,
          sizeInMB: pkg.data_size * 1000,
          price: sellingPrice,
          providerPackageId: pkg.package_id,
          providerDataSize: pkg.data_size,
          active: true,
        },
        { upsert: true, new: true }
      );
      totalSynced++;
    }

    console.log(`Synced ${res.packages.length} ${network} packages`);
  }

  console.log(`Done. ${totalSynced} bundles synced with a ${MARKUP_PERCENT}% markup applied.`);
  mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
