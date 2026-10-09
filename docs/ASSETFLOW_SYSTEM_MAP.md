# AssetFlow System Map

## Purpose

This document is the living technical source of truth for AssetFlow.

It records the architecture actually verified during the whole-app audit so that future developers and AI agents can understand domain ownership, canonical workflows, authority boundaries, dependencies, invariants, verified behaviour, known gaps and intentional deferrals without repeating deep discovery.

This is not a substitute for source code or migrations. Source code and deployed database state remain authoritative.

### Status terminology

- **Implemented** — implementation exists and the inspected architecture supports the intended capability.
- **Verified** — behaviour has additionally been exercised by an appropriate test/check.
- **Partial** — meaningful implementation exists but the intended end-to-end capability is incomplete.
- **Missing** — required capability has no adequate implementation.
- **Conflicting** — multiple implementations or contracts currently compete for authority.
- **Deferred** — intentionally postponed and not required for the current production milestone.

A TypeScript type, database column, permission, migration or UI component alone does not prove that a capability is implemented end-to-end.

---

# 1. Leasing Commercial Authority

## Purpose

Govern the transition from mutable leasing negotiations into an immutable, approved commercial agreement that downstream lease generation may safely consume.

## Canonical data model

Primary records:

- `leasing_opportunities` — mutable working transaction.
- `leasing_opportunity_versions` — immutable commercial snapshots.
- `leasing_commercial_approvals` — approval/rejection evidence.
- `approved_terms_version_id` — canonical pointer from the opportunity to the approved commercial version.

## Canonical commands

Database-governed commands include:

- `create_leasing_commercial_version(...)`
- `approve_leasing_commercial_terms(...)`

Commercial authority is enforced at database command level rather than relying only on UI state.

## Workflow

Mutable leasing opportunity
→ governed submission
→ immutable `leasing_opportunity_versions.snapshot`
→ internal approval
→ governed approval of exact current version
→ `approved_terms_version_id`
→ opportunity status `drafting`
→ lease-document generation.

## Snapshot contents

The verified commercial snapshot includes, among other fields:

- opportunity identity/code
- prospect/company information
- registration/VAT information
- contact information
- property/unit/vacancy
- monthly rental
- deposit
- escalation
- lease term
- commencement/expiry/beneficial occupation dates
- parking/storage
- broker/commission information
- negotiation notes
- source offer
- capture timestamp

## Authority and permissions

Entity membership determines which client's records may be accessed.

Explicit permissions determine which governed commercial action may be performed.

Relevant permissions include:

- `leasing.commercial.submit`
- `leasing.commercial.approve`
- `leasing.commercial.reject`
- `leasing.document.generate`
- `leasing.execution.send`
- `leasing.activation.execute`

Commercial approval validates:

- authenticated user
- entity access
- explicit permission
- opportunity/version ownership
- opportunity workflow state
- approval applies only to the current immutable commercial version

## Critical invariant

**Lease generation must consume the approved immutable commercial version, never current mutable values from `leasing_opportunities`.**

The database migration explicitly establishes this rule.

## Verified status

**Implemented / architecture inspected.**

The immutable-version and governed approval migrations have been inspected.

Production behaviour of every UI/API entry point into these commands remains subject to whole-workflow E2E verification.

---

# 2. Lease Template & Document Intelligence

## Purpose

Allow AssetFlow to understand customer lease templates safely, map document targets to canonical lease semantics, require human review, and approve reusable templates for operational use.

## Canonical semantic authority

`lib/lease/templates/field-registry.ts`

The field registry owns canonical lease-field semantics including:

- canonical key
- aliases
- type
- label
- requiredness

The analyser must not maintain a competing semantic authority.

## Core flow

Template upload/recovery
→ OCR/text extraction
→ `analyseLeaseTemplate()`
→ document target discovery and evidence
→ `buildLeaseTemplateMappings()`
→ durable draft/mappings
→ governed human mapping review
→ governed template approval
→ active/approved template selection.

## Key components

- lease-template analyser
- canonical field registry
- mapping builder
- lease-template service
- mapping review API/RPC
- template approval API/RPC
- upload/recovery state machine

## Mapping invariants

- AI-discovered mappings are not automatically approved.
- Unknown targets remain unresolved rather than being guessed.
- Repeated occurrences remain independently addressable.
- Completed-example values are evidence, not insertion values.
- Human review governs reusable mappings.
- Ordinary metadata updates cannot mutate governed fields/mappings.
- Operational template selection requires active + approved status.

## Target contracts

The model supports target concepts including:

- placeholder
- DOCX text
- DOCX table cell
- DOCX content control
- DOCX bookmark
- PDF form field
- PDF region

These target types are contracts only. Their presence does **not** prove that format-specific generation engines exist.

## Canonical-registry correction

A Phase 1 audit found duplicated required-field authority between the analyser and canonical registry.

The analyser was corrected so canonical requiredness controls known semantic fields, including `lease_expiry_date`, while unknown customer placeholders remain reviewable instead of causing analysis failure.

Clean tracked checkpoint:

`7c19ee2 Align lease analyser with canonical field registry`

Validation:

- `npx tsc --noEmit` — passed
- `git diff --check` — passed

## Durable analysis/recovery state machine

27/27 Lease Template migrations were deployed/reconciled.

Rollback-only production tests verified:

- reservation
- heartbeat/fencing
- recovery claim
- durable OCR checkpoint
- resume
- recovered completion/idempotency
- dependency-blocked cleanup
- safe cleanup
- `reconciliation_required`

Final production test baseline was clean with no leaked test state.

## Known architectural note

`processDocument(db: SupabaseClient = supabase)` accepts a database client, while a communications insert was observed using the module-level Supabase client. This is recorded for later security/authority reconciliation and has not yet been classified as a production defect.

## Status

**Template intelligence: Implemented and substantially verified.**

**Template → generated legal lease: Missing downstream bridge.**

Do not reopen the analysed template state machine without contradictory evidence.

---

# 3. Lease Document Generation

## Purpose

Produce the exact legal agreement that will be reviewed and executed from governed AssetFlow authorities.

## Required authorities

Generation must consume:

1. the exact approved immutable commercial version;
2. the exact approved Lease Template/version;
3. canonical AssetFlow semantic values required by confirmed template mappings.

AI may assist with template understanding but must not improvise contractual values during deterministic legal-document generation.

## Required output

A generated lease must preserve provenance including:

- opportunity ID
- approved commercial version ID/version
- approved commercial snapshot
- template ID/version
- source-template checksum
- resolved field manifest
- generated artifact identity/version
- generation timestamp
- cryptographic document checksum
- validation result

## Required validation

Generation must fail safely for conditions including:

- commercial terms not approved
- template not approved
- template/entity/property mismatch
- missing required canonical value
- unresolved required mapping
- unsupported required target
- stale template version
- source-template checksum mismatch

Optional/non-contractual issues may become explicit review warnings rather than silent failures.

## Current status

**Missing / pilot-critical.**

The approved Lease Template system currently has no proven downstream consumer that populates the legal lease.

The existing general document engine is not the contractual lease generator. It currently builds renderer-agnostic models for operational/financial documents such as invoices and statements.

## Intended production workflow

Approved commercial version
→ approved template
→ deterministic population
→ validation
→ generated legal artifact
→ actual-document preview
→ manager approval
→ canonical document registration
→ execution.

---

# 4. Execution & Native Signing

## Purpose

Govern the exact legal artifact from review/send through participant execution and completion.

## Canonical lifecycle authority

`lib/execution/engine.ts`

Current lease pages use `createExecutionEngine(...)`.

The execution model includes concepts for:

- draft/review/ready/send lifecycle
- participants
- signing order
- execution events
- snapshots
- locking
- document package URL
- execution certificate URL
- hashes
- execution versions

## Parallel signing architecture

`lib/signing/*` contains substantial native signing capabilities including:

- signature requests
- typed/drawn/uploaded signatures
- initials and other field types
- field placement
- PDF flattening
- execution package generation
- signing evidence
- executed-document handling

It currently overlaps with lease responsibilities in `lib/execution`.

### Current classification

**Conflicting / parallel implementation.**

Do not create a third execution system.

Target architecture:

- `lib/execution` remains canonical lifecycle authority.
- useful native PDF/signature capabilities from `lib/signing` are reused/converged beneath the canonical execution lifecycle where appropriate.

## Current execution snapshot

A database trigger captures a snapshot when an execution first becomes `sent`.

The inspected implementation copies the current `leases` row.

This provides historical data but is not sufficient as the evidentiary authority for the legal artifact.

## Required execution package

At send time the canonical frozen execution package must bind:

- approved commercial version/snapshot
- template ID/version/checksum
- generated document ID/version
- actual document SHA-256
- participant manifest
- generation manifest
- execution version

The package must become immutable once sent.

Post-send contractual changes require controlled cancellation/supersession/new execution rather than mutation.

## Signing readiness

An engine-level readiness weakness was identified: participant readiness can be masked while the execution remains draft, while `send()` evaluates readiness before its participant parameter is applied.

The normal UI may currently mask this because participants are added earlier.

This remains a recorded execution invariant defect to correct during implementation.

## Execution certificate

`lib/execution/certificate.ts` is currently a prototype/partial implementation.

It contains useful evidence concepts:

- execution ID/version
- participant names/types
- signing timestamps
- IP/user-agent
- signature method
- execution event timeline
- provider
- hash field

However:

- it currently generates HTML rather than a production PDF certificate;
- it uses a public URL path;
- its fallback hash implementation is explicitly demo logic and is not a real SHA-256 hash of the executed document.

This must be replaced/strengthened before production readiness.

## Current status

Execution lifecycle: **substantially implemented**.

Native signing capability: **substantially implemented but architecturally disconnected/conflicting**.

Immutable execution package: **Partial/Missing operationally**.

Real cryptographic artifact integrity: **Missing**.

Production execution certificate: **Partial/prototype**.

---

# 5. Lease Activation Boundary

## Purpose

Convert a legally completed lease into the operational property-management state.

Execution and activation are intentionally separate concepts.

Execution proves that the contractual document was completed.

Activation operationalises that agreement.

## Existing activation responsibilities

The Lease Activation service/RPC supports the operational creation/handoff of:

- tenant
- lease
- billing rules
- workflow state
- operational journal/event
- document reference where supplied

## Intended handoff

Executed and verified legal artifact
→ execution complete
→ activation eligibility
→ governed Lease Activation
→ tenant/unit/lease operational state
→ billing rules
→ downstream revenue operations.

## Critical invariant

Operational activation must consume the executed governed agreement and must not require users to re-key contractual terms.

## Status

Activation capability: **Implemented substantially.**

Execution → activation governed handoff: **Partial / requires final integration and E2E verification.**

---

# 6. Lease-to-Revenue Critical Path

## Intended critical workflow

Opportunity
→ commercial negotiation
→ immutable commercial version
→ commercial approval
→ lease generation
→ document review
→ execution
→ executed artifact
→ activation
→ billing rules
→ invoice
→ tenant balance
→ payment
→ bank import
→ reconciliation/posting
→ governance/reporting.

## Current verified seam

The principal confirmed missing leg in the leasing portion is:

**approved commercial terms + approved lease template → generated legal lease → immutable execution package**

This is pilot-critical.

---

# 7. Production Standard — Lease Generation & Execution

This domain must not be marked Production Ready until AssetFlow can prove:

- generation consumes only the approved commercial version;
- only approved templates may generate operational legal agreements;
- required contractual fields cannot silently disappear;
- template ID/version/checksum are recorded;
- commercial version is recorded;
- generated document bytes are registered/versioned;
- manager reviews the exact legal document that will be sent;
- actual frozen document bytes receive a real cryptographic SHA-256;
- participants are validated before send;
- the execution package becomes immutable at send;
- post-send contractual mutation is prevented;
- sequential signing order is enforced when configured;
- expired/invalid signing links fail securely;
- signing evidence persists;
- signatures are embedded in the final executed PDF;
- final executed bytes receive a cryptographic hash;
- a proper execution certificate is generated;
- executed artifacts are immutable or controlled through supersession;
- entity isolation and server-side permissions are enforced;
- retries are idempotent and do not create contradictory executions;
- failures are recoverable and observable;
- email/WhatsApp delivery failures are visible and retryable;
- the full audit timeline is durable;
- completed execution can feed governed activation without re-keying.

Required E2E proof includes:

Commercial terms
→ approval
→ lease generation
→ review
→ send
→ tenant signature
→ landlord signature
→ executed PDF
→ execution certificate
→ activation
→ billing rule
→ invoice.

---

# 8. Audit / Verification Rules

For each remaining AssetFlow domain, record:

1. purpose;
2. canonical authority;
3. key entry points/services;
4. database/state model;
5. workflow/data flow;
6. dependencies and downstream consumers;
7. permissions/entity boundaries;
8. critical invariants;
9. recovery/error behaviour where relevant;
10. Implemented / Partial / Missing / Conflicting / Deferred status;
11. verified checks/tests;
12. known gaps;
13. production-readiness requirements.

Do not infer implementation from types, permissions or database columns alone.

Prefer evidence-based closure over exhaustive file inspection.

Pilot-critical workflow blockers are fixed before non-critical polish.

Production quality is mandatory, but unnecessary refactors and speculative hardening should not delay pilot delivery.

## Phase 1 Audit — Lease Execution Checkpoint (2026-10-09)

### Audit position
- Phase 1 architecture and production-readiness audit remains IN PROGRESS.
- Lease execution and native digital signing are an active remediation workstream.
- Completing this workstream does not constitute completion of Phase 1.
- After execution and signing verification, reconcile existing functionality against the 221-item audit checklist.

### Verified source-control checkpoint
- Branch: main.
- Latest confirmed commit: 26e3f55.
- Sixteen execution-related Supabase migrations pending deployment.
- Latest confirmed remote migration: 20261007161000.
- Existing production project remains the deployment target.
- Public signing and execution email OTP remain disabled.

### Implemented but not yet database-verified
- Governed execution bridge and frozen approved document reference.
- Hashed, expiring and revocable signing invitations.
- Participant-linked email OTP challenges.
- OTP delivery, verification and rate-limiting infrastructure.
- RPC authority corrections and legacy OTP retirement.

### Required completion sequence
1. Confirm production recovery arrangements.
2. Deploy execution migrations under controlled conditions.
3. Verify RPC privileges, tenant isolation, invitation lifecycle, OTP security and concurrency.
4. Complete landlord and tenant signatory nomination and authority declarations.
5. Complete configurable witness requirements and signature capture.
6. Enforce verification and document integrity at signature commit.
7. Produce genuine signed PDF artifacts and audit certificates.
8. Verify countersigning, document distribution and atomic lease activation.
9. Verify tenant/unit assignment, deposit and rental billing, and exception recovery.
10. Record end-to-end test evidence and close the execution audit findings.
11. Resume the 221-item checklist in dependency order.

### Release controls
- Do not enable public signing before complete end-to-end verification.
- Do not enable email OTP merely because migrations have deployed.
- Do not treat migration dry-runs as successful database execution.
- Do not declare the leasing domain or Phase 1 audit complete without evidence.
