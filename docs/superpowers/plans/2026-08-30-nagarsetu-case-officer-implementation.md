# NagarSetu Case Officer and Trust Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a voice-first NagarSetu civic workflow with a persistent AI Officer per complaint, MongoDB-loss recovery, misinformation resistance, and a modern uncluttered interface.

**Architecture:** Keep MongoDB as the operational store and add an encrypted hash-linked append-only ledger as the recovery source. Add voice-intake, case-agent, recovery, and truth-firewall services behind role-protected Express routes, then expose only focused command surfaces in Next.js.

**Tech Stack:** Next.js 16 App Router, React 19, native CSS variables, Motion-compatible CSS transitions, GSAP client islands where useful, Express, MongoDB/Mongoose, VAPI outbound calls, Radar SDK, Make.com webhooks, node-cron, Node crypto, and the existing priority engine.

**Spec:** `docs/superpowers/specs/2026-08-30-nagarsetu-case-officer-design.md`

## Global Constraints

- Visible product, page titles, call scripts, metadata, and logs use `NagarSetu`; remove visible `VAANI` branding without changing third-party package names.
- No emojis, decorative symbols, em-dashes, raw JSON in user-facing views, duplicate CTA intents, or overflowing text.
- One rounded, trust-first public-sector design system with a single teal action accent; use semantic tokens and explicit mobile layouts.
- Automated calls require a positive Radar safety result; role-sensitive actions require an approved role.
- The citizen verification call is the only closure gate; `yes` closes and `no` reopens or returns the case to supervision.
- Never commit API keys, recovery encryption keys, phone numbers, or callback secrets.
- Every implementation task ends with focused tests before moving to the next task.

---

### Task 1: Lock the NagarSetu brand and UI foundation

**Files:**
- Modify: `app/layout.js`, `app/page.js`, `app/civic.css`, `backend/src/server.js`, `README.md`, `package.json`, `backend/package.json`
- Create: `app/ui/NagarSetuShell.js`, `app/ui/CaseStatusRail.js`, `app/ui/SkeletonBlock.js`
- Test: `scripts/brand-and-route-audit.mjs`

**Interfaces:**
- `NagarSetuShell({ role, title, children })` renders the top rail, compact role switcher, account action, and responsive main region.
- `CaseStatusRail({ agent, complaint })` renders current state, reason, next action, and one contextual action.
- `SkeletonBlock({ className })` renders geometry-matched loading content.

- [ ] Search visible source strings with `rg -n -i "vaani" app backend README.md package.json backend/package.json` and classify technical versus product-facing occurrences.
- [ ] Replace product-facing copy, page metadata, login labels, call text, backend banners, and documentation with NagarSetu.
- [ ] Add semantic CSS tokens for background, surface, ink, muted text, border, accent, danger, warning, and success with rounded shape rules.
- [ ] Replace the always-visible left sidebar with a compact responsive top rail and role-specific command strip while preserving existing route slugs.
- [ ] Add skeleton, empty, blocked, error, and degraded-mode primitives and use them in the shared shell.
- [ ] Add the audit script that fails when visible `VAANI` text remains, an em-dash appears in UI copy, or route labels duplicate an action intent.
- [ ] Run `node scripts/brand-and-route-audit.mjs` and `npm run lint`.

### Task 2: Implement voice-first citizen intake

**Files:**
- Create: `backend/src/models/VoiceIntakeSession.js`, `backend/src/services/voiceIntakeService.js`, `backend/src/controllers/voiceIntakeController.js`, `backend/src/routes/voiceIntake.js`
- Modify: `backend/src/server.js`, `backend/src/controllers/complaintController.js`, `app/citizen/new/page.js`, `app/lib/api.js`
- Test: `backend/tests/voiceIntake.test.js`

**Interfaces:**
- `startVoiceIntake({ citizen, targetPhone, safeLocation }) -> { sessionId, callId, status }`
- `recordVoiceIntakeResult(sessionId, payload) -> VoiceIntakeSession`
- `confirmVoiceIntake(sessionId, citizenId, edits) -> { complaint, agent }`

- [ ] Define the structured intake schema with issue, category, location, ward, urgency, language, phone, evidence availability, confidence, and missing fields.
- [ ] Build the VAPI call payload with assistant overrides, a first message beginning `Hello Citizen`, structured output instructions, and an end-of-call callback reference.
- [ ] Normalize all numbers to E.164 and use `DEMO_CALL_TARGET` only when `DEMO_MODE=true`.
- [ ] Apply the existing Radar gate before call creation and return a clear blocked result when location is unavailable or restricted.
- [ ] Add polling and callback handling so local calls work without a public callback while deployed calls can use `PUBLIC_CALLBACK_URL`.
- [ ] Persist the draft and only create a Complaint after an authenticated citizen confirmation.
- [ ] Replace the citizen form-first layout with one primary voice action, a call state surface, a structured review draft, and a compact manual fallback.
- [ ] Test valid capture, missing fields, malformed categories, no-answer, Radar-blocked, VAPI-rejected, and confirmation idempotency.

### Task 3: Add the persistent ComplaintAgent and policy engine

**Files:**
- Create: `backend/src/models/ComplaintAgent.js`, `backend/src/services/caseOfficerService.js`, `backend/src/services/agentPolicyService.js`, `backend/src/controllers/caseOfficerController.js`, `backend/src/routes/caseOfficer.js`
- Modify: `backend/src/controllers/complaintController.js`, `backend/src/controllers/verificationController.js`, `backend/src/routes/complaints.js`, `backend/src/server.js`
- Test: `backend/tests/caseOfficer.test.js`, `backend/tests/agentPolicy.test.js`

**Interfaces:**
- `createCaseOfficer(complaint) -> ComplaintAgent`
- `ingestCaseEvent({ complaintId, type, actor, payload }) -> ComplaintAgent`
- `evaluateNextAction(agent, complaint, resources) -> ActionProposal`
- `approveAction(agentId, proposalId, actor) -> ActionResult`
- `runCaseOfficerSweep(now) -> { processed, escalated }`

- [ ] Create the agent state machine and transition table for intake, triage, routing, assignment, active work, verification, completion, reopening, escalation, and recovery-pending.
- [ ] Implement bounded actions for summarisation, reminders, SLA escalation, evidence requests, and recommendations.
- [ ] Require admin or supervisor approval for reassignment, public notices, closure, and role-sensitive calls.
- [ ] Create an agent whenever a complaint is confirmed from voice intake or filed through the validated fallback.
- [ ] Feed assignment, work, verification, priority, and truth-review events into the agent memory summary.
- [ ] Add a node-cron sweep that emits overdue proposals and never silently drops a case.
- [ ] Add role-protected APIs for agent state, proposals, approvals, rejection reasons, and next-action acknowledgement.
- [ ] Test every valid transition, invalid transition, duplicate event, stale proposal, missing resource, and SLA escalation.

### Task 4: Build the encrypted recovery ledger and replay engine

**Files:**
- Create: `backend/src/services/recoveryLedgerService.js`, `backend/src/services/recoveryReplayService.js`, `backend/src/controllers/recoveryController.js`, `backend/src/routes/recovery.js`, `backend/tests/recoveryLedger.test.js`, `backend/tests/recoveryReplay.test.js`
- Modify: `backend/src/models/Complaint.js`, `backend/src/models/ComplaintAgent.js`, `backend/src/models/AuditEvent.js`, `backend/src/controllers/complaintController.js`, `backend/src/controllers/caseOfficerController.js`, `backend/src/server.js`
- Create: `backend/data/.gitkeep`

**Interfaces:**
- `appendLedgerEvent({ aggregateType, aggregateId, eventType, actor, payload }) -> RecoveryLedgerEvent`
- `verifyLedger() -> { valid, eventCount, lastHash, firstInvalidSequence }`
- `reconstructAggregate(aggregateId) -> { complaint, agent }`
- `restorePrimaryStore({ aggregateIds }) -> { restored, skipped, conflicts }`
- `recordPendingCommand(command) -> RecoveryLedgerEvent`

- [ ] Implement an append-only JSONL ledger with atomic append, flush, monotonically increasing sequence, previous-hash linkage, and event-hash verification.
- [ ] Encrypt phone numbers, transcripts, and other sensitive payload fields with AES-256-GCM using `RECOVERY_LEDGER_KEY` from the backend environment.
- [ ] Record complaint and agent snapshots before acknowledging create, assignment, work, call, verification, truth-review, and recovery commands.
- [ ] Add startup integrity checks and a degraded-mode status that keeps recording commands when MongoDB is unavailable.
- [ ] Implement idempotent replay using complaint ID and event sequence, rebuilding both Complaint and ComplaintAgent state.
- [ ] Add admin-only status, restore, and isolated recovery-drill endpoints. The drill must require a specific test aggregate or isolated database.
- [ ] Test tamper detection, encryption round-trip, partial writes, replay after deletion, duplicate replay, and pending commands during simulated primary-store loss.

### Task 5: Implement the Truth Firewall

**Files:**
- Create: `backend/src/models/TrustSource.js`, `backend/src/models/FactCheckCase.js`, `backend/src/models/ClaimCluster.js`, `backend/src/services/trustedSourceService.js`, `backend/src/services/misinformationService.js`, `backend/src/controllers/truthController.js`, `backend/src/routes/truth.js`, `backend/src/data/trusted-sources.json`
- Modify: `backend/src/models/Complaint.js`, `backend/src/controllers/complaintController.js`, `backend/src/services/caseOfficerService.js`, `backend/src/server.js`
- Test: `backend/tests/truthFirewall.test.js`

**Interfaces:**
- `assessIntegrity({ text, media, location, citizenId }) -> IntegrityAssessment`
- `clusterClaim({ contentHash, normalizedText, citizenId }) -> ClaimCluster`
- `compareTrustedSources(claim) -> { status, sources, confidence }`
- `resolveFactCheck(caseId, decision, reviewer) -> FactCheckCase`

- [ ] Add trusted-source records with publisher, official URL, validity window, retrieval timestamp, digest, and claim topics.
- [ ] Normalize text, calculate content fingerprints, and compare recent near-duplicate claims without exposing raw phone numbers.
- [ ] Detect burst coordination, copy-paste campaigns, evidence-location mismatch, and unsupported safety claims.
- [ ] Persist an IntegrityAssessment on every complaint and create a FactCheckCase for high-risk or contradicted content.
- [ ] Keep public-safety complaints routable even when integrity confidence is weak; quarantine amplification instead of deleting.
- [ ] Add reviewer decisions with source citations, reason, reviewer identity, and ledger event.
- [ ] Expose a Truth Center API for pending cases, source details, clusters, and resolutions.
- [ ] Test supported, contradicted, unverified, coordinated, benign-duplicate, and high-priority weak-evidence claims.

### Task 6: Connect all workflow calls and agent actions

**Files:**
- Create: `backend/src/services/callScriptService.js`, `backend/src/services/callOrchestrationService.js`
- Modify: `backend/src/controllers/complaintController.js`, `backend/src/controllers/verificationController.js`, `backend/src/services/voiceIntakeService.js`, `backend/.env.example`, `.env.example`
- Test: `backend/tests/callOrchestration.test.js`, `scripts/live-call-drill.mjs`

**Interfaces:**
- `buildRoleFirstMessage({ designation, context }) -> string`
- `startRoleCall({ designation, recipient, context, geofence }) -> { provider, callId, status }`
- `pollRoleCall(callId) -> { status, transcript, decision }`

- [ ] Centralise role-specific first messages with exact designation wording and NagarSetu branding.
- [ ] Route voice intake, admin escalation, supervisor proposal, worker reminder, and citizen verification through the same safe call service.
- [ ] Keep Make.com as an optional asynchronous orchestrator with callback signing and backend source-of-truth semantics.
- [ ] Ensure VAPI polling can process structured outcomes and never closes a complaint without an explicit positive citizen answer.
- [ ] Add `DEMO_CALL_TARGET` and document the environment contract without writing secrets into examples.
- [ ] Build the live-call drill that logs call acceptance, end state, transcript presence, and resulting database transition.

### Task 7: Redesign citizen, admin, supervisor, and worker surfaces

**Files:**
- Modify: `app/citizen/page.js`, `app/citizen/new/page.js`, `app/citizen/complaints/[id]/page.js`, `app/admin/page.js`, `app/admin/complaints/page.js`, `app/supervisor/page.js`, `app/supervisor/queue/page.js`, `app/worker/page.js`, `app/worker/completed/page.js`, `app/worker/work/[id]/page.js`, `app/ui/PortalShell.js`, `app/ui/PortalBlocks.js`, `app/civic.css`
- Create: `app/ui/AgentPulse.js`, `app/ui/ActionProposal.js`, `app/ui/VoiceIntakePanel.js`, `app/ui/TrustBadge.js`
- Test: `scripts/ui-overflow-audit.mjs`

**Interfaces:**
- `AgentPulse({ agent, compact })` shows one current state, reason, and next action.
- `ActionProposal({ proposal, onApprove, onReject })` renders one clear approval choice with an accessible reason.
- `VoiceIntakePanel({ session, onStart, onConfirm })` handles call states and draft review.
- `TrustBadge({ assessment })` renders uncertainty and source-backed statuses without raw JSON.

- [ ] Replace the permanent left sidebar with the shared NagarSetu top rail and contextual command strip.
- [ ] Remove redundant buttons and rename actions to short, unambiguous verbs.
- [ ] Make the AI Officer a compact, expandable rail on complaint detail pages, not a wall of text.
- [ ] Add proposal trays to admin and supervisor pages with clear approval states.
- [ ] Add Truth Firewall and Recovery Sentinel as contextual alerts that appear only when needed.
- [ ] Use skeletons matching final geometry, rounded surfaces, clear empty states, and responsive CSS grid layouts.
- [ ] Add restrained GSAP or Motion client-island transitions for agent state changes, proposal expansion, and call status. Respect reduced motion.
- [ ] Verify every page at 320, 768, 1024, and 1440 pixels for overflow, clipping, focus order, contrast, and CTA wrapping.

### Task 8: Add Recovery Console and Truth Center screens

**Files:**
- Create: `app/admin/recovery/page.js`, `app/admin/truth/page.js`, `app/ui/RecoverySentinel.js`, `app/ui/TruthReviewPanel.js`
- Modify: `app/admin/page.js`, `app/ui/PortalShell.js`, `app/lib/api.js`, `app/civic.css`
- Test: `scripts/console-interaction-audit.mjs`

**Interfaces:**
- `RecoverySentinel({ status, onVerify, onRestore })` shows chain health, last event, and restore actions.
- `TruthReviewPanel({ caseItem, sources, onResolve })` shows claim, risk signals, source citations, and reviewer actions.

- [ ] Add an admin recovery route with chain verification, recoverable aggregates, pending commands, and isolated drill controls.
- [ ] Add a Truth Center route with claim clusters, trusted sources, contradiction details, and reviewer resolution.
- [ ] Ensure both screens render real loading, empty, error, permission, and degraded states.
- [ ] Keep raw event payloads and transcript text behind an explicit detail disclosure with redaction.
- [ ] Add keyboard navigation and accessible labels for all recovery and truth actions.

### Task 9: Execute deep automated and live QA

**Files:**
- Create: `scripts/e2e-case-officer.mjs`, `scripts/e2e-recovery-drill.mjs`, `scripts/e2e-truth-firewall.mjs`, `scripts/live-call-drill.mjs`
- Modify: `package.json`, `backend/package.json`

- [ ] Run unit tests for agent policy, voice schemas, ledger cryptography, replay, truth classification, call scripts, and priority preservation.
- [ ] Run a 30-complaint priority stress set and verify descending order, score range, emergency dominance, and no JSON-only UI output.
- [ ] Run the complete citizen voice intake to admin, supervisor, worker, verification, and citizen-confirmation flow.
- [ ] Run the same flow with citizen `no` and verify reopening, follow-up creation, and no completion increment.
- [ ] Run an isolated Mongo wipe drill and verify ledger restore, agent state, assignment names, timeline, and pending action recovery.
- [ ] Run coordinated misinformation cases and verify clustering, containment, source display, and reviewer audit events.
- [ ] Run a real call to the configured demo target for citizen intake and a real verification call. Record VAPI acceptance, transcript, and state transition.
- [ ] Run frontend build, lint, route smoke, UI overflow audit, accessibility checks, and `git diff --check`.
- [ ] Confirm the final database has no synthetic QA records unless explicitly retained by the project owner.

## Execution order

Implement Tasks 1 through 9 in sequence. After each task, run its focused tests and keep the working tree reviewable. Use inline execution in this session because the project owner explicitly requested implementation, live calling, and deep QA.
