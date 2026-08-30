const Complaint = require('../models/Complaint');
const User = require('../models/User');
const mongoose = require('mongoose');
const { calculatePriority, getPriorityLabel, getModuleFromCategory } = require('../services/priorityEngine');
const { evaluateComplaint } = require('../services/priorityIntegration');
const { createCaseOfficer, recordCaseEvent } = require('../services/complaintAgent');
const { appendLedgerEvent } = require('../services/recoveryLedgerService');

function savePriorityResult(complaint, result) {
  const priority = result?.priority || {};
  const breakdown = priority.breakdown || {};
  if (!Number.isFinite(Number(priority.score))) return false;

  complaint.priority_score = Number(priority.score);
  complaint.priority_breakdown = {
    severity_pct: Number(breakdown.urgency || 0),
    safety_pct: Number(breakdown.risk || 0),
    impact_pct: Number(breakdown.impact || 0),
    location_pct: Number(breakdown.context || 0),
    age_pct: Number(breakdown.time || 0),
    repeat_pct: 0,
    weather_pct: 0
  };
  complaint.priority_reason = result.explanation?.summary || `${priority.band || 'MEDIUM'} priority issue (${priority.score}/100).`;
  return true;
}

// Generate unique complaint ID
function generateComplaintId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `KCP-${dateStr}-${random}`;
}

// Queue links use the human-readable KCP id, while older screens may send
// Mongo's _id. Resolve both consistently for every complaint action.
function complaintQuery(id) {
  return mongoose.isValidObjectId(id)
    ? { $or: [{ _id: id }, { complaint_id: id }] }
    : { complaint_id: id };
}

function normalizePhoneNumber(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return raw.startsWith('+') ? `+${digits}` : digits;
}

// File a new complaint (Citizen)
exports.fileComplaint = async (req, res) => {
  try {
    const { complaint_text, category, location, media_urls, source, impact_factors } = req.body;
    
    if (!complaint_text || !category) {
      return res.status(400).json({ error: 'Complaint text and category are required' });
    }
    
    // Determine module (DEVELOPMENT or WASTE)
    const complaintModule = getModuleFromCategory(category);
    
    // Create basic complaint data
    const complaintData = {
      complaint_id: generateComplaintId(),
      citizen_id: req.user._id,
      citizen_name: req.user.name,
      citizen_mobile: req.user.mobile,
      complaint_text,
      media_urls: media_urls || [],
      location: location || {},
      category,
      module: complaintModule,
      impact_factors: impact_factors || {},
      status: 'FILED',
      source: source || 'web',
      timeline: [{
        event: 'Complaint filed',
        actor_id: req.user._id,
        actor_name: req.user.name,
        actor_role: 'citizen',
        note: `Filed via ${source || 'web'}`,
        timestamp: new Date()
      }]
    };
    
    const complaint = await Complaint.create(complaintData);
    
    // Use the same civic decision engine that powers supervisor explanations,
    // so the persisted score and queue ordering cannot drift apart. Keep the
    // legacy calculator as a safe fallback for a malformed submission.
    try {
      const priorityResult = await evaluateComplaint(complaint);
      if (!savePriorityResult(complaint, priorityResult)) throw new Error('Engine returned no score');
    } catch (priorityError) {
      console.error('Priority engine fallback:', priorityError.message);
      const priorityResult = calculatePriority(complaint);
      complaint.priority_score = priorityResult.priority_score;
      complaint.priority_breakdown = priorityResult.priority_breakdown;
      complaint.priority_reason = priorityResult.priority_reason;
    }
    
    // Set SLA deadline (48 hours default)
    complaint.sla_deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    
    await complaint.save();
    appendLedgerEvent({ aggregateType: 'Complaint', aggregateId: complaint._id, eventType: 'COMPLAINT_FILED', actor: req.user.name || 'citizen', payload: { complaint_id: complaint.complaint_id, complaint_text, category, location: location || {}, priority_score: complaint.priority_score } });
    await createCaseOfficer(complaint, { actor: req.user.name || 'citizen' }).catch(error => console.error('Case officer creation failed:', error.message));
    
    res.status(201).json({
      success: true,
      complaint: {
        complaint_id: complaint.complaint_id,
        status: complaint.status,
        priority_score: complaint.priority_score,
        priority_reason: complaint.priority_reason,
        module: complaint.module
      }
    });
  } catch (err) {
    console.error('File complaint error:', err);
    res.status(500).json({ error: 'Failed to file complaint' });
  }
};

// List complaints (role-filtered)
exports.listComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, module, category, ward, search, sort = '-priority_score' } = req.query;
    const filter = {};
    
    // Role-based filtering
    switch (req.user.role) {
      case 'citizen':
        filter.citizen_id = req.user._id;
        break;
      case 'supervisor':
        filter.assigned_supervisor_id = req.user._id;
        break;
      case 'worker':
        filter.assigned_worker_id = req.user._id;
        break;
      // admin and super_admin see all
    }
    
    // Additional filters
    if (status) filter.status = status;
    if (module) filter.module = module;
    if (category) filter.category = category;
    if (ward) filter['location.ward'] = ward;
    if (search) {
      filter.$or = [
        { complaint_id: { $regex: search, $options: 'i' } },
        { complaint_text: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const complaints = await Complaint.find(filter)
      .populate('assigned_supervisor_id', 'name')
      .populate('assigned_worker_id', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Complaint.countDocuments(filter);
    
    // Get status counts
    const statusCounts = {};
    const statusAgg = await Complaint.aggregate([
      { $match: { ...filter, ...(req.user.role === 'supervisor' ? { assigned_supervisor_id: req.user._id } : {}) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    statusAgg.forEach(s => { statusCounts[s._id] = s.count; });
    
    res.json({
      complaints,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      statusCounts
    });
  } catch (err) {
    console.error('List complaints error:', err);
    res.status(500).json({ error: 'Failed to list complaints' });
  }
};

// Get complaint detail
exports.getComplaint = async (req, res) => {
  try {
    const lookup = mongoose.isValidObjectId(req.params.id)
      ? { $or: [{ _id: req.params.id }, { complaint_id: req.params.id }] }
      : { complaint_id: req.params.id };
    const complaint = await Complaint.findOne(lookup)
      .populate('citizen_id', 'name mobile')
      .populate('assigned_supervisor_id', 'name')
      .populate('assigned_worker_id', 'name');
    
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    // Check access
    if (req.user.role === 'citizen' && String(complaint.citizen_id?._id) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'worker' && String(complaint.assigned_worker_id?._id) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ complaint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get complaint' });
  }
};

// Get citizen's own complaints
exports.myComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ citizen_id: req.user._id })
      .populate('assigned_supervisor_id', 'name')
      .populate('assigned_worker_id', 'name')
      .sort('-createdAt');
    
    res.json({ complaints });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get complaints' });
  }
};

// Assign complaint to supervisor (Admin only)
exports.assignToSupervisor = async (req, res) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only an admin can assign supervisors' });
    }

    const { supervisorId } = req.body;
    
    if (!supervisorId) {
      return res.status(400).json({ error: 'Supervisor ID is required' });
    }
    
    const supervisor = await User.findById(supervisorId);
    if (!supervisor || supervisor.role !== 'supervisor') {
      return res.status(400).json({ error: 'Invalid supervisor' });
    }
    
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    complaint.assigned_supervisor_id = supervisor._id;
    complaint.assigned_supervisor_name = supervisor.name;
    complaint.assigned_at = new Date();
    complaint.status = 'ASSIGNED';
    complaint.timeline.push({
      event: 'Assigned to Supervisor',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: req.user.role,
      note: `Assigned to ${supervisor.name}`,
      timestamp: new Date()
    });
    
    await complaint.save();
    await recordCaseEvent(complaint._id, { type: 'SUPERVISOR_ASSIGNED', summary: `Routed to ${supervisor.name}`, next_action: 'Supervisor should assign a field worker', actor: req.user.name || 'admin', metadata: { supervisor_id: supervisor._id } }).catch(() => null);
    
    res.json({ success: true, complaint });
  } catch (err) {
    console.error('Assign to supervisor error:', err);
    res.status(500).json({ error: 'Failed to assign complaint' });
  }
};

// Update priority (Supervisor can approve/override)
exports.updatePriority = async (req, res) => {
  try {
    const { priority_score, priority_reason } = req.body;
    
    if (priority_score === undefined) {
      return res.status(400).json({ error: 'Priority score is required' });
    }
    
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    const oldScore = complaint.priority_score;
    complaint.priority_score = priority_score;
    if (priority_reason) {
      complaint.priority_reason = priority_reason;
    }
    
    complaint.timeline.push({
      event: 'Priority Updated',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: req.user.role,
      note: `Priority changed from ${oldScore} to ${priority_score}. Reason: ${priority_reason || 'Supervisor review'}`,
      timestamp: new Date()
    });
    
    await complaint.save();
    
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update priority' });
  }
};

// Assign worker to complaint (Supervisor only)
exports.assignWorker = async (req, res) => {
  try {
    const { workerId, equipment } = req.body;

    if (req.user.role !== 'supervisor') {
      return res.status(403).json({ error: 'Only a supervisor can assign field workers' });
    }
    
    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }
    
    const worker = await User.findById(workerId);
    if (!worker || worker.role !== 'worker') {
      return res.status(400).json({ error: 'Invalid worker' });
    }
    
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    if (String(complaint.assigned_supervisor_id || '') !== String(req.user._id)) {
      return res.status(403).json({ error: 'This complaint belongs to another supervisor' });
    }

    const previousWorkerId = complaint.assigned_worker_id;
    if (previousWorkerId && String(previousWorkerId) !== String(worker._id)) {
      await User.findByIdAndUpdate(previousWorkerId, {
        $inc: { 'worker_profile.active_tasks': -1 },
        $set: { 'worker_profile.status': 'AVAILABLE' },
        $unset: { 'worker_profile.current_task_id': 1 }
      });
    }
    
    complaint.assigned_worker_id = worker._id;
    complaint.assigned_worker_name = worker.name;
    complaint.worker_assigned_at = new Date();
    // Assignment and work-start are separate events. The worker sees an
    // assigned task first, then explicitly starts it from their portal.
    complaint.status = 'ASSIGNED';
    if (equipment) {
      complaint.assigned_equipment = equipment;
    }
    
    // Keep the supervisor/worker directory relationship in sync as part of
    // the assignment, so the next queue load shows the real worker name.
    await User.findByIdAndUpdate(workerId, {
      $inc: { 'worker_profile.active_tasks': previousWorkerId && String(previousWorkerId) === String(worker._id) ? 0 : 1 },
      $set: { supervisor_id: req.user._id, 'worker_profile.current_task_id': complaint._id, 'worker_profile.status': 'ON_TASK' },
    });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { assigned_workers: worker._id } });
    
    complaint.timeline.push({
      event: 'Worker Assigned',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: req.user.role,
      note: `Assigned to worker ${worker.name}`,
      timestamp: new Date()
    });
    
    await complaint.save();
    await recordCaseEvent(complaint._id, { type: 'WORKER_ASSIGNED', summary: `Assigned to ${worker.name}`, next_action: 'Worker should start field work', actor: req.user.name || 'supervisor', metadata: { worker_id: worker._id } }).catch(() => null);
    
    res.json({ success: true, complaint });
  } catch (err) {
    console.error('Assign worker error:', err);
    res.status(500).json({ error: 'Failed to assign worker' });
  }
};

// Start work on complaint (Worker)
exports.startWork = async (req, res) => {
  try {
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    // Verify this worker is assigned
    if (String(complaint.assigned_worker_id) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not assigned to you' });
    }

    if (complaint.status === 'IN_PROGRESS') {
      return res.json({ success: true, complaint });
    }
    if (complaint.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'This complaint is not ready to start' });
    }

    complaint.status = 'IN_PROGRESS';
    
    complaint.timeline.push({
      event: 'Work Started',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: 'worker',
      note: 'Worker has started work on this complaint',
      timestamp: new Date()
    });
    
    await complaint.save();
    await recordCaseEvent(complaint._id, { type: 'WORK_STARTED', summary: 'Worker started field work', next_action: 'Wait for a completion proposal', actor: req.user.name || 'worker' }).catch(() => null);
    
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start work' });
  }
};

// Complete work (Worker) - Initiates AI verification call
exports.completeWork = async (req, res) => {
  try {
    const { resolution_note, resolution_photos, geofence } = req.body;
    
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    // Verify this worker is assigned
    if (String(complaint.assigned_worker_id) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not assigned to you' });
    }

    if (complaint.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Start work before submitting completion' });
    }
    
    // Store resolution data
    complaint.resolution = {
      resolution_photos: (resolution_photos || [])
        .map(p => ({
          url: p?.url || p,
          gps: p?.gps,
          uploaded_at: new Date()
        }))
        .filter(photo => typeof photo.url === 'string' && photo.url.trim().length > 0),
      resolution_note,
      completed_at: new Date(),
      completed_by: req.user._id
    };
    
    complaint.timeline.push({
      event: 'Work Completed - Initiating Verification',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: 'worker',
      note: resolution_note || 'Work completed, verification call initiated',
      timestamp: new Date()
    });
    
    await complaint.save();
    await recordCaseEvent(complaint._id, { type: 'WORK_SUBMITTED', summary: 'Worker submitted a completion proposal', next_action: 'Citizen verification call must receive a yes', actor: req.user.name || 'worker' }).catch(() => null);

    // The field visit is complete even while the citizen verification call is
    // pending. Release the worker so the supervisor can allocate the next
    // task without waiting for a phone response.
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'worker_profile.status': 'AVAILABLE' },
      $unset: { 'worker_profile.current_task_id': 1 }
    });
    await User.updateOne(
      { _id: req.user._id, 'worker_profile.active_tasks': { $gt: 0 } },
      { $inc: { 'worker_profile.active_tasks': -1 } }
    );
    
    // Initiate AI verification call
    const verificationResult = await initiateVerification(complaint, resolution_note, resolution_photos, geofence);
    
    res.status(202).json({
      success: true,
      verification: verificationResult,
      complaint
    });
  } catch (err) {
    console.error('Complete work error:', err);
    res.status(500).json({ error: 'Failed to complete work' });
  }
};

// Initiate verification call
async function initiateVerification(complaint, resolution_note, resolution_photos, geofence = null) {
  const fs = require('fs');
  const path = require('path');
  
  // Normalize phone
  const normalizedPhone = normalizePhoneNumber(complaint.citizen_mobile);
  
  // Build location string
  const locationStr = complaint.location?.address || 
    (complaint.location?.ward ? `Ward: ${complaint.location.ward}` : 'Kopargaon');
  
  // Build title from category
  const categoryLabels = {
    'BLOCKED_DRAIN': 'Blocked Drain',
    'BLOCKED_SEWAGE': 'Sewage Overflow',
    'POTHOLE': 'Pothole',
    'MANHOLE_ISSUE': 'Manhole Issue',
    'ROAD_DAMAGE': 'Road Damage',
    'FLOODING': 'Flooding',
    'WATER_LOGGING': 'Water Logging',
    'STREETLIGHT': 'Street Light Issue',
    'ELECTRICITY': 'Electricity Issue',
    'GARBAGE_NOT_COLLECTED': 'Garbage Collection',
    'BIN_OVERFLOW': 'Bin Overflow',
    'ILLEGAL_DUMPING': 'Illegal Dumping',
    'WASTE_ACCUMULATION': 'Waste Accumulation',
    'MISSED_COLLECTION': 'Missed Collection',
    'OTHER': 'Civic Issue'
  };
  const title = categoryLabels[complaint.category] || 'Civic Issue';
  
  // Evidence string
  const evidenceStr = resolution_photos?.length > 0 ? 'Photo evidence attached' : 'No photo';
  
  // Save verification state
  const stateFile = path.join(__dirname, '../../../.civic-verification.json');
  let state = {};
  try {
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
  } catch (e) {}
  
  // Radar is a safety gate, not a decoration. A call is only allowed when the
  // client has checked the citizen's complaint location and explicitly passed
  // the result to this endpoint.
  if (!geofence || geofence.canCall !== true) {
    const reason = geofence?.reason || 'Citizen location was not verified';
    complaint.status = 'AWAITING_VERIFICATION';
    complaint.verification = {
      status: 'pending',
      initiated_at: new Date(),
      completion_notes: resolution_note || '',
      evidence: `Automated call held: ${reason}`
    };
    await complaint.save();
    state[complaint.complaint_id] = {
      status: 'pending',
      callId: null,
      startedAt: new Date().toISOString(),
      phone: normalizedPhone,
      title,
      location: locationStr,
      blockedReason: reason
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    return { provider: 'blocked', callId: null, blocked: true, reason };
  }

  // The webhook and direct Vapi implementation are deliberately kept behind
  // the same safety gate. Make is preferred when configured, with Vapi as a
  // direct fallback for local development or a temporarily unavailable
  // scenario.
  const vapiToken = process.env.VAPI_SERVER_PRIVATE_KEY;
  const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || 'eedb4653-e435-4885-873a-5aae7dd4d257';
  const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || '3a0ba65f-f19d-492b-8ea7-70f8e3ffc900';
  
  const firstMessage = `Hello, this is Kopargaon Municipal Council calling about the complaint ${title} at ${locationStr}. Our field worker has marked the work done. Has the issue been fully completed and resolved? Please answer yes or no.`;
  
  let callId = null;
  let provider = 'none';
  let providerError = '';

  const callbackUrl = `${process.env.PUBLIC_CALLBACK_URL || 'http://localhost:8791'}/api/verification/result`;
  const verificationPayload = {
    complaintId: complaint.complaint_id,
    phone: normalizedPhone,
    title,
    location: locationStr,
    completionNotes: resolution_note || '',
    evidence: evidenceStr,
    callbackUrl
  };

  const makeWebhook = process.env.MAKE_WORK_DONE_WEBHOOK_URL;
  if (makeWebhook) {
    try {
      const makeResponse = await fetch(makeWebhook, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MAKE_API_TOKEN || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(verificationPayload)
      });
      const makeText = await makeResponse.text();
      let makeData = {};
      try { makeData = makeText ? JSON.parse(makeText) : {}; } catch (e) { /* non-JSON webhook acknowledgements are valid */ }
      if (makeResponse.ok) {
        callId = makeData.callId || makeData.call_id || makeData.id || null;
        if (callId) { provider = 'make'; providerError = ''; }
        else providerError = 'Make accepted the event but did not return a call id.';
      } else {
        providerError = `Make webhook failed (${makeResponse.status}).`;
      }
    } catch (e) {
      providerError = `Make webhook unavailable: ${e.message}`;
      console.error('Make webhook error:', e.message);
    }
  }
  
  if (!callId && vapiToken) {
    try {
      const vapiResponse = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vapiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          type: 'outboundPhoneCall',
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          customer: { number: normalizedPhone },
          assistantOverrides: { firstMessage }
        })
      });
      
      if (vapiResponse.ok) {
        const callData = await vapiResponse.json();
        callId = callData.id;
        provider = 'vapi';
        providerError = '';
      } else {
        providerError = `Vapi rejected the call (${vapiResponse.status}).`;
        console.error('Vapi call failed:', vapiResponse.status, await vapiResponse.text());
      }
    } catch (e) {
      providerError = `Vapi call unavailable: ${e.message}`;
      console.error('Vapi call error:', e.message);
    }
  } else if (!callId && !vapiToken && !makeWebhook) {
    providerError = 'No Make webhook or Vapi server key is configured.';
  }
  
  // Update complaint status
  complaint.status = 'AWAITING_VERIFICATION';
  complaint.verification = {
    status: callId ? 'calling' : 'pending',
    call_id: callId,
    initiated_at: new Date(),
    completion_notes: resolution_note || '',
    evidence: callId ? evidenceStr : `Automated verification call could not be started. ${providerError}`
  };
  await complaint.save();
  
  // Save state
  state[complaint.complaint_id] = {
    status: callId ? 'calling' : 'pending',
    callId,
    startedAt: new Date().toISOString(),
    phone: normalizedPhone,
    title,
    location: locationStr,
    ...(providerError ? { blockedReason: providerError } : {})
  };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  
  return { provider, callId, ...(providerError ? { error: providerError } : {}) };
}

// Process verification result (called by polling or webhook)
async function processVerificationResult(complaintId, callData) {
  const complaint = await Complaint.findOne({ complaint_id: complaintId });
  if (!complaint) return;
  
  // Extract caller answer from transcript
  const transcript = callData.transcript || '';
  const callerTurns = [...transcript.matchAll(/(?:user|customer|caller)\s*:\s*([^\n]+)/gi)]
    .map(m => m[1]);
  const lastAnswer = (callerTurns.at(-1) || '').toLowerCase().trim();
  
  // Classify
  const unresolvedPatterns = ['no', 'not done', 'not completed', 'not resolved', 
    'still broken', 'unfinished', 'incomplete', 'unresolved', 'pending', 'nah', 'nope'];
  const confirmedPatterns = ['yes', 'yeah', 'yep', 'yup', 'done', 'completed', 
    'complete', 'resolved', 'fixed', 'finished', 'okay', 'ok', 'all done'];
  
  // Only an explicit positive answer can close a complaint. Ambiguous or
  // missing transcripts stay unresolved and return to the supervisor queue.
  let decision = ['confirmed', 'unresolved'].includes(callData.decision) ? callData.decision : 'unresolved';
  if (decision === 'unresolved' && unresolvedPatterns.some(p => lastAnswer.includes(p))) {
    decision = 'unresolved';
  } else if (!['confirmed', 'unresolved'].includes(callData.decision) && confirmedPatterns.some(p => lastAnswer.includes(p))) {
    decision = 'confirmed';
  }
  
  // Update complaint. Webhooks and Vapi polling can both deliver the same
  // result, so keep the transition idempotent and never double-count work.
  const previousDecision = complaint.verification?.status;
  complaint.verification = complaint.verification || {};
  complaint.verification.status = decision;
  complaint.verification.completed_at = new Date();
  complaint.verification.transcript = transcript;
  
  if (decision === 'confirmed') {
    complaint.status = 'COMPLETED';
    complaint.citizen_confirmation = {
      response: 'CONFIRMED',
      confirmed_at: new Date()
    };
    if (complaint.assigned_worker_id && previousDecision !== 'confirmed') {
      await User.findByIdAndUpdate(complaint.assigned_worker_id, { $inc: { 'worker_profile.scorecard.total_completed': 1 } });
    }
  } else {
    complaint.status = 'ASSIGNED'; // Return to supervisor
    complaint.citizen_confirmation = {
      response: 'NOT_FIXED',
      responded_at: new Date()
    };
    if (previousDecision !== 'unresolved') {
      complaint.follow_up_requests.push({
        reason: 'INCOMPLETE',
        citizen_note: 'Citizen reported work not completed via phone verification',
        requested_at: new Date(),
        status: 'PENDING'
      });
    }
  }

  if (complaint.assigned_worker_id) {
    await User.findByIdAndUpdate(complaint.assigned_worker_id, {
      $set: { 'worker_profile.status': 'AVAILABLE' },
      $unset: { 'worker_profile.current_task_id': 1 },
    });
    // The completion endpoint normally releases the task already. Only
    // decrement legacy records that still report an active task, preventing a
    // duplicate callback from making the counter negative.
    await User.updateOne(
      { _id: complaint.assigned_worker_id, 'worker_profile.active_tasks': { $gt: 0 } },
      { $inc: { 'worker_profile.active_tasks': -1 } }
    );
  }
  
  await complaint.save();
  
  // Update state file
  const fs = require('fs');
  const path = require('path');
  const stateFile = path.join(__dirname, '../../../.civic-verification.json');
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (state[complaintId]) {
      state[complaintId].status = decision;
      state[complaintId].completedAt = new Date().toISOString();
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    }
  } catch (e) {}
  
  return decision;
}

// Export for use by verification routes
exports.processVerificationResult = processVerificationResult;

// Verify completion (Supervisor)
exports.verifyCompletion = async (req, res) => {
  try {
    const { note } = req.body;
    
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    if (complaint.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Complaint not in COMPLETED status' });
    }
    
    complaint.status = 'VERIFIED';
    complaint.resolution.supervisor_verified = true;
    complaint.resolution.supervisor_verified_at = new Date();
    complaint.resolution.supervisor_verified_by = req.user._id;
    
    // Send confirmation request to citizen
    complaint.citizen_confirmation = {
      sent_at: new Date()
    };
    
    complaint.timeline.push({
      event: 'Supervisor Verified',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: 'supervisor',
      note: note || 'Supervisor verified completion',
      timestamp: new Date()
    });
    
    await complaint.save();
    
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify completion' });
  }
};

// Citizen confirms resolution
exports.citizenConfirm = async (req, res) => {
  try {
    const { confirmed } = req.body; // true = fixed, false = not fixed
    
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    // Verify this is the citizen who filed
    if (String(complaint.citizen_id) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your complaint' });
    }
    
    if (complaint.status !== 'VERIFIED') {
      return res.status(400).json({ error: 'Complaint not ready for confirmation' });
    }
    
    complaint.citizen_confirmation = {
      sent_at: complaint.citizen_confirmation?.sent_at,
      response: confirmed ? 'CONFIRMED' : 'NOT_FIXED',
      responded_at: new Date(),
      confirmed_at: confirmed ? new Date() : undefined
    };
    
    if (confirmed) {
      complaint.status = 'CLOSED';
    } else {
      // Reopen for supervisor
      complaint.status = 'REOPENED';
      complaint.assigned_supervisor_id = null;
      complaint.assigned_worker_id = null;
    }
    
    complaint.timeline.push({
      event: confirmed ? 'Citizen Confirmed' : 'Citizen Rejected',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: 'citizen',
      note: confirmed ? 'Citizen confirmed the issue is resolved' : 'Citizen rejected - issue not resolved',
      timestamp: new Date()
    });
    
    await complaint.save();
    
    res.json({ success: true, status: complaint.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm' });
  }
};

// Request follow-up (Citizen)
exports.requestFollowUp = async (req, res) => {
  try {
    const { reason, note } = req.body;
    
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    if (String(complaint.citizen_id) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your complaint' });
    }
    
    complaint.follow_up_requests.push({
      reason: reason || 'OTHER',
      citizen_note: note,
      requested_at: new Date(),
      status: 'PENDING'
    });
    if (['AWAITING_VERIFICATION', 'COMPLETED', 'VERIFIED'].includes(complaint.status)) {
      complaint.status = 'ASSIGNED';
    }
    
    complaint.timeline.push({
      event: 'Follow-up Requested',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: 'citizen',
      note: `Reason: ${reason}. Note: ${note || 'None'}`,
      timestamp: new Date()
    });
    
    await complaint.save();
    
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to request follow-up' });
  }
};

// Add timeline note
exports.addTimeline = async (req, res) => {
  try {
    const { note, media_urls } = req.body;
    
    const complaint = await Complaint.findOne(complaintQuery(req.params.id));
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    
    complaint.timeline.push({
      event: 'Note Added',
      actor_id: req.user._id,
      actor_name: req.user.name,
      actor_role: req.user.role,
      note,
      media_urls,
      timestamp: new Date()
    });
    
    await complaint.save();
    
    res.json({ success: true, timeline: complaint.timeline });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add note' });
  }
};

// Get supervisor queue (sorted by priority)
exports.supervisorQueue = async (req, res) => {
  try {
    // Include ASSIGNED (reopened/unresolved), IN_PROGRESS, AWAITING_VERIFICATION
    const complaints = await Complaint.find({
      assigned_supervisor_id: req.user._id,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_VERIFICATION'] }
    })
      .populate('assigned_worker_id', 'name worker_profile')
      .sort('-priority_score');
    
    const availableWorkers = await User.find({
      supervisor_id: req.user._id,
      role: 'worker',
      'worker_profile.status': 'AVAILABLE'
    });
    
    res.json({
      complaints,
      availableWorkers,
      total: complaints.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get queue' });
  }
};

// Get worker tasks
exports.workerTasks = async (req, res) => {
  try {
    // Active = IN_PROGRESS (worker is working on it)
    const active = await Complaint.find({
      assigned_worker_id: req.user._id,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
    });
    
    // Completed = includes AWAITING_VERIFICATION and COMPLETED (visible in history)
    const completed = await Complaint.find({
      assigned_worker_id: req.user._id,
      status: { $in: ['AWAITING_VERIFICATION', 'COMPLETED', 'VERIFIED', 'CLOSED'] }
    }).sort('-updatedAt').limit(20);
    
    res.json({ activeTasks: active, completedTasks: completed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
};

// Duplicate check
exports.duplicateCheck = async (req, res) => {
  try {
    const { lat, lng, category } = req.query;
    if (!lat || !lng) return res.json({ duplicates: [] });
    
    const nearby = await Complaint.find({
      'location.coords': {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: 200
        }
      },
      category,
      status: { $nin: ['CLOSED'] }
    }).limit(5);
    
    res.json({ duplicates: nearby });
  } catch (err) {
    res.json({ duplicates: [] });
  }
};

// Get supervisors list (for admin)
exports.getSupervisors = async (req, res) => {
  try {
    const supervisors = await User.find({ role: 'supervisor', is_active: true })
      .select('name mobile module ward zone');
    
    const workers = await User.find({ role: 'worker', is_active: true })
      .select('name mobile supervisor_id worker_profile.status');
    
    res.json({ supervisors, workers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get users' });
  }
};

// Get dashboard stats
exports.dashboardStats = async (req, res) => {
  try {
    const baseFilter = req.user.role === 'supervisor' 
      ? { assigned_supervisor_id: req.user._id }
      : req.user.role === 'worker'
        ? { assigned_worker_id: req.user._id }
        : req.user.role === 'citizen'
          ? { citizen_id: req.user._id }
          : {};
    
    const [total, filed, assigned, inProgress, completed, verified, closed] = await Promise.all([
      Complaint.countDocuments(baseFilter),
      Complaint.countDocuments({ ...baseFilter, status: 'FILED' }),
      Complaint.countDocuments({ ...baseFilter, status: 'ASSIGNED' }),
      Complaint.countDocuments({ ...baseFilter, status: 'IN_PROGRESS' }),
      Complaint.countDocuments({ ...baseFilter, status: 'COMPLETED' }),
      Complaint.countDocuments({ ...baseFilter, status: 'VERIFIED' }),
      Complaint.countDocuments({ ...baseFilter, status: 'CLOSED' })
    ]);
    
    // Priority breakdown for assigned complaints
    const priorityBreakdown = await Complaint.aggregate([
      { $match: { ...baseFilter, status: 'ASSIGNED' } },
      { $bucket: { groupBy: '$priority_score', boundaries: [0, 50, 75, 90, 101], default: 'Other', counts: { output: { $sum: 1 } } } }
    ]);
    
    res.json({
      total, filed, assigned, inProgress, completed, verified, closed,
      priorityBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
};
