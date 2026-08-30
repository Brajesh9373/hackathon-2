# NagarSetu Case Officer and Trust Resilience Design

**Status:** Approved for implementation by the project owner on 2026-08-30.

## Goal

Turn NagarSetu into a voice-first civic casework system where every complaint receives a persistent, bounded AI Officer, while remaining recoverable after MongoDB data loss and resistant to misinformation and coordinated fake submissions.

## Product principles

1. A complaint never loses its owner, memory, or next action.
2. Voice is the primary citizen intake path; manual entry is a recovery path.
3. AI proposes and coordinates; role-authorised humans approve sensitive actions.
4. A citizen confirmation is the only final closure gate.
5. Recovery and truth decisions are explainable, auditable, and reversible.
6. Automated calls are gated by Radar and use the configured demo number only in demo mode.
7. No secret, raw transcript, or unverified claim is exposed in the UI.

## Architecture

MongoDB remains the operational primary store. A hash-linked, encrypted, append-only recovery ledger records complaint commands, state snapshots, agent decisions, call events, and truth-review decisions before MongoDB writes are acknowledged. A replay service reconstructs the latest valid state idempotently after a wipe or corruption event.

Each complaint owns a `ComplaintAgent` state machine. The agent consumes case events, evaluates policy, produces an `ActionProposal`, and either executes a low-risk action or waits for the required admin or supervisor approval. A scheduled sweep processes overdue actions and escalations.

The Truth Firewall adds claim fingerprints, coordination signals, trusted-source comparisons, and a human-review workflow. It labels uncertainty rather than declaring citizens fraudulent from heuristics alone.

## Primary data contracts

### ComplaintAgent

```text
complaint_id: ObjectId reference
status: INTAKE | TRIAGE | WAITING_ADMIN | WAITING_SUPERVISOR | WORKER_ACTIVE | VERIFYING | COMPLETED | REOPENED | ESCALATED | RECOVERY_PENDING
memory_summary: string
latest_reasoning: string
next_action: string
next_action_due_at: Date
pending_approval: object|null
escalation_level: number
last_action: object|null
event_log: array of bounded event references
```

### RecoveryLedgerEvent

```text
event_id: UUID
aggregate_type: COMPLAINT | AGENT | TRUTH_CASE | VOICE_INTAKE
aggregate_id: string
sequence: number
event_type: string
actor: object
payload: encrypted JSON
previous_hash: string|null
event_hash: string
correlation_id: UUID
created_at: Date
```

### VoiceIntakeSession

```text
session_id: UUID
citizen_id: ObjectId|null
target_phone: string
status: CREATED | CALLING | CAPTURED | NEEDS_REVIEW | CONFIRMED | FAILED
structured_fields: object
transcript_ref: string|null
confidence: number
missing_fields: array
call_id: string|null
```

### IntegrityAssessment

```text
status: UNVERIFIED | NEEDS_HUMAN_REVIEW | SUPPORTED_BY_TRUSTED_SOURCE | CONTRADICTED_BY_TRUSTED_SOURCE | COORDINATED_RISK
risk_score: number
content_hash: string
similar_claim_count: number
signals: array
evidence_sources: array
reviewed_by: ObjectId|null
reviewed_at: Date|null
```

## Voice intake flow

1. Citizen clicks `Speak to NagarSetu`.
2. Frontend obtains a Radar-safe location result or explains why the call is held.
3. Backend creates a `VoiceIntakeSession` and starts a VAPI outbound call.
4. The assistant uses a role-specific first message beginning with `Hello Citizen`.
5. VAPI produces structured fields for issue, category, location, urgency, language, contact, and evidence availability.
6. Backend validates fields, runs priority and integrity assessment, and stores a reviewable draft.
7. Citizen confirms or edits the draft.
8. Confirmation creates the Complaint, its ComplaintAgent, the initial RecoveryLedgerEvent, and an admin action proposal.
9. Polling is supported for local development. A public HTTPS callback is used in deployment. Make.com may orchestrate notifications but is never the source of truth.

## AI Officer policy

Low-risk actions such as summarising, calculating next-action dates, sending reminders, and creating review tasks may execute automatically. Reassignment, public announcements, closure, and sensitive outbound calls require role policy checks and an auditable proposal. The agent must preserve a safety complaint even when evidence confidence is weak.

## Recovery design

The ledger is written with an atomic append, file flush, and hash chain. Sensitive payload fields are encrypted with `RECOVERY_LEDGER_KEY`. Startup and an admin recovery endpoint verify chain continuity and compare the latest ledger snapshot to MongoDB. Restore uses upsert-by-complaint-id and sequence checks, then rebuilds agent state and pending jobs. A recovery drill operates against an isolated database or an explicitly selected test complaint, never the complete user dataset by default.

## Truth Firewall design

The system maintains a registry of trusted municipal sources with publisher, URL, validity window, retrieval timestamp, and digest. Claims are normalised and fingerprinted. Near-duplicate bursts, copy-paste campaigns, suspicious evidence metadata, and contradictions with trusted bulletins create a review case. High-risk claims are quarantined from public amplification, not deleted. Admin decisions, sources, and reasons are recorded in the ledger.

## UI direction

The visual language is a trust-first public-sector command console with generous spacing, soft rounded surfaces, a single teal action accent, restrained motion, and clear hierarchy. The left sidebar is replaced by a compact top rail plus a role-specific command strip. The primary surfaces are a case timeline, an AI Officer status rail, an approvals tray, and a recovery or truth alert when needed. Loading uses skeletons that match final geometry. Empty, blocked, error, and degraded states are first-class layouts. No emojis, decorative symbols, raw JSON, repeated CTA labels, or overflowing text.

## Safety and privacy

Phone numbers are normalised to E.164. Demo mode uses one explicit `DEMO_CALL_TARGET` for all role calls. Production mode uses recipient records. Radar must return an explicit safe result before an automated call. Raw transcripts and phone numbers are encrypted in the recovery ledger and redacted from general logs. WhatsApp private-group scanning is not claimed; the product only evaluates submitted or officially sourced claims.

## Acceptance criteria

1. A citizen can start a real voice intake call, receive a structured draft, confirm it, and see the complaint in admin routing.
2. Every created complaint has a persisted ComplaintAgent and visible next action.
3. Admin, supervisor, worker, and verification transitions update agent state and ledger events.
4. A targeted primary-store wipe can be detected and restored without duplicates.
5. An action submitted during recovery is retained and replayed after restoration.
6. Coordinated fake claims are clustered and held for review with evidence sources.
7. Contradicted and supported claims show the source and retrieval time.
8. A real verification call to the configured demo number changes status only after an explicit `yes`.
9. All redesigned routes pass responsive, overflow, accessibility, and interaction QA.
