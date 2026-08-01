import express from "express";
import { getBundles, createBundle, updateBundle, deleteBundle } from "../controllers/bundleController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getBundles);
router.post("/", protect, admin, createBundle);
router.put("/:id", protect, admin, updateBundle);
router.delete("/:id", protect, admin, deleteBundle);

export default router;
