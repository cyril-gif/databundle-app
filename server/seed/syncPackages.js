// Run with: npm run sync-packages
// Pulls the live package catalog from iDataGH for each network and upserts
// them into the Bundle collection, applying the markup currently set in
// Settings (adjustable anytime from the Admin dashboard). Safe to re-run any
// time their prices change — run it on a schedule (e.g. a daily cron job) to
// stay in sync with iDataGH's cost prices.
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Bundle from "../models/Bundle.js";
import Settings from "../models/Settings.js";
import { fetchPackages } from "../utils/idatagh.js";

dotenv.config();

const NETWORKS = ["MTN", "Telecel", "AirtelTigo"];

const run = async () => {
  await connectDB();

  const settings = await Settings.getSingleton();
  const markupPercent = settings.markupPercent;

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
      const sellingPrice = Math.round(pkg.price * (1 + markupPercent / 100) * 100) / 100;

      await Bundle.findOneAndUpdate(
        { network, providerPackageId: pkg.package_id },
        {
          network,
          size: `${pkg.data_size}GB`,
          sizeInMB: pkg.data_size * 1000,
          price: sellingPrice,
          providerPrice: pkg.price,
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

  console.log(`Done. ${totalSynced} bundles synced with a ${markupPercent}% markup applied.`);
  mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
