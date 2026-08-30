/**
 * Verification Routes - AI Citizen Calling
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const verificationController = require('../controllers/verificationController');

// Starting a phone call is a privileged action. Keep the callback public
// (protected by CIVIC_CALLBACK_TOKEN) for Make/Vapi, but never expose call
// initiation or polling without a signed civic session.
router.post('/start', auth, authorize('worker', 'supervisor', 'admin'), verificationController.startVerification);

// GET /api/verification/:complaintId - Get verification status
router.get('/:complaintId', auth, verificationController.getVerification);

// POST /api/verification/result - Receive external result (Make, etc.)
router.post('/result', verificationController.receiveResult);

module.exports = router;
