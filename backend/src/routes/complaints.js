const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/complaintController');

// All routes require authentication
router.use(auth);

// Public-ish (citizen)
router.post('/', c.fileComplaint);
router.get('/my', c.myComplaints);

// List - role filtered
router.get('/', c.listComplaints);
router.get('/duplicate-check', c.duplicateCheck);

// Timeline
router.post('/:id/timeline', c.addTimeline);

// Admin routes - assign to supervisor
router.post('/:id/assign-supervisor', c.assignToSupervisor);

// Supervisor routes
router.get('/supervisor/queue', c.supervisorQueue);
router.patch('/:id/priority', c.updatePriority);
router.post('/:id/assign-worker', c.assignWorker);
router.post('/:id/verify', c.verifyCompletion);

// Worker routes
router.get('/worker/tasks', c.workerTasks);
router.post('/:id/start', c.startWork);
router.post('/:id/complete', c.completeWork);

// Citizen confirmation
router.post('/:id/confirm', c.citizenConfirm);
router.post('/:id/follow-up', c.requestFollowUp);

// Admin only
router.get('/admin/users', c.getSupervisors);
router.get('/admin/stats', c.dashboardStats);

// Detail (keep this after all named collection routes so paths such as
// /supervisor/queue and /worker/tasks are not mistaken for complaint IDs.)
router.get('/:id', c.getComplaint);

module.exports = router;
