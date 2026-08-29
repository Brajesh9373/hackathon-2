/**
 * Moderation Routes
 * API endpoints for fact-checking and misinformation detection
 */

const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/moderationController');
const { authenticate } = require('../middleware/auth');

// Public routes (for citizens to report misinformation)
router.post('/report', moderationController.reportMisinformation);

// Protected routes (moderators only)
router.get('/claims', authenticate, moderationController.getPendingClaims);
router.get('/claims/:claimId/verify', authenticate, moderationController.verifyClaim);
router.post('/claims/:claimId/moderate', authenticate, moderationController.moderateClaim);
router.get('/coordinated-fakes', authenticate, moderationController.checkCoordinatedFakes);
router.get('/fact-check/:claimId', authenticate, moderationController.getFactCheck);
router.get('/stats', authenticate, moderationController.getStats);

module.exports = router;
