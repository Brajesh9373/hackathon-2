'use client';

import { useEffect, useRef, useState } from 'react';
import { voiceIntake } from '../lib/api';
import { checkCoordinatesForCalling } from '../lib/geofencing';
import { InlineNotice } from './PortalBlocks';

const steps = { idle: 'Start a private call with NagarSetu. The call collects the issue and prepares a draft.', starting: 'Checking call safety and connecting you.', calling: 'NagarSetu is calling you now. Keep this page open while you speak.', draft: 'Your voice note is ready to review before submission.', confirmed: 'Your complaint is now on the municipal record.' };

export default function VoiceIntakePanel({ onConfirmed }) {
  const [state, setState] = useState('idle'); const [session, setSession] = useState(null); const [error, setError] = useState(''); const [location, setLocation] = useState(null); const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const captureAndStart = () => {
    setError(''); setState('starting');
    if (!navigator.geolocation) return setError('Location access is needed to make a safe automated call.');
    navigator.geolocation.getCurrentPosition(async position => {
      const safety = await checkCoordinatesForCalling({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocation(safety);
      if (!safety.canCall) { setState('idle'); return setError(safety.reason); }
      const result = await voiceIntake.start(safety);
      if (!result?.success) { setState('idle'); return setError(result?.error || 'Could not start the call.'); }
      setSession({ _id: result.sessionId, status: result.status }); setState('calling');
      timer.current = setInterval(async () => { const next = await voiceIntake.poll(result.sessionId); if (next?.session) { setSession(next.session); if (next.session.status === 'DRAFT_READY') { setState('draft'); clearInterval(timer.current); } } }, 5000);
    }, () => { setState('idle'); setError('Location access was not granted, so the automated call is held for safety.'); });
  };
  const confirm = async () => { setError(''); const result = await voiceIntake.confirm(session._id, session.draft); if (result?.success) { setState('confirmed'); onConfirmed?.(result.complaint); } else setError(result?.error || 'The draft could not be submitted.'); };
  return <section className="v-voice-panel" aria-live="polite"><div className="v-voice-panel-head"><div><span className="v-eyebrow">VOICE INTAKE</span><h2>Tell NagarSetu once</h2><p>{steps[state]}</p></div><span className={`v-voice-state v-voice-state-${state}`}>{state === 'calling' ? 'Call active' : state === 'draft' ? 'Review ready' : state === 'confirmed' ? 'Submitted' : 'Private call'}</span></div>{error && <InlineNotice tone="warm">{error}</InlineNotice>}{state === 'idle' && <button className="v-button v-button-primary" onClick={captureAndStart}>Start voice complaint</button>}{state === 'starting' && <button className="v-button v-button-primary" disabled>Checking safety</button>}{state === 'calling' && <div className="v-call-progress"><span className="v-call-pulse" /><div><strong>Waiting for your answer</strong><small>{session?.call_id ? `Call reference ${session.call_id}` : 'Connecting to the phone network'}</small></div></div>}{state === 'draft' && session?.draft && <div className="v-voice-draft"><div><span>Issue</span><strong>{session.draft.complaint_text || 'Needs detail'}</strong></div><div><span>Category</span><strong>{String(session.draft.category || 'Other').replace(/_/g, ' ')}</strong></div><div><span>Location</span><strong>{session.draft.location?.address || 'Needs detail'}</strong></div><button className="v-button v-button-primary" onClick={confirm}>Submit this complaint</button></div>}{state === 'confirmed' && <InlineNotice tone="success"><strong>Complaint submitted.</strong><span>Admin routing can begin now.</span></InlineNotice>}{location?.canCall && <small className="v-voice-safety">Call safety check passed</small>}</section>;
}
