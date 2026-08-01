import Bundle from "../models/Bundle.js";

// @desc Get all active bundles, optionally filtered by network
// @route GET /api/bundles?network=MTN
export const getBundles = async (req, res, next) => {
  try {
    const filter = { active: true };
    if (req.query.network) filter.network = req.query.network;

    const bundles = await Bundle.find(filter).sort({ network: 1, sizeInMB: 1 });
    res.json(bundles);
  } catch (err) {
    next(err);
  }
};

// @desc Create a bundle (admin)
// @route POST /api/bundles
export const createBundle = async (req, res, next) => {
  try {
    const bundle = await Bundle.create(req.body);
    res.status(201).json(bundle);
  } catch (err) {
    next(err);
  }
};

// @desc Update a bundle (admin) - price, stock, active status
// @route PUT /api/bundles/:id
export const updateBundle = async (req, res, next) => {
  try {
    const bundle = await Bundle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!bundle) return res.status(404).json({ message: "Bundle not found" });
    res.json(bundle);
  } catch (err) {
    next(err);
  }
};

// @desc Delete a bundle (admin)
// @route DELETE /api/bundles/:id
export const deleteBundle = async (req, res, next) => {
  try {
    const bundle = await Bundle.findByIdAndDelete(req.params.id);
    if (!bundle) return res.status(404).json({ message: "Bundle not found" });
    res.json({ message: "Bundle deleted" });
  } catch (err) {
    next(err);
  }
};
