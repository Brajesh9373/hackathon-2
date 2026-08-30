const express = require('express'); const auth = require('../middleware/auth'); const c = require('../controllers/voiceIntakeController'); const router = express.Router();
router.use(auth); 
router.get('/:id', c.get); 
router.post('/start', c.start); 
router.post('/:id/result', c.result); 
router.post('/:id/confirm', c.confirm); 
module.exports = router;
