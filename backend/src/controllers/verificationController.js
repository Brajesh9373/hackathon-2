/**
 * Vapi AI Verification Controller
 * Handles outbound calls to citizens to verify complaint resolution
 */
const Complaint = require('../models/Complaint');
const fs = require('fs');
const path = require('path');
const { processVerificationResult } = require('./complaintController');

// Verification state file
const VERIFICATION_FILE = path.join(__dirname, '../../../.civic-verification.json');

// Vapi configuration
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || 'eedb4653-e435-4885-873a-5aae7dd4d257';
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || '3a0ba65f-f19d-492b-8ea7-70f8e3ffc900';

// Load verification state
function loadVerificationState() {
  try {
    if (fs.existsSync(VERIFICATION_FILE)) {
      const data = fs.readFileSync(VERIFICATION_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading verification state:', e.message);
  }
  return {};
}

// Save verification state
function saveVerificationState(state) {
  try {
    fs.writeFileSync(VERIFICATION_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error('Error saving verification state:', e.message);
  }
}

// Normalize phone number to E.164 format
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}

// Classify caller answer from transcript
function classifyAnswer(transcript) {
  if (!transcript) return 'unresolved';
  
  // Extract only caller turns (all of them)
  const callerTurns = [
    ...transcript.matchAll(/(?:user|customer|caller)\s*:\s*([^\n]+)/gi)
  ].map(match => match[1].toLowerCase().trim());
  
  console.log('All caller turns:', callerTurns);
  
  // Check ALL caller turns for negative responses FIRST
  const negativePatterns = ['no', 'not done', 'not completed', 'not resolved',
    'still broken', 'unfinished', 'incomplete', 'unresolved',
    'pending', 'nah', 'nope', 'not really', 'nothing'];
  
  for (const utterance of callerTurns) {
    if (negativePatterns.some(p => utterance.includes(p))) {
      console.log('Found negative response:', utterance);
      return 'unresolved';
    }
  }
  
  // Then check for positive responses
  const positivePatterns = ['yes', 'yeah', 'yep', 'yup', 'done', 'completed',
    'complete', 'resolved', 'fixed', 'finished', 'okay',
    'ok', 'all done', 'everything done', 'sorted'];
  
  for (const utterance of callerTurns) {
    if (positivePatterns.some(p => utterance.includes(p))) {
      console.log('Found positive response:', utterance);
      return 'confirmed';
    }
  }
  
  // Default to unresolved if no clear response
  return 'unresolved';
}

// Make.com webhook (optional)
async function notifyMakeWebhook(complaintId, data) {
  const webhookUrl = process.env.MAKE_WORK_DONE_WEBHOOK_URL;
  if (!webhookUrl) return null;
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MAKE_API_TOKEN || ''}`
      },
      body: JSON.stringify({ complaintId, ...data })
    });
    return response.ok ? await response.json() : null;
  } catch (e) {
    console.error('Make webhook error:', e.message);
    return null;
  }
}

// Start verification call
exports.startVerification = async (req, res) => {
  try {
    const { complaintId, citizenPhone, title, location, completionNotes, evidence } = req.body;
    
    if (!complaintId || !citizenPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find complaint
    const complaint = await Complaint.findOne({ complaint_id: complaintId });
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    // Normalize phone
    const phone = normalizePhone(citizenPhone);
    
    // Update complaint status
    complaint.status = 'AWAITING_VERIFICATION';
    complaint.verification = {
      status: 'calling',
      initiated_at: new Date(),
      completion_notes: completionNotes || '',
      evidence: evidence || ''
    };
    await complaint.save();
    
    // Save to verification state
    const state = loadVerificationState();
    state[complaintId] = {
      status: 'calling',
      callId: null,
      startedAt: new Date().toISOString(),
      phone,
      title,
      location
    };
    saveVerificationState(state);
    
    // Try Make webhook first if configured
    const makeResult = await notifyMakeWebhook(complaintId, {
      phone,
      title,
      location,
      completionNotes,
      evidence,
      callbackUrl: `${process.env.PUBLIC_CALLBACK_URL || 'http://localhost:8791'}/api/verification/result`
    });
    
    if (makeResult && makeResult.callId) {
      // Make handled it
      state[complaintId].callId = makeResult.callId;
      saveVerificationState(state);
      
      return res.status(202).json({
        ok: true,
        provider: 'make',
        callId: makeResult.callId
      });
    }
    
    // Direct Vapi call fallback
    const vapiToken = process.env.VAPI_SERVER_PRIVATE_KEY;
    if (!vapiToken) {
      return res.status(500).json({ error: 'Vapi not configured' });
    }
    
    // Build first message
    const firstMessage = `Hello, this is Kopargaon Municipal Council calling about the complaint ${title || 'report'} at ${location || 'your location'}. Our field worker has marked the work done. Has the issue been fully completed and resolved? Please answer yes or no.`;
    
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
        customer: {
          number: phone
        },
        assistantOverrides: {
          firstMessage
        }
      })
    });
    
    if (!vapiResponse.ok) {
      const error = await vapiResponse.text();
      console.error('Vapi error:', error);
      
      // Revert status
      complaint.status = 'COMPLETED';
      complaint.verification = { status: 'pending' };
      await complaint.save();
      
      return res.status(500).json({ error: 'Failed to initiate call', details: error });
    }
    
    const callData = await vapiResponse.json();
    
    // Update state with call ID
    state[complaintId].callId = callData.id;
    saveVerificationState(state);
    
    // Update complaint
    complaint.verification.call_id = callData.id;
    await complaint.save();
    
    return res.status(202).json({
      ok: true,
      provider: 'vapi',
      callId: callData.id
    });
    
  } catch (error) {
    console.error('Verification start error:', error);
    res.status(500).json({ error: 'Failed to start verification' });
  }
};

// Get verification result
exports.getVerification = async (req, res) => {
  try {
    const { complaintId } = req.params;
    
    // Check saved state first
    const state = loadVerificationState();
    const saved = state[complaintId];
    
    if (!saved) {
      // Check database
      const complaint = await Complaint.findOne({ complaint_id: complaintId });
      if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found' });
      }
      
      if (complaint.verification && complaint.verification.status) {
        return res.json({
          decision: complaint.verification.status === 'calling' ? 'pending' : complaint.verification.status,
          callId: complaint.verification.call_id,
          transcript: complaint.verification.transcript
        });
      }
      
      return res.json({ decision: 'pending' });
    }
    
    // Poll Vapi for call status if we have a call ID
    if (saved.callId) {
      const vapiToken = process.env.VAPI_SERVER_PRIVATE_KEY;
      
      try {
        const vapiResponse = await fetch(`https://api.vapi.ai/call/${saved.callId}`, {
          headers: { 'Authorization': `Bearer ${vapiToken}` }
        });
        
        if (vapiResponse.ok) {
          const callData = await vapiResponse.json();
          console.log('Vapi response:', callData.status, callData.endedReason);
          
          // Check if call is completed (Vapi returns 'ended' with endedReason)
          if ((callData.status === 'ended' || callData.status === 'completed') && callData.endedReason) {
            console.log('Processing call completion, transcript:', (callData.transcript || '').substring(0, 200));
            const decision = classifyAnswer(callData.transcript || '');
            
            // Update state
            saved.status = decision;
            saved.completedAt = new Date().toISOString();
            saved.transcript = callData.transcript;
            saveVerificationState(state);
            
            // Update complaint
            const complaint = await Complaint.findOne({ complaint_id: complaintId });
            if (complaint) {
              complaint.verification.status = decision;
              complaint.verification.completed_at = new Date();
              complaint.verification.transcript = callData.transcript;
              
              if (decision === 'confirmed') {
                complaint.status = 'COMPLETED';
                complaint.citizen_confirmation = {
                  response: 'CONFIRMED',
                  confirmed_at: new Date()
                };
              } else {
                complaint.status = 'ASSIGNED'; // Return to supervisor
                complaint.citizen_confirmation = {
                  response: 'NOT_FIXED',
                  responded_at: new Date()
                };
                // Add follow-up
                complaint.follow_up_requests.push({
                  reason: 'INCOMPLETE',
                  citizen_note: 'Citizen reported work not completed via phone verification',
                  requested_at: new Date(),
                  status: 'PENDING'
                });
              }
              await complaint.save();
            }
            
            return res.json({
              decision,
              callId: saved.callId,
              transcript: callData.transcript
            });
          }
        }
      } catch (e) {
        console.error('Vapi poll error:', e.message);
      }
    }
    
    // Return current state
    return res.json({
      decision: saved.status === 'calling' ? 'pending' : saved.status,
      callId: saved.callId,
      transcript: saved.transcript
    });
    
  } catch (error) {
    console.error('Get verification error:', error);
    res.status(500).json({ error: 'Failed to get verification status' });
  }
};

// Callback endpoint for external verification (Make, etc.)
exports.receiveResult = async (req, res) => {
  try {
    const token = req.headers['x-civic-callback-token'];
    const expectedToken = process.env.CIVIC_CALLBACK_TOKEN;
    
    if (expectedToken && token !== expectedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const { complaintId, decision, transcript } = req.body;
    
    if (!complaintId || !decision) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['confirmed', 'unresolved'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }
    
    // Update state
    const state = loadVerificationState();
    if (state[complaintId]) {
      state[complaintId].status = decision;
      state[complaintId].completedAt = new Date().toISOString();
      state[complaintId].transcript = transcript;
      saveVerificationState(state);
    }
    
    // Update complaint
    const complaint = await Complaint.findOne({ complaint_id: complaintId });
    if (complaint) {
      complaint.verification.status = decision;
      complaint.verification.completed_at = new Date();
      complaint.verification.transcript = transcript;
      
      if (decision === 'confirmed') {
        complaint.status = 'COMPLETED';
        complaint.citizen_confirmation = {
          response: 'CONFIRMED',
          confirmed_at: new Date()
        };
      } else {
        complaint.status = 'ASSIGNED';
        complaint.citizen_confirmation = {
          response: 'NOT_FIXED',
          responded_at: new Date()
        };
        complaint.follow_up_requests.push({
          reason: 'INCOMPLETE',
          citizen_note: 'Citizen reported work not completed',
          requested_at: new Date(),
          status: 'PENDING'
        });
      }
      await complaint.save();
    }
    
    return res.json({ ok: true });
    
  } catch (error) {
    console.error('Receive result error:', error);
    res.status(500).json({ error: 'Failed to process result' });
  }
};

// Initialize verification state from database on startup
exports.initVerificationState = async () => {
  try {
    // Find all complaints with pending/calling verification
    const pendingComplaints = await Complaint.find({
      'verification.status': { $in: ['pending', 'calling'] },
      status: 'AWAITING_VERIFICATION'
    });
    
    const state = loadVerificationState();
    let updated = false;
    
    for (const complaint of pendingComplaints) {
      if (!state[complaint.complaint_id]) {
        state[complaint.complaint_id] = {
          status: complaint.verification.status,
          callId: complaint.verification.call_id,
          startedAt: complaint.verification.initiated_at?.toISOString(),
          phone: complaint.citizen_mobile,
          title: complaint.complaint_text.substring(0, 50),
          location: complaint.location?.address || complaint.location?.ward
        };
        updated = true;
      }
    }
    
    if (updated) {
      saveVerificationState(state);
      console.log(`Initialized ${pendingComplaints.length} pending verifications`);
    }
  } catch (e) {
    console.error('Error initializing verification state:', e.message);
  }
};
