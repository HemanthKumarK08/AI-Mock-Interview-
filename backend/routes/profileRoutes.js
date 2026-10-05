const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');

// Protected profile routes (Candidates can only access/modify their own profile)
router.get('/', requireAuth, ProfileController.getProfile);
router.post('/', requireAuth, ProfileController.createProfile);
router.put('/', requireAuth, ProfileController.updateProfile);

module.exports = router;
