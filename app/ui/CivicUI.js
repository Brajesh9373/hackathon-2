export function Glyph({ children, tone = 'default' }) {
  return <span className={`v-glyph v-glyph-${tone}`} aria-hidden="true">{children}</span>;
}

export function Button({ children, kind = 'primary', className = '', ...props }) {
  return <button className={`v-button v-button-${kind} ${className}`.trim()} {...props}>{children}</button>;
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRelative(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const hours = Math.round((Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  return formatDate(value);
}

function clean(value) {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
}

const statusLabels = {
  filed: 'Submitted',
  pendingassign: 'Needs routing',
  'pending assignment': 'Needs routing',
  assigned: 'Assigned',
  inprogress: 'In progress',
  'in progress': 'In progress',
  pendingclosure: 'Awaiting citizen',
  'pending closure': 'Awaiting citizen',
  'awaiting verification': 'Awaiting citizen',
  provisionallyclosed: 'Awaiting citizen',
  'provisionally closed': 'Awaiting citizen',
  deptverified: 'Department verified',
  dmverified: 'Verified',
  resolved: 'Resolved',
  closed: 'Completed',
  disputed: 'Needs follow-up',
  escalated: 'Escalated',
  defconalert: 'Priority alert',
  'defcon alert': 'Priority alert',
};

export function statusLabel(value) {
  const normalized = clean(value).replace(/\s/g, '');
  return statusLabels[normalized] || statusLabels[clean(value)] || String(value || 'Unknown');
}

export function StatusPill({ value }) {
  const normalized = clean(value).replace(/\s/g, '-');
  const tone = ['closed', 'resolved', 'dm-verified'].includes(normalized) ? 'success'
    : ['disputed', 'escalated', 'defcon-alert'].includes(normalized) ? 'danger'
      : ['in-progress', 'pending-closure', 'provisionally-closed'].includes(normalized) ? 'warm' : 'cool';
  return <span className={`v-pill v-pill-${tone}`}><i />{statusLabel(value)}</span>;
}

export function PriorityPill({ value }) {
  const raw = typeof value === 'object' && value !== null ? value.band || value.score : value;
  const numeric = Number(raw);
  // Mirror the backend decision engine bands: 75+ critical, 55+ high,
  // 35+ medium, 15+ low. This keeps score labels consistent in every portal.
  const inferred = Number.isFinite(numeric) ? (numeric >= 75 ? 'critical' : numeric >= 55 ? 'high' : numeric >= 35 ? 'medium' : numeric >= 15 ? 'low' : 'minimal') : clean(raw);
  const tone = inferred.includes('red') || inferred === 'critical' ? 'danger'
    : inferred.includes('orange') || inferred === 'high' ? 'warm'
      : inferred.includes('yellow') || inferred === 'medium' ? 'cool' : 'quiet';
  const label = inferred.includes('defcon') ? inferred.replace('defcon ', '') : inferred || 'minimal';
  return <span className={`v-priority v-priority-${tone}`}>{String(label).replace(/^./, char => char.toUpperCase())}{Number.isFinite(numeric) ? ` / ${numeric}` : ''}</span>;
}

export function StatCard({ label, value, detail, tone = 'neutral' }) {
  return <article className={`v-stat v-stat-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function SectionHeading({ eyebrow, title, detail, action }) {
  return <div className="v-section-heading"><div><span className="v-eyebrow">{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

export function EmptyState({ title, detail, action, icon = '' }) {
  return <section className="v-empty">{icon && <div className="v-empty-icon">{icon}</div>}<div><h3>{title}</h3>{detail && <p>{detail}</p>}{action}</div></section>;
}

export function initials(name = 'User') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
}

export function complaintLocation(complaint) {
  return complaint?.location?.address || complaint?.location?.area || complaint?.location?.district || 'Location pending';
}

export function ComplaintCard({ complaint, onOpen, showAction = true }) {
  return <article className="v-complaint-card">
    <div className="v-card-topline"><span className="v-reference">{complaint.complaint_id || complaint.id || 'NagarSetu'}</span><PriorityPill value={complaint.priority_score ?? complaint.priority} /></div>
    <button className="v-card-main" onClick={onOpen} aria-label={`Open complaint ${complaint.complaint_id || complaint.id}`}>
      <div><h3>{complaint.complaint_text || complaint.description || 'Civic issue'}</h3><p>{complaintLocation(complaint)}</p></div>
      <span className="v-arrow">Open</span>
    </button>
    <div className="v-card-footer"><StatusPill value={complaint.status} /><span>{formatRelative(complaint.createdAt || complaint.submittedAt)}</span>{showAction && <span className="v-card-link">View record</span>}</div>
  </article>;
}

export function ProgressRail({ status }) {
  const stages = [
    ['FILED', 'Submitted'],
    ['ASSIGNED', 'Routed'],
    ['IN_PROGRESS', 'In the field'],
    ['PENDING_CLOSURE', 'Citizen check'],
    ['CLOSED', 'Completed'],
  ];
  const order = { FILED: 0, PENDING_ASSIGN: 0, ASSIGNED: 1, IN_PROGRESS: 2, AWAITING_VERIFICATION: 3, PENDING_CLOSURE: 3, PROVISIONALLY_CLOSED: 3, DEPT_VERIFIED: 3, DM_VERIFIED: 3, COMPLETED: 4, VERIFIED: 4, RESOLVED: 4, CLOSED: 4, REOPENED: 2, DISPUTED: 2, ESCALATED: 1, DEFCON_ALERT: 0 };
  const current = order[String(status || 'FILED').toUpperCase()] ?? 0;
  return <ol className="v-progress">{stages.map(([key, label], index) => <li className={index <= current ? 'is-done' : ''} key={key}><span>{String(index + 1).padStart(2, '0')}</span><small>{label}</small></li>)}</ol>;
}
