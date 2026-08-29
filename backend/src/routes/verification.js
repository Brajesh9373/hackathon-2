/**
 * Verification Routes - AI Citizen Calling
 */
const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');

// POST /api/verification/start - Start verification call
router.post('/start', verificationController.startVerification);

// GET /api/verification/:complaintId - Get verification status
router.get('/:complaintId', verificationController.getVerification);

// POST /api/verification/result - Receive external result (Make, etc.)
router.post('/result', verificationController.receiveResult);

module.exports = router;
