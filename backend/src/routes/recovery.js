const express = require('express'); const auth = require('../middleware/auth'); const authorize = require('../middleware/rbac'); const { verifyLedger } = require('../services/recoveryLedgerService'); const router = express.Router();
router.get('/status', auth, authorize('admin'), (req, res) => res.json({ success: true, ledger: verifyLedger(), mode: 'operational' }));
module.exports = router;
