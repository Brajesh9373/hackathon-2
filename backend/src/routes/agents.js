const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/agentController');
const router = express.Router();
router.use(auth);
router.get('/complaints/:id', controller.getForComplaint);
module.exports = router;
