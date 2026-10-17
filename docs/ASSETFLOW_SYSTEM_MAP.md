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

---

## Production Execution Verification — 2026-10-12

### Scope
Production verification of the governed lease approval-to-signing-document preparation workflow.

This checkpoint supersedes the 2026-10-09 execution checkpoint only where newer production evidence is explicitly recorded below. It does not close the full digital-signing lifecycle or Phase 1 audit.

### Verified production workflow
1. Approved generated lease DOCX was linked to a governed execution.
2. Execution approval succeeded under the authorized owner account.
3. Preparation locked the approved execution and verified the source document and SHA-256 checksum.
4. Production DOCX-to-PDF conversion completed through the Vercel → Railway → Gotenberg integration.
5. The converted PDF passed application-level PDF validation and storage read-back integrity checks.
6. The signing-document record was committed.
7. Independent SQL inspection confirmed the committed record and corresponding object in a private Supabase Storage bucket.

### Production evidence
- Environment: https://www.assetflow.africa
- Execution ID: cb1552ab-9d7f-4cc8-b1b7-3a978b2626cf
- Signing document ID: 9ae3839a-5820-43db-8535-83c4e7446960
- Document version ID: e5e09e58-3b7b-47d3-944f-21aac58163bb
- Source document ID: ce7215ee-2c56-4ef0-a1f6-8ab6ebe7ca46
- Source SHA-256: 62855884c957480adeaa8f2bf9c97ce4b98a34c27528b93031b02f9bba9b6beb
- PDF SHA-256: 8663de86dc4fbee5583fb88e1b4a6dcb112a58bc84bc37e63065e2bd01dcb345
- PDF pages: 2
- PDF size: 57095 bytes
- Conversion provider: gotenberg
- Signing-document database status: committed
- Storage bucket: execution-documents
- Storage bucket public flag: false
- Production preparation response: HTTP 200, status prepared
- Commit containing UUID validation correction: cab3def

### Canonical preparation implementation
- Approval API: app/api/leasing/opportunities/[opportunityId]/approve-for-execution/route.ts
- Preparation API: app/api/execution/[id]/prepare/route.ts
- Authority: lib/execution/server/authority.ts
- Source verification: lib/execution/server/document-source.ts
- Conversion: lib/execution/server/document-conversion-core.ts
- Signing PDF storage and commitment: lib/execution/server/signing-document-storage.ts

### Defect resolved
Production preparation initially failed because signing-document storage validation rejected the existing PostgreSQL entity UUID due to its version/variant bits.

Commit cab3def corrected UUID format validation without removing execution authorization, source provenance or checksum controls.

The same execution subsequently prepared successfully in production.

### Verified boundaries and limitations
- Governed approval through committed private signing PDF: VERIFIED IN PRODUCTION.
- The preparation service performed PDF upload read-back and SHA-256 verification.
- The storage object and private bucket were independently confirmed through SQL.
- Independent external download and rehash of the stored PDF: NOT PERFORMED.
- Repeated preparation/idempotency: NOT YET VERIFIED IN PRODUCTION.
- Public invitation access and signer identity verification: NOT YET VERIFIED END TO END.
- Tenant signing, witness handling and landlord countersigning: NOT YET VERIFIED END TO END.
- Final executed PDF, execution certificate and delivery: NOT YET VERIFIED END TO END.
- Lease activation, tenant/unit assignment and billing handoff: NOT YET VERIFIED END TO END.
- Public signing remains disabled pending security and end-to-end verification.

### Production-readiness assessment
Implemented and verified:
- Governed execution approval and document preparation.
- Source checksum enforcement.
- Production DOCX-to-PDF conversion.
- Private signing-document storage and database commitment.

Implemented but requiring inspection and verification:
- Invitation generation and revocation.
- Email OTP challenge and verification.
- Signer access and signature submission.
- Signature evidence storage.

Not established by this checkpoint:
- Complete countersigning lifecycle.
- Final signed PDF and certificate.
- Distribution and downstream lease activation.

### Next verification sequence
1. Inspect canonical invitation, OTP and signature APIs and their supporting services.
2. Confirm authorization, entity isolation, invitation expiry/revocation and replay protection.
3. Verify signing-document access and signature commitment against the frozen PDF.
4. Execute controlled tenant and landlord signing tests.
5. Verify final artifacts, evidence, delivery and activation handoff.
6. Reconcile findings against the remaining Phase 1 audit checklist.

Do not enable public signing solely on the basis of successful PDF preparation.

## Execution finalisation component checkpoint — 2026-10-15 (Work)

### Source and preservation
- Started from clean `handoff/assetflow-signing-20261015` at `a2b850c`.
- Working branch: `work/assetflow-execution-20261015`.
- Both handoff WIP files were present. Existing preparation, invitations,
  verification, signature submission and activation services remain unchanged.

### Confirmed defect corrected
`lib/execution/server/finalisation-pdf.ts` previously appended signature records
without signing the original pages. It now requires an explicit manifest bound to
execution ID, document-version ID and original PDF SHA-256. It places signature,
separately captured initials and UTC signing date on original pages, preserving
page count, crop boxes and page rotation. Coordinates follow the existing signing
convention: normalized top-left display coordinates, one-based page numbers.
Images preserve aspect ratio and are centered in their designated rectangles.

The renderer rejects tampered source/evidence, duplicate participants/field IDs,
unknown participants, unsupported fields/images, invalid page/rectangle geometry,
missing initials and participants without signature fields. Dates derive from
recorded signing timestamps; fields too small for legible dates fail closed.
Encrypted PDFs are not loaded with encryption bypass enabled.

### Canonical authority boundary
The renderer is a server-only component, not an authority service. Its caller must
supply a database-frozen manifest and committed participant evidence. It must not
accept signer-controlled placements. Matching IDs/hashes inside the renderer do
not establish manifest authenticity. No operational caller currently exists.
The manifest interface added here does not constitute database manifest storage,
lessor placement UI, readiness enforcement or per-field signature commitment.
There is no silent fallback to the parallel `lib/signing` execution lifecycle.

### Verification
- `npx tsc --noEmit`: passed.
- `node --test tests/execution/finalisation-pdf.test.mjs`: 30/30 passed.
- Existing conversion and invitation-delivery suites: 15/15 passed.
- Geometry tested through decoded PDF operators and independently rasterized
  through Python/PyMuPDF at rotations 0/90/180/270 with a nonzero crop origin.
  Rendered signature pixel bounds matched assigned fields within one pixel.
- Geometry tests explicitly require Python/PyMuPDF; missing renderer fails the
  test rather than silently skipping the independent verification gate.

### Unclosed workflow and migration risks
`20261015180000_execution_final_artifacts.sql` remains handoff WIP, unchanged and
not approved for deployment. Inspection identifies missing staging idempotency,
weak stage-time eligibility (no locked/current-active-version checks), incomplete
storage-path validation, and lack of binding to a frozen placement manifest.
These are open defects, not accepted production behavior. They require remediation
and executable database tests together with the manifest integration.

No local PostgreSQL server/client, Docker or configured test database was available
in this checkout. No database migration, SQL concurrency test, external invitation,
production storage mutation or live activation/billing test was executed.

Next coherent implementation: governed manifest persistence and authorized lessor
placement, readiness enforcement against the committed PDF and nominated
participants, then field-specific signing evidence, finalisation orchestration,
certificate/private artifact delivery and activation-to-initial-billing E2E tests.
The original 221-item inventory was not found in the system map or handover docs;
repository references there mention it but do not contain its itemized contents.
Full inventory/artifact search and reconciliation remain pending Phase 1 closure.

### Readiness assessment
PDF placement component: implemented and locally verified for the stated cases.
Lease execution domain / Phase 1: incomplete, neither beta-ready nor
production-ready on this evidence. Full-application readiness percentages are not
recalculated from this component checkpoint. Public signing must remain disabled.

### Publication blocker
Local verified implementation commit: `e2eeb21`. Git HTTPS push failed because
this runtime has no GitHub username/credential helper. Connected GitHub branch
creation also returned HTTP 403 `Resource not accessible by integration` for the
authorized dedicated branch. No remote branch or implementation commit was
published. A local Git bundle and patch accompany this checkpoint for recovery.

## 2026-10-15 governed field signing batch (Work)

This checkpoint extends `e2eeb21` and `30a95e7`; it supersedes their recorded
manifest/finalisation gaps only where implementation and local evidence below
explicitly establish progress. Phase 1 remains open.

### Existing canonical behavior preserved

- `lib/execution` remains lifecycle authority. No parallel signing engine added.
- Existing governed preparation, committed private PDF provenance, signatory
  nomination, invitation validation/recovery and email OTP infrastructure remain.
- The latest signature RPC's document/OTP/invitation/evidence/sequence checks are
  preserved in its replacement. Non-lease signature defaults remain usable and
  have a dedicated regression test; the lease-only manifest rollout is not forced
  into generic documents.
- The original-page renderer from `e2eeb21` is reused. Shared geometry was
  extracted so preparation rejects unsupported geometry/illegible date fields
  before an immutable manifest can be frozen.
- No activation, financial posting or communication-channel business rules were
  duplicated. WhatsApp/email must dispatch canonical commands with the same
  authority and evidence when their workstream is reached.

### Implemented contracts and entry points

- `lib/execution/field-manifest.ts`: canonical placement contract. One-based
  page number, normalized top-left coordinates on displayed crop box. All listed
  fields are mandatory. Signature, initial and date fields bind participant IDs.
- `lib/execution/pdf-field-geometry.ts`: canonical crop/rotation transforms and
  legible date sizing shared by preparation and original-page rendering.
- `components/leasing/ExecutionFieldEditor.tsx`: authenticated PDF canvas overlay,
  participant/type selection, click placement, exact rectangle adjustments,
  removal, save/reload and read-only frozen review. Added to existing workspace.
  Worker served from own origin at `/api/execution/pdf-worker`; route asset
  tracing includes the installed worker. No external worker CDN is added here.
- `/api/execution/[id]/fields`: bearer-authorized entity/source/version checks,
  actual stored PDF SHA-256/length/page-count verification, canonical placement
  validation and optimistic-revision RPC save. Private preview uses the same
  authority. Readiness remains governed by the existing readiness RPC.
- `execution_field_manifests`: one manifest per document version; binds execution,
  entity, committed signing PDF ID/hash, full fields, revision, actors and hash.
  Save requires `leasing.execution.send` and locks execution before dependencies.
  Exact lost-response retries return the saved revision; stale edits fail.
- Readiness trigger freezes the draft manifest atomically when moving from
  `under_review` to `ready`; later signing/executed states require bound immutable
  source/manifest. Executed state additionally requires both committed artifacts
  and matching hash/private pointers. No readiness-only frontend bypass exists.
- `signing-fields.ts`, signer session and signature submission now expose only the
  invited participant's assigned fields and require the exact frozen hash and
  every mandatory field ID. The public client captures separate typed initials
  and explicit per-field confirmation. Dates derive from the database signing
  timestamp. Typed signing remains the current public method.
- `execution_signature_evidence` has separate initials path/hash/type/length.
  Its immutability trigger includes all identity columns. Signature storage now
  decodes actual PNG/JPEG bytes before upload and checks decoded dimensions.
  Ambiguous registration errors retain evidence objects for reconciliation rather
  than risking deletion of an upload that the database may have registered.
- The canonical signature RPC atomically binds manifest/field completions and
  initials hash into participant evidence and signing audit. Its old callable
  nine-argument overload is removed; defaults on the extended function preserve
  non-lease callers. Governed lease calls without fields fail closed.
- `finalisation.ts`: trusted server orchestration loads frozen manifest and
  committed evidence, verifies all downloaded bytes, renders original-page PDF,
  produces detached certificate, stages content-addressed private objects,
  verifies storage read-back, commits artifacts, then completes execution.
- `finalisation-certificate.ts`: actual PDF certificate with execution/version,
  source/signing/final hashes, manifest hash, participant identity, timestamp,
  consent/method and retained signature evidence. It is detached so the hash covers
  the entire executed PDF without circular certificate hashing. Unicode unsupported
  by the standard font is escaped reversibly; evidence is wrapped/paginated.
- Finalisation invokes after the last governed signature. Its failure does not
  report the already-committed signature as failed. The workspace exposes governed
  recovery through `/api/execution/[id]/finalise`.
- `/api/execution/[id]/artifacts` uses `leasing.execution.view` plus entity-scoped
  version lookup. `/api/execution/completed-document` requires an unexpired,
  consumed, non-revoked signer invitation, its verified email challenge and its
  committed signature evidence. Both resolve only committed artifact paths,
  rehash downloaded bytes and return private/no-store responses. Workspace and
  signer client have download actions. No public storage URL is created.
- `request-body.ts`: bounded streaming JSON reads, even without Content-Length,
  used by the new/changed signing preparation, session, submit and recovery APIs.

### Database migrations and rollout controls

Preserved handoff WIP migration `20261015180000_execution_final_artifacts.sql` is
unchanged. Follow-on migrations correct its known gaps:

1. `20261015190000_execution_field_manifests.sql`: authorized revisioned manifests,
   immutable freeze/readiness and executed-artifact guards. Rollout explicitly
   rejects pre-existing advanced governed executions requiring manifest
   reconciliation; it does not invent retrospective signature positions.
2. `20261015200000_execution_field_completion.sql`: initials envelope, evidence
   immutability and canonical signature RPC replacement with mandatory fields.
3. `20261015210000_harden_execution_finalisation.sql`: common integrity gate,
   execution-first locks, manifest-bound artifacts, content-hash storage paths,
   idempotent stage/commit/completion and no direct application artifact writes.
   Existing duplicate WIP attempts block rollout for explicit reconciliation;
   none are silently deleted. Conflicting retry bytes fail for recovery.

Execution `sha_hash` transitions from frozen source hash to executed PDF hash at
completion, as the handoff finalisation intended. The manifest guard recognizes
only the exact committed final artifact for that transition. Source provenance
remains in document versions/signing documents/manifest and certificate.

All three new migrations, the unchanged final-artifact migration and the selected
actual prerequisite DDL/functions are executed in local embedded PostgreSQL tests.
The full historical Supabase migration chain has NOT been replayed in this batch.
No production migration or live-data operation was executed. Deployment, including
all live-schema dependencies, existing records/triggers/grants and migration
preflight outcomes, requires established-environment review and explicit approval.
Public signing/OTP flags were not enabled.

### Actual verification and limits

Run: `node --test tests/execution/*.test.mjs`.
- 107 tests passed, 0 failed, 0 skipped.
- 45 database/service/API integration tests use actual selected repository schema,
  actual migrations/RPCs and actual TypeScript signing/finalisation/retrieval
  services. Supabase transport/storage are local query/byte-map adapters.
- Fixture permission/auth functions model allowed/denied actors/entities; API
  authority tests replace JWT transport. These do NOT prove real JWT, deployed
  `has_entity_permission`, complete production RLS or provider behavior.
- Tests cover manifest authority and identity, readiness failure/freeze,
  stale-edit rejection, exact retries, mandatory field completion, sequential
  signing, replay rejection, distinct initials, immutable evidence/artifacts,
  path scoping, finalisation outage/recovery, source/storage tampering, private
  retrieval, expired/foreign verification and executed-state bypass rejection.
- Injected executed-audit failure rolls back execution completion while preserving
  committed artifacts for recovery.
- Interleaved finalisation callers converge on one artifact pair and one completion
  event. Embedded PostgreSQL uses one connection: real independent-session lock
  contention, deadlocks and process-crash recovery are NOT proven by that test.
- Original-page geometry independently rasterized at rotations 0/90/180/270 and
  nonzero crop origin; PDF operator and field/date rejection tests remain passing.
- Stream limits, actual image decode/read-back, ambiguous registration preservation
  and original requirement-ID/title preservation have dedicated tests.
- `npx tsc --noEmit` and `git diff --check`: passed. No build was run.
- New UI interactions, PDF worker bundling in a deployment, mobile/accessibility,
  real invitation/OTP delivery, real Supabase Storage and full lease activation /
  deposit / rental invoice flows are NOT verified here.

### Master inventory recovered

The original 221 items were found in **To do.docx**, dated 2026-09-30, and read in
full. Extracted source (trailing whitespace normalized) is `docs/requirements/source-20260930.md`.
`docs/ASSETFLOW_REQUIREMENTS.md` is the single master tracking register: all 221
original IDs/titles, 32 additional directives and 58 historical unnumbered source
follow-ups. Original IDs are unchanged; additions use separate namespaces.
A test checks all 221 imported IDs and exact titles. Historical checkmarks are
not evidence of current completion. Full reconciliation against implementation
is pending Phase 1 closure. FLO's original definition remains unresolved.

### Open defects/dependencies and readiness

- Full approval/preparation/provider signing/private distribution/activation/
  tenant+unit/deposit+initial-rental billing E2E still requires completion and
  established-environment proof. This checkpoint is NOT Phase 1 closure.
- Current nomination policy remains two signatories. Configurable witnesses and
  public drawn/uploaded capture require canonical integration; original items
  132/134/138/139 stay partial.
- Draw/upload server capabilities are preserved but not newly exposed as tested
  public flows. Automatic email/WhatsApp final-document notifications and durable
  delivery tracking are not established by download endpoints.
- Existing staged evidence after ambiguous failures is intentionally retained;
  governed reconciliation/retention tooling remains to be completed. Do not
  perform ad-hoc storage deletion or rewrite immutable records.
- Public endpoint rate-limit rollout, POPIA/retention review, real permission/RLS
  tests, independent-session concurrency, browser and provider tests remain gates
  before enabling public signing. Existing OTP/invitation limits are preserved.
- The tested native path uses simple typed signature images and detached evidence;
  no claim of a cryptographic PAdES/digital-certificate signature is made.
- Beta: controlled-pilot readiness for this execution domain is not established.
  Production: not ready. Whole-app percentages are not recalculated from a local
  signing batch. No unrelated domain or inventory item is declared closed.
- GitHub publishing remains blocked by missing runtime push credentials and prior
  integration HTTP 403. No repeat push attempt was made. Commits and complete
  recovery bundle/patch are the delivery mechanism for this checkpoint.


## 2026-10-15 governed activation and commencement checkpoint

See `docs/ASSETFLOW_DELIVERY_BASELINE.md` for the whole-platform evidence index,
measurable UX standards, detailed verification limits and open financial gates.
The single master requirement register remains `docs/ASSETFLOW_REQUIREMENTS.md`.

- `20261015220000_govern_execution_activation.sql`: shared private transactional
  activation core; existing manual `activate_lease` permission wrapper; new
  service-only `activate_executed_lease` bound to current executed document and
  approved commercial provenance. Creates tenant/contact/lease/unit/rules/private
  document link/workflow/audit together. KYC remains Pending. Unit overlap and
  ambiguous accounting configuration fail safely. Executed terms are protected.
- `app/api/execution/[id]/activate/route.ts`: explicit entity capability, bounded
  request, active version scope, rehash of signed PDF and certificate before RPC.
  `components/leasing/ExecutionWorkspace.tsx` exposes activation and billing review.
- `20261015230000_atomic_commencement_billing.sql`: authenticated, permission-
  checked server review/hash; lease and period locks; unique immutable approval;
  atomic selected charge insertion/audit. Explicit inclusive/zero VAT and no
  invented fee policy. Legacy charge period guard is now entity scoped.
- `lib/revenue/initial-billing-service.ts` calls these RPCs; old handler no longer
  posts a second time. Manual activation no longer creates rules/workflow through
  separate client requests. No receipt or held funds are created by activation.
- `WorkflowDialog.tsx` and initial billing modal provide shared native dialog,
  keyboard semantics, error/retry and review selection. Browser tests are supplied
  but unexecuted: no local browser binary; cloud localhost connection refused.
- `billing-freeze.ts` fixes lease column/entity/tenant lookup and blocks governed
  leases before unsafe legacy invoice/ledger writes. The deposit-aware atomic
  invoice integration remains unfinished; this is an explicit operational gate.

128 execution tests and 10 financial date/period tests passed; TypeScript and
whitespace checks passed. Tests use PGlite selected real DDL and fixture authority,
not deployed Supabase/JWT/RLS or independent database sessions. No build or
production migration was run. Phase 1, beta and production readiness remain open.
No GitHub publishing retry or main merge was attempted (existing HTTP 403 blocker).

## 2026-10-15 commencement invoice and shared financial posting checkpoint

### Canonical ownership and records

`InitialBillingService` now prepares/reviews charges, approves them using the
existing RPC and issues the invoice through `issue_lease_commencement_invoice`.
The initial billing modal selects explicit payment terms from the existing
`payment_terms` catalogue (zero days is valid). No new payment policy is invented.
The lease workspace reports success only after invoice issuance. A failed issuance
leaves the approved charges recoverable, with no partial financial records.

Migrations `20261016000000_atomic_commencement_invoice.sql` and
`20261016010000_govern_financial_posting.sql` extend existing tables and primitive:

- Private `atomic_post_journal_internal` is the renamed existing journal/GL
  primitive. The canonical public `atomic_post_journal` delegates to it with
  capability, entity, source, amount, dimension, balance, replay and period checks.
- Commencement issuance locks the lease and exact statement/financial periods,
  consumes the immutable approved source charges, checks classifications/amounts,
  creates invoice/lines and calls that same journal primitive. Rent credits income,
  refundable deposit credits liability, VAT credits configured output VAT, and
  gross due debits configured AR. It never creates cash or confirms held funds.
- Database `post_journal_tenant_ledger` is the atomic tenant projection of the
  existing SubLedgerEngine, not a second ledger. Only configured AR lines affect
  tenant balances, serialized by tenant advisory lock. Browser code no longer
  projects both sides of journals into the tenant ledger. Supplier/broker/bank
  projections remain in the existing SubLedgerEngine and need further verification.
- Invoice, lines, journal, GL, tenant ledger, statement, workflow completion and
  durable audit commit together. Unique lease/charge identities prevent duplicates.
  Exact committed recovery works after period closure; changed terms/source lines
  fail safely. Financial records cannot be forged around the command through the
  former browser table grants. Existing non-governed invoice CRUD is preserved.
- Shared posting now requires explicit `finance.journal.post`, registered without
  automatic grants. An administrator must assign it through canonical RBAC before
  rollout; test fixtures grant it explicitly. No deployed permission was changed.
- Shared rules resolve configured account roles and entity VAT instead of assuming
  15%. Posting amounts round to cents; zero-value template lines are skipped.
- Billing assembly scopes periods/properties to the entity, uses approved
  commencement lines without adding recurring rent/deposit again, and honors
  once-only/effective-to rule scheduling. The freezer delegates commencement
  issuance to the same RPC and rejects using it for a different recurring period.

### Verification and boundaries

Selected actual repository DDL, invoice immutability trigger, canonical signing,
PDF finalisation, activation, billing RPCs, TypeScript InitialBillingService,
PostingEngine, FinancialRulesEngine, FormulaEngine, SubLedgerEngine and tenant
report provider are exercised locally. Supabase transport, auth/permission context,
provider dispatch and storage are fixture adapters; date values are serialized as
PostgREST dates. Actual TypeScript posting is tested with a configured 12% VAT
rate, proving the old 15% assumption is gone. Failure injection proves audit
failure rolls invoice/journal/ledger creation back and retry succeeds.

Still required: full deployed migration chain/JWT/RLS, independent-session lock
contention/deadlocks, real provider invitation/OTP/delivery and browser workflows.
No browser executable is installed; the separate cloud browser previously could
not reach localhost. Executable UI tests/fixture remain under `tests/ui` and are
not reported passed. No build, deployment, main merge or live-data operation ran.

This closes the local commencement invoice integration gap; it is not Phase 1
certification. Recurring governed invoice issuance is a distinct remaining gate.
The legacy deposit-register engine still confuses obligation with held funds and
is deliberately not invoked by this path. Existing affected records require
reconciliation before repair. Supplier multi-line source identity, credit notes
and reversals require separate coherent financial verification; they are not
certified by this checkpoint. Historical tenant projections are not rewritten.

Actual financial checkpoint checks: 143 execution/integration tests passed,
including 75 database/service cases; `npx tsc --noEmit` and `git diff --check`
passed. No browser/provider/deployed-Supabase pass is claimed. Full-list recovery
artifacts include complete diffs and logs. Beta and production readiness remain
unestablished; local commencement integration is implemented and tested.

## 2026-10-15 canonical maintenance preparation checkpoint

### Existing implementation and defects

Both `lib/maintenance/engine.ts` and the property operations service used the
same `work_orders` table with different creation logic and status vocabularies.
The issue-based creator inserted a nonexistent `category` column, omitted issue
unit/tenant context, advanced issue state before verified work and relied on
non-durable events. The issue workspace's Create Work Order control had no
handler. Unit defaults `vacant`/`active` also violated the existing CHECK values.

### Implemented path

`MaintenanceEngine.createWorkOrder` now delegates to
`WorkOrderService.prepareFromIssue`, which calls `prepare_maintenance_work_order`.
Existing property operations records, `work_order_events`, `property_timeline`,
maintenance issues and entity SLA configuration remain canonical. No separate
maintenance product, approval engine or channel-specific business logic was added.

Migration `20261016020000_prepare_maintenance_work_order.sql`:
- Explicit `maintenance.work_order.create`, with no automatic role grants.
- Locks the issue, validates entity/property/unit/tenant/lease/asset context,
  detects conflicting historical duplicates and recovers exactly one existing
  order. Does not delete or overwrite those duplicates.
- Maps existing issue priorities to the existing property work-order vocabulary.
  Requires exactly one active configured SLA, preserving deadline origin at the
  original report time. A response breach already reached is flagged immediately.
- Creates one **reported** preparation record, original issue link, actor evidence,
  work-order event and property timeline in one transaction. It does not advance
  issue progress, approve expenditure, assign a supplier, create an invoice or
  claim the job is completed. Original channel remains on the linked issue.
- Protects issue-bound context from browser insertion/rebinding, prevents deleting
  the prepared work order and makes work-order audit history immutable.
- Corrects unit defaults only; no operational data backfill is performed.

The issue workspace uses `PrepareWorkOrderAction` with an actual command,
recoverable errors, busy/committed states and 44px actions. It now handles loading
failures/retry, uses theme tokens and stacks the timeline/details on smaller
screens. Unwired quote/assignment controls are explicitly unavailable. The UI
fixture/browser runner includes the same actual action component and a synthetic
failure/retry adapter; it is executable but not browser-verified here.

### Actual verification and remaining gates

Nine maintenance integration tests pass against selected actual PostgreSQL DDL,
with actual maintenance and property service entry points. Tests cover permission
and context denial, missing SLA rollback, original SLA origin/breach, retained
asset, terminal/duplicate issue rejection, audit failure/atomic retry, single
canonical event and prevention of browser rebinding/deleting audit evidence.
The source fixture includes a WhatsApp-origin issue; this does **not** verify
WhatsApp ingestion, sender identity, provider delivery or the whole channel flow.

Flagship maintenance remains partial: quotation requests, delegated approval
limits, emergency authority, contractor assignment/acceptance, visit evidence,
verified completion, supplier invoice/budget/cost allocation and notification
recovery still need integration. Other work-order transition/assignment paths
remain competing mutation boundaries and are not certified by this preparation
command. Tenant-charge approval and emergency bypass are not invented here.

### Final batch checks and readiness

- 165 tests passed using `node --test tests/execution/*.test.mjs tests/maintenance/*.test.mjs`.
- 10 financial date/period tests passed using native TypeScript execution.
- 8 native document-conversion tests passed (overlapping domain coverage, not
  eight additional certified workflow legs).
- `npx tsc --noEmit` and `git diff --check` passed. No build was run.
- Financial recovery now restores the originally issued payment-term selection
  and rejects missing tenant ledger evidence. Manual and executed lease first
  periods use the same approved commencement authority. Both `once` and legacy
  `once_off` schedules cannot repeat; expired/unknown rules cannot silently bill.
- Five new migrations were exercised locally with selected real DDL and fixture
  authority/RLS; none deployed. Full Supabase migration/JWT/RLS, independent DB
  sessions, browser and provider verification remain mandatory environment gates.
- Local browser dependency: Playwright is present but its browser binaries are
  absent. The separate cloud browser previously returned ERR_CONNECTION_REFUSED
  for localhost; it cannot certify this isolated UI. No screenshot/AA/mobile pass
  is claimed. Real invitation/OTP, Storage and document delivery need configured
  controlled providers and the established Supabase test environment.
- Beta: complete controlled-pilot workflow readiness not established. Production:
  not ready. Confidence is high for the listed local results and limited for
  deployed/channel/UI behavior. Phase 1 is not certified complete.

Next coherent operational priority: integrate maintenance quotation/approval and
contractor assignment through the canonical work-order command boundary, then
visit/completion and supplier financial processing. In parallel preparation for
independent review, validate full migration order and explicit new capabilities
in the established non-production environment. Shared supplier posting/reversal
and historical deposit/tenant projections remain financial gates; see the master
register's defect evidence. No production data, deployment, main merge or repeated
GitHub push attempt occurred. Publishing remains blocked by prior HTTP 403.


### Explicit commercial tax authority and lease-specific tenant policy

Checkpoint extends 810b60f without replacing the canonical workflow. Migrations
`20261016030000_explicit_commencement_tax_classification.sql` and
`20261016040000_govern_commercial_parking_terms.sql` are locally exercised,
**not deployed**. They replace existing canonical functions in place; the changed
create/update/manual-activation signatures remove the former overloads explicitly.
Full dependency/migration-order validation in isolated Supabase remains required.

- Positive parking charges require an agreed rate, explicit inclusive/exclusive/
  not-applicable treatment and an unambiguous active entity tax mapping. Parking
  uses the configured `parking_income` role, not utility recovery income.
- Actual opportunity create/update RPCs and forms carry these terms. Commercial
  submission freezes them in the version snapshot, rejects incomplete parking
  and prohibits resubmission from later lifecycle states. Generation resolves
  only that snapshot and requires approved document mappings for all four parking
  fields when bays are allocated. Existing templates need governed mapping review;
  no silent omission or automatic template approval is introduced.
- Positive lease fees require explicit billing-policy tax treatment/code.
  Inclusive amounts split into rounded net and VAT; refundable deposits remain
  NO_VAT. Tax is configured per entity. Unapproved review hashes become stale on
  tax changes; approved charge evidence is not recomputed at invoice issuance.
- Billing policy UI exposes entity-scoped classification, loading/error/retry
  and permission-aware controls. The database enforces the new explicit
  `finance.billing_policy.manage` capability; it is **not auto-granted**.
  `maintenance.work_order.create` and `finance.journal.post` similarly require
  deliberate role setup in the non-production validation environment.
- Each new lease creates its own tenant account, including identical legal names
  and VAT numbers. No automatic merge or VAT uniqueness blocker. Manual guided
  capture requires explicit contractual VAT/deposit/escalation, selected context
  and fresh validation. Server transaction rejects inactive/foreign property,
  inactive/foreign unit and overlapping operational lease dates.
- The legacy tenant-upload UI had mock OCR and public storage URLs. It now directs
  document preparation/execution to `/commercial-leasing`; the legacy intake
  activation API returns `410 GOVERNED_ACTIVATION_REQUIRED` with that workspace.
  It cannot guess rent/deposit/parking/tax and activate an ungoverned intake.
  This is a deliberate fail-closed behavior change, not completed imported-lease
  OCR. Controlled historical executed-lease import, document registration and
  recoverable manual activation still require a dedicated verified workflow.

Additional local tests cover real create/update/submission-to-generation values,
required parking mappings, stale submission/edit rejection, incomplete parking,
inclusive fee/parking, explicit non-VAT parking, changed and ambiguous tax maps,
policy permission denial, separate lease tenant identities, manual explicit terms,
inactive property and the retired legacy endpoint. Actual signing/PDF-finalisation
and invoice/GL/tenant report tests remain preserved. The end-to-end scope is local
canonical services with selected real DDL, fixture auth and storage transport;
it is not a deployed full-application/provider journey.

The original 221 + 32 additional + 58 source follow-up requirements remain in the
single register. Whole-platform reconciliation is still incomplete. Deposit
receipts/reconciliation/refunds/reversals, recurring issuance, supplier atomic
posting, maintenance quote/authority/contractor/completion and WhatsApp provider
integration remain explicit open gates. No beta or production certification.


## 2026-10-16 governed maintenance execution and financial closure

Checkpoint extends 59491f48b7f97daf6b105f08673d21e2cf42a5ef without replacing
lease execution, commercial terms, commencement billing or previous recovery artifacts.
`workOrderService.commandLifecycle` is the canonical transition boundary for
issue-bound work orders. SQL migration 20261016050000 reuses maintenance_quotes,
maintenance_approval_rules, purchase_orders, supplier_visits, work_order_events
and expected_supplier_invoices. Client mutations cannot bypass commands. Matching
is advisory, not contractor authorization. Explicit new capabilities require
configured role grants; legacy approval labels never imply spending authority.

`apApi` → `apEngine` → maintenance invoice RPCs (20261016060000) reuse
supplier_invoices_new/supplier_invoice_lines, atomic_post_journal_internal,
general_ledger and sub_ledger_entries. Supplier projection now occurs atomically
on AP-control lines only; the old client-side all-line supplier projection is
removed. Invoice cost and configured VAT reconcile to certified gross cost.
The source document hash and independent approver are retained. Replay verifies
GL/subledger evidence; posted invoice data cannot be altered through browser CRUD.

20261016070000 extends existing transaction_allocations with a distinct AP invoice
FK and authoritative payment journal. It never repurposes the existing AR invoice
FK or initiates a bank transfer. Scoped allocation review and reconciliation are
exposed through the same AP service and maintenance workspace. Financial closure
requires full verified payment allocation, same-entity/account statement coverage,
canonical payment journal, balanced GL and supplier evidence. Operational states
completed/verified remain separate from closed. Partial payments remain open.

Local SQL uses actual selected repository DDL, fixture auth/permissions and PGlite.
Actual TypeScript work-order and AP service entrypoints are exercised against
those RPCs. Tests include retries, stale competing commands, rollback on audit
failure, entity isolation, VAT, closed periods, overpayment, incomplete statement
proof and corrupted ledger evidence. Single PGlite execution is not independent
Postgres session concurrency. No live provider, browser or production claim.
See `docs/MAINTENANCE_DELIVERY_20261016.md` for evidence and remaining gates.

The new AF-MAINT register namespace preserves the entire expanded maintenance,
WhatsApp and inspections acceptance scope. Existing WhatsApp webhook phone-only
identity and unsigned inbound processing are unsafe; secure provider/identity
ingress is the next dependency. Existing inspection engine completion ignores
update errors and lacks demonstrated atomic evidence/defect integration. Neither
is certified. No public signing/WhatsApp enablement or production change occurred.

## 2026-10-16 verified-account WhatsApp maintenance ingress

Base 90922f1 security/PDF/spreadsheet remediation retained. See
`docs/WHATSAPP_INTAKE_20261016.md` for exact boundary and preserved-checkout comparison.
Entry: maintenance workspace → `/maintenance/whatsapp` → authenticated pairing API
→ signed provider webhook → `lib/communications/server/whatsapp-intake.ts` → durable
receipt RPC → transactional processing → private shared preparation body. Migration
20261016120000 adds transport binding/inbox tables with RLS and no direct client
access; it extends, not replaces, canonical issue/work-order/audit records.

Caller identity is authenticated account plus one-time number pairing, with current
entity permission on every mutation. Phone-only lookup and legacy tasks-based intake
are removed from the provider endpoint. Scope is authorized-account text requests;
tenant self-service, media, routing, live provider/browser and full conversation
quality remain open. No deployment or new capability auto-grant. Provider replay
returns committed outcomes; failed preparation retains inbox and rolls back issue,
order and audit. Existing finance/deposit and security dependency work is preserved.

## First-client onboarding — 2026-10-16 integration milestone

Entry: `/signup` handles new registration, email-confirmation waiting, and an
already-authenticated user without membership. It calls
`lib/onboarding/service.ts` -> `provision_client_account` with the caller's
Supabase session and verified email. No browser entity insert, service-role key,
legacy `provision_workspace`, or parallel financial bootstrap is used. Client,
legal entity, entity code and organisational role are explicitly supplied; the
role label is not operational authority. Completion reloads `/app` to refresh
canonical providers. `/welcome` legacy data-entry shortcuts are not used.

Migration `20261016140000_retry_safe_client_onboarding.sql` preserves the canonical
provisioning body and adds actor-scoped transaction locking and a private RLS
receipt. Client graph, financial foundation and receipt commit atomically.
Retries return the original result (they do not rename or create another client).
Existing membership without a receipt requires administration; suspended,
removed or demoted receipt owners cannot recover obsolete authority. Platform
roles remain unchanged. Canonical template accounts and posting lines must exist;
an empty template foundation fails rather than reporting false completion.

The protected layout uses verified identity and fails closed on membership or
network errors, with retry/sign-in recovery. Unassigned users can choose initial
setup or request existing-client access. Login no longer logs session tokens.

Local verification: actual TypeScript service -> canonical provisioning SQL ->
actual Standard Access and financial-foundation functions in embedded PostgreSQL;
auth/role fixtures and selected actual table DDL, not the full deployed RLS stack.
See `docs/CLIENT_ONBOARDING_20261016.md` for tests and outstanding staging gates.
The migration has NOT been deployed by this development batch. WhatsApp scope,
release candidate 13a8467, staging configuration and Production are unchanged.

## Flow statement orchestration — 2026-10-16

Independent branch based on ae738aae; see `docs/FLOW_STATEMENTS_20261016.md`.
`/flow` → authenticated `/api/flow/statements` → private canonical SQL action
commands → issued monthly statements → existing PDF renderer → exact manifest
review → operation-specific approval → existing communications queue/provider.
Verified WhatsApp ingress creates the same action and returns a web-review reference.

Core files: `lib/flow/statement-intent.ts`, `lib/flow/statements.ts`,
`supabase/migrations/20261016180000_flow_statement_actions.sql` and `tests/flow`.
No financial engine, configuration or posting changes. New client-assigned prepare
and send capabilities, private action/attachment access, immutable audit, source
revalidation, approval expiry and duplicate-claim protections. Provider acceptance
is distinct from delivery; unknown outcomes require reconciliation, never automatic
resend. Existing email adapter/worker now avoid invented IDs/delivery claims.

237 local tests pass, including 23 Flow tests; TypeScript and diff checks pass.
Embedded SQL and controlled transport tests are not deployed certification.
Independent-session races, full Supabase RBAC, browser acceptance and real provider
acceptance/delivery remain staging gates. No deployment or main merge performed.
