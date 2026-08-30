'use client';

import { StatusPill, formatRelative } from './CivicUI';

export default function CaseStatusRail({ agent, complaint }) {
  if (!agent && !complaint) return null;
  const next = agent?.next_action || 'Waiting for the next workflow event';
  const last = agent?.last_action || complaint?.status || 'Case created';
  return <aside className="v-case-rail" aria-label="NagarSetu case officer">
    <div className="v-case-rail-head"><span className="v-agent-mark">N</span><div><span className="v-eyebrow">CASE OFFICER</span><strong>{agent?.name || 'NagarSetu Officer'}</strong></div></div>
    <div className="v-case-rail-status"><StatusPill value={agent?.status || complaint?.status || 'FILED'} /><span>{agent?.escalation_level ? `Escalation ${agent.escalation_level}` : 'Monitoring'}</span></div>
    <div className="v-case-rail-row"><span>Next action</span><strong>{next}</strong></div>
    <div className="v-case-rail-row"><span>Last recorded</span><strong>{last}</strong><small>{formatRelative(agent?.updatedAt || complaint?.updatedAt)}</small></div>
  </aside>;
}
