// server/routes/dataRoutes.js
const express = require('express');
const router = express.Router();
const { getDashboardData, getUserData } = require('../controllers/dataController');

// Define your routes
router.get('/dashboard', getDashboardData);
router.get('/user', getUserData);

module.exports = router;
