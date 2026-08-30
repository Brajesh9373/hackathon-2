'use client';

import { useEffect, useState } from 'react';
import { complaints, priority } from '../lib/api';
import { Button, ComplaintCard, EmptyState, PriorityPill, SectionHeading, StatCard, StatusPill, complaintLocation, formatDate, formatRelative } from './CivicUI';

export function PageIntro({ eyebrow, title, detail, action }) {
  return <div className="v-page-intro"><div><span className="v-eyebrow">{eyebrow}</span><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}</div>;
}

export function LoadingState({ label = 'Loading register…' }) { return <div className="v-loading" style={{ minHeight: 260 }}><div className="v-loading-mark">N</div><p>{label}</p></div>; }

export function InlineNotice({ tone = 'info', children }) { return <div className={`v-notice v-notice-${tone}`}>{children}</div>; }

export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => { let active = true; setState({ loading: true, data: null, error: '' }); loader().then(data => { if (active) setState({ loading: false, data, error: data?.error || '' }); }).catch(error => { if (active) setState({ loading: false, data: null, error: error.message || 'Something went wrong.' }); }); return () => { active = false; }; // eslint-disable-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function ComplaintQueue({ items = [], onOpen, emptyTitle = 'Nothing in this queue', emptyDetail = 'New records will appear here as the workflow moves.' }) {
  if (!items.length) return <EmptyState icon="○" title={emptyTitle} detail={emptyDetail} />;
  return <div className="v-complaints-grid">{items.map(item => <ComplaintCard key={item._id || item.complaint_id} complaint={item} onOpen={() => onOpen?.(item)} />)}</div>;
}

export function DashboardStats({ stats = {}, variant = 'default' }) {
  const cards = variant === 'citizen' ? [
    ['Open', stats.open ?? 0, 'Still moving through the network', 'teal'],
    ['Awaiting your check', stats.awaiting ?? 0, 'Review proposed resolutions', 'amber'],
    ['Completed', stats.completed ?? 0, 'Confirmed by you', 'coral'],
    ['Total filed', stats.total ?? 0, 'Your civic record', 'neutral'],
  ] : [
    ['Open demand', stats.open ?? 0, 'Needs an owner or action', 'teal'],
    ['In progress', stats.inProgress ?? 0, 'Currently in the field', 'amber'],
    ['Awaiting check', stats.awaiting ?? 0, 'Citizen verification queue', 'coral'],
    ['Completed', stats.completed ?? 0, 'Closed with evidence', 'neutral'],
  ];
  return <div className="v-stat-grid">{cards.map(([label, value, detail, tone]) => <StatCard key={label} label={label} value={value} detail={detail} tone={tone} />)}</div>;
}

export function deriveStats(items = []) {
  const statuses = items.map(item => String(item.status || '').toUpperCase());
  return {
    total: items.length,
    open: statuses.filter(status => !['COMPLETED', 'VERIFIED', 'CLOSED', 'RESOLVED', 'PROVISIONALLY_CLOSED', 'DM_VERIFIED'].includes(status)).length,
    inProgress: statuses.filter(status => ['IN_PROGRESS', 'ASSIGNED', 'REOPENED'].includes(status)).length,
    awaiting: statuses.filter(status => ['AWAITING_VERIFICATION', 'PENDING_CLOSURE', 'PROVISIONALLY_CLOSED', 'DEPT_VERIFIED', 'DM_VERIFIED'].includes(status)).length,
    completed: statuses.filter(status => ['COMPLETED', 'VERIFIED', 'CLOSED', 'RESOLVED'].includes(status)).length
  };
}

export function QueueList({ items = [], onOpen, limit = 5, showPriority = false }) {
  if (!items.length) return <EmptyState icon="⌁" title="Queue is clear" detail="As new complaints are filed, they will land here automatically." />;
  return <div className="v-list">{items.slice(0, limit).map(item => <button className="v-list-row" key={item._id || item.complaint_id} onClick={() => onOpen?.(item)}><div><strong>{item.complaint_id || 'Complaint'}</strong><p>{item.complaint_text || item.description || 'Civic request'} · {complaintLocation(item)}</p></div>{showPriority ? <PriorityPill value={item.priority_score ?? item.priority} /> : <StatusPill value={item.status} />}</button>)}</div>;
}

export function ActivityList({ timeline = [] }) {
  if (!timeline.length) return <EmptyState icon="·" title="No updates yet" detail="The first event will appear when this record is routed." />;
  return <div className="v-timeline">{timeline.slice().reverse().map((event, index) => <div className="v-timeline-item" key={`${event.timestamp || index}-${index}`}><span className="v-timeline-dot">{index === 0 ? '•' : '✓'}</span><div><strong>{event.event || 'Record updated'}</strong><p>{event.note || 'Workflow event'} · {formatRelative(event.timestamp)}</p></div></div>)}</div>;
}

export function AssignSelect({ complaint, people, busy, onAssign }) {
  const assigned = complaint?.assigned_supervisor_id?._id || complaint?.assigned_supervisor_id || complaint?.assigned_worker_id?._id || complaint?.assigned_worker_id || complaint?.assigned_officer_id?._id || complaint?.assigned_officer_id || '';
  const [selection, setSelection] = useState(String(assigned || ''));
  useEffect(() => setSelection(String(assigned || '')), [assigned]);
  const assignedPerson = people.find(person => String(person._id) === String(assigned));
  const canSubmit = Boolean(selection) && String(selection) !== String(assigned || '') && !busy;
  return <div className="v-assign"><div className="v-assign-controls"><select value={selection} onChange={e => setSelection(e.target.value)} disabled={busy || !people.length}><option value="">{people.length ? 'Select owner…' : 'No owners available'}</option>{people.map(person => <option key={person._id} value={person._id}>{person.name}</option>)}</select><button type="button" className="v-button v-button-primary" onClick={() => onAssign(complaint, selection)} disabled={!canSubmit}>{busy ? 'Saving…' : 'Assign'}</button></div>{assigned && <span className="v-assigned-label">Assigned to {assignedPerson?.name || complaint.assigned_supervisor_name || complaint.assigned_worker_name || 'selected owner'}</span>}</div>;
}

export function readList(result) { return result?.complaints || result?.data?.complaints || []; }
export function readPeople(result) { return result?.officers || result?.data?.officers || []; }
export function readSupervisors(result) { return result?.supervisors || result?.data?.supervisors || []; }
export function readWorkers(result) { return result?.workers || result?.data?.workers || result?.officers || result?.data?.officers || []; }
export function readComplaint(result) { return result?.complaint || result?.data?.complaint || null; }
export function friendlyError(error) { return error || 'We could not complete that action. Check the connection and try again.'; }

export function FieldLegend({ children }) { return <p className="v-field-legend">{children}</p>; }

export { EmptyState } from './CivicUI';

export function RouteSummary({ title = 'Today’s movement', items = [] }) {
  return <section className="v-panel"><SectionHeading eyebrow="FIELD SIGNAL" title={title} detail="A calm view of what needs attention." />{items.length ? <div className="v-list">{items.map(item => <div className="v-list-row" key={item.id || item.complaint_id}><div><strong>{item.title || item.complaint_id}</strong><p>{item.detail || complaintLocation(item)}</p></div><StatusPill value={item.status || 'ASSIGNED'} /></div>)}</div> : <EmptyState icon="⌁" title="No active movement" detail="Assigned routes will show here once a supervisor dispatches work." />}</section>;
}

function scoreBand(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  if (score >= 15) return 'LOW';
  return 'MINIMAL';
}

function titleCase(value = '') {
  return String(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function PriorityBrief({ complaint, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const evaluate = async () => {
    const id = complaint?._id || complaint?.id;
    if (!id) return setError('This record does not have a database id yet.');
    setLoading(true);
    setError('');
    const next = await priority.evaluate(id, true);
    setLoading(false);
    if (next?.success) setResult(next);
    else setError(friendlyError(next?.error));
  };

  const source = result || complaint || {};
  const explanation = result?.explanation || {};
  const decision = result?.decision || explanation.action || {};
  const priorityData = result?.priority || explanation.priority || {};
  const score = Math.max(0, Math.min(100, Number(priorityData.score ?? source.priority_score ?? 0)));
  const band = priorityData.band || scoreBand(score);
  const confidence = result?.confidence || explanation.confidence || {};
  const breakdown = priorityData.breakdown || {};
  const factors = explanation.factors || (result?.priority_reason || source.priority_reason ? [result?.priority_reason || source.priority_reason] : []);
  const reasonCodes = decision.reason_codes || [];
  const resourcesRequired = result?.resources_required || explanation.resources?.required || result?.resources?.required;
  const feasibility = result?.feasibility || explanation.feasibility;
  const summary = explanation.summary || result?.priority_reason || source.priority_reason || 'Evaluate this complaint to see the decision trail.';

  return <section className="v-priority-brief" aria-live="polite">
    <div className="v-priority-brief-head"><div><span className="v-eyebrow">DECISION BRIEF</span><h3>{complaint?.complaint_id || 'Complaint priority'}</h3></div><div className="v-priority-brief-actions">{onClose && <button className="v-button v-button-ghost" onClick={onClose}>Close</button>}<button className="v-button v-button-primary" onClick={evaluate} disabled={loading}>{loading ? 'Evaluating…' : result ? 'Re-evaluate' : 'Explain priority'}</button></div></div>
    {error && <p className="v-form-error">{error}</p>}
    <div className="v-priority-hero"><div className="v-score-ring" style={{ '--score': score }}><strong>{score}</strong><small>/100</small></div><div><div className="v-priority-line"><PriorityPill value={band} /><span className="v-confidence">{confidence.level ? `${titleCase(confidence.level)} confidence` : 'Engine score'}</span></div><p>{summary}</p></div></div>
    {result && <div className="v-priority-detail-grid"><div><span className="v-eyebrow">WHY THIS SCORE</span><div className="v-factor-list">{Object.entries(breakdown).filter(([, value]) => Number.isFinite(Number(value))).map(([key, value]) => <div className="v-factor" key={key}><div><span>{titleCase(key)}</span><b>{Math.round(Number(value))}</b></div><div className="v-factor-track"><i style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} /></div></div>)}</div>{factors.length > 0 && <div className="v-chip-row">{factors.filter(Boolean).map((factor, index) => <span className="v-reason-chip" key={`${factor}-${index}`}>{factor}</span>)}</div>}</div><div className="v-priority-decision"><span className="v-eyebrow">NEXT MOVE</span><strong>{titleCase(decision.action || decision.recommendation || 'REVIEW')}</strong><p>{decision.primary_action || decision.rationale || explanation.recommendation || 'Use the score with the field context before assigning.'}</p>{reasonCodes.length > 0 && <div className="v-chip-row">{reasonCodes.map(code => <span className="v-code-chip" key={code}>{titleCase(code)}</span>)}</div>}{resourcesRequired && <small className="v-resource-line">{resourcesRequired.workers_min ?? '-'}–{resourcesRequired.workers_preferred ?? resourcesRequired.workers_min ?? '-'} workers · {resourcesRequired.vehicles ?? 0} vehicle{resourcesRequired.vehicles === 1 ? '' : 's'} · ~{resourcesRequired.hours ?? '-'}h</small>}{feasibility?.status && <span className={`v-feasibility v-feasibility-${String(feasibility.status).toLowerCase()}`}>{titleCase(feasibility.status)} · {feasibility.score ?? '-'}%</span>}</div></div>}
  </section>;
}
