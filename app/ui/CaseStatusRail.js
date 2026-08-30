'use client';

import { StatusPill, formatRelative } from './CivicUI';

function readableStage(value) {
  return String(value || 'INTAKE').toLowerCase().replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function CaseStatusRail({ agent, complaint }) {
  if (!agent && !complaint) return null;
  const next = agent?.next_action || 'Waiting for the next workflow event';
  const last = agent?.last_action || complaint?.status || 'Case created';
  return <aside className="v-case-rail" aria-label="NagarSetu case officer">
    <div className="v-case-rail-head"><span className="v-agent-mark">N</span><div><span className="v-eyebrow">CASE OFFICER</span><strong>{agent?.name || 'NagarSetu Officer'}</strong></div></div>
    <div className="v-case-rail-status"><StatusPill value={agent?.status || complaint?.status || 'FILED'} /><span>{agent?.escalation_level ? `Escalation ${agent.escalation_level}` : 'Monitoring'}</span></div>
    {agent?.pending_approval && <div className="v-case-rail-alert"><strong>Approval needed</strong><span>The case officer has prepared a proposal for a municipal decision.</span></div>}
    <div className="v-case-rail-row"><span>Case stage</span><strong>{readableStage(agent?.stage)}</strong></div>
    <div className="v-case-rail-row"><span>Next action</span><strong>{next}</strong></div>
    <div className="v-case-rail-row"><span>Last recorded</span><strong>{last}</strong><small>{formatRelative(agent?.updatedAt || complaint?.updatedAt)}</small></div>
    <div className="v-case-rail-row"><span>Audit trail</span><strong>{agent?.event_log?.length || 0} recorded events</strong></div>
  </aside>;
}
