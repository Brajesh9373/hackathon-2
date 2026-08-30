const ComplaintAgent = require('../models/ComplaintAgent');
const Complaint = require('../models/Complaint');

exports.getForComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ $or: [{ _id: req.params.id }, { complaint_id: req.params.id }] }).select('_id citizen_id assigned_supervisor_id assigned_worker_id').lean();
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    const role = req.user.role;
    const allowed = role === 'admin' || String(complaint.citizen_id) === String(req.user._id) || String(complaint.assigned_supervisor_id) === String(req.user._id) || String(complaint.assigned_worker_id) === String(req.user._id);
    if (!allowed) return res.status(403).json({ error: 'Not allowed to view this case officer' });
    const agent = await ComplaintAgent.findOne({ complaint_id: complaint._id }).lean();
    res.json({ success: true, agent: agent || null });
  } catch (error) { res.status(500).json({ error: 'Failed to load case officer' }); }
};
