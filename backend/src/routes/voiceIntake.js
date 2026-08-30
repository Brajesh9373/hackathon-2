const express = require('express'); const auth = require('../middleware/auth'); const c = require('../controllers/voiceIntakeController'); const router = express.Router();
router.post('/:id/result', c.result);
router.post('/start', auth, c.start);
router.get('/:id', auth, c.get);
router.post('/:id/poll', auth, c.poll);
router.post('/:id/confirm', auth, c.confirm);
module.exports = router;
