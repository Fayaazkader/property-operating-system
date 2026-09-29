# AssetFlow — Production Hardening Register

Status: Architecture and Settings audit complete; implementation pending.
Branch: main
Principle: Preserve working functionality, correct underlying architecture, and verify each milestone before deployment.

## 1. Target architecture

- Platform administration is separate from client administration.
- A client account contains users, access profiles, legal entities and client-wide configuration.
- Job titles describe responsibilities; access profiles and permission overrides determine authority.
- Client Super Users can administer their client without individual entity assignments.
- Operational records and financial transactions remain scoped to their legal entities.
- Financial posting, lease governance, communications and document intelligence use shared, governed services.
- Twilio and SendGrid are the intended production communications providers. WATI is potentially legacy, pending dependency verification.

## 2. Completed foundations

- Canonical client accounts, membership and descriptive role types.
- Permission catalogue, access profiles and individual overrides.
- Client Super User model and entity assignments.
- Governed client-administration commands and authorization resolver.
- Testing client bootstrap.
- Settings page-level audit and initial financial, leasing and communications architecture review.

Existing foundations must be reused rather than recreated.

## 3. Confirmed release blockers

### FIN-001 — Journal-posting authorization
The deployed atomic_post_journal function has excessive execution privileges and insufficient internal authorization and validation.

Required:
- Establish the contract of every existing posting caller.
- Introduce a trusted, governed posting boundary.
- Enforce user authorization, entity and account ownership, period validity and journal balance.
- Restrict direct execution without breaking legitimate workflows.

Acceptance:
- Unauthorized and cross-entity posting fails.
- Closed-period and unbalanced posting fails.
- Authorized posting succeeds.
- Existing source-event idempotency remains intact.

### FIN-002 — Supplier invoice posting
The current per-line posting approach conflicts with journal source-event idempotency.

Required:
- Produce one complete balanced journal per supplier invoice.
- Make invoice state transitions consistent with posting success.
- Handle failed line capture and supplier balance updates reliably.

Acceptance:
- Multi-line invoices post completely once.
- Retries do not duplicate journals.
- Failed posting does not mark an invoice as posted.

### FIN-003 — Ledger consistency
General-ledger posting and subsequent subledger updates are not one atomic operation.

Required:
- Define transactional or durable recovery guarantees.
- Prevent inconsistent concurrent running balances.
- Provide reconciliation and recovery for partial downstream failures.

Acceptance:
- Every posted journal has its required subledger records.
- Failures are recoverable and auditable.
- Concurrent posting does not corrupt balances.

## 4. Client administration

### ADM-001 — Canonical Settings cutover
Replace legacy Users, Roles and entity-administration operations with canonical client-scoped services.

Acceptance:
- Super Users can administer their client with zero entity assignments.
- Ordinary users cannot administer another client.
- Invitations, suspension, access profiles, entity assignments and overrides work.
- Existing authentication and operational navigation remain functional.

### ADM-002 — Feature governance
Separate platform entitlements, client feature configuration, canonical permissions and personal preferences.

Acceptance:
- A feature cannot bypass required permissions.
- Targeted rollout fails closed when required user or role context is missing.
- Configuration failures are surfaced.
- Client administrators cannot grant themselves platform entitlements.

## 5. Financial configuration

### CFG-001 — Authoritative accounting configuration
Consolidate GL mappings, posting rules, tax configuration, financial controls and document-specific defaults.

Required:
- Verify consumers before migrating configuration.
- Eliminate hardcoded mappings where governed configuration is required.
- Correct event-date and entity-specific financial-period validation.
- Preserve existing financial workflows.

Acceptance:
- Each setting persists to its authoritative source.
- The relevant operational engine consumes the saved setting.
- Invalid configuration prevents unsafe posting.

## 6. Settings and operational administration

### SET-001 — Functional Settings
Remove duplicate configuration paths and replace inert controls and misleading success messages.

Scope:
- Organisation, entities, branding and properties.
- Financial configuration and billing policies.
- Notifications, communications and integrations.
- Security, audit access and personal preferences.
- Operational administration and automation configuration.

Acceptance:
- Every displayed Save action persists or reports a meaningful failure.
- Read-only or unavailable features are clearly identified.
- Sensitive settings enforce canonical permissions.
- Lists are appropriately scoped and support required pagination.

## 7. Communications and document intelligence

### COM-001 — Provider consolidation
Preserve Twilio and SendGrid. Verify WATI dependencies before any retirement.

### COM-002 — Message lifecycle
Verify outbound queues, inbound webhooks, recipient resolution, preferences, templates and delivery tracking.

Known issue:
Unknown provider statuses currently default to delivered in the inspected delivery webhook.

Acceptance:
- Provider signatures are verified.
- Unknown statuses cannot falsely mark delivery successful.
- Updates are isolated to the correct communication.
- Retries and duplicate provider events are handled safely.
- Existing WhatsApp document ingestion and shared OCR remain functional.

### DOC-001 — Lease-template governance
Preserve existing review, evidence and approval workflows.

Required:
- Enforce canonical approval permission inside the transactional approval function.
- Correct draft-update field mapping.
- Make draft family/template creation consistent.
- Verify template ownership, versioning and archival behavior.

Acceptance:
- Unauthorized approval fails.
- Incomplete review cannot activate a template.
- Approval and audit recording remain atomic.
- Approved templates remain usable in the existing lease workflow.

## 8. Implementation order

1. Financial posting security and transaction integrity.
2. Canonical client-administration UI and legacy authorization cutover.
3. Authoritative Settings and financial configuration.
4. Communications, automation and lease-template governance.
5. End-to-end regression, security and beta-readiness validation.

Dependencies may require coordinating individual changes across phases.

## 9. Implementation protocol

For every change:
- Inspect the exact affected contract and its callers.
- Explain the proposed behavior and migration.
- Preserve existing data and unrelated functionality.
- Implement the smallest coherent architectural change.
- Run relevant database, authorization, TypeScript and workflow tests.
- Record the result and outstanding issues here.
- Commit and push only after a verified milestone.

Do not automatically assign the seven currently unassigned legal entities to the Testing client.
Do not remove WATI until dependencies have been verified.
Do not delete the untracked audit and validation files.

## 10. Progress log

- Audit completed: Settings pages, canonical client foundation, key financial posting paths, lease-template approval and communications file inventory.
- Implementation: Not started.
- Next: Verify the existing financial-posting caller contracts before modifying the privileged posting function.

## 11. Utility Intelligence and Tariff Governance

### UTIL-001 — Municipal and Eskom invoice intelligence

Extend the existing shared OCR engine to support municipal and Eskom invoices.

Capture:
- Supplier, municipal account, property and billing period.
- Financial totals, VAT, previous balances and payments.
- Expense categories: rates, electricity, water, sewerage and refuse.
- Meter numbers, readings, consumption and billing days.
- Applicable tariffs, demand measurements and relevant cost components.
- Original document and evidence supporting extracted values.

Maintain separate but linked financial-invoice and utility-consumption records.

### UTIL-002 — Tariff governance

Maintain versioned tariff schedules for each supplier, municipality and applicable tariff.

- Record effective dates, tariff codes, consumption bands, fixed charges and demand charges.
- Schedule annual tariff reviews, normally ahead of July where applicable.
- Allow different effective dates for individual suppliers.
- Retrieve updated tariffs from authoritative published sources.
- Request updated tariff documents when reliable information is unavailable.
- Require verification before using new tariffs for financial calculations.

### UTIL-003 — AI utility analysis

Use verified tariff schedules and historical consumption to:
- Detect abnormal electricity and water consumption.
- Identify potential under-recoveries and over-recoveries.
- Compare eligible alternative tariffs.
- Estimate potential savings and explain the assumptions.
- Detect possible water losses and billing discrepancies.
- Identify tenant recovery rates that have not been updated.

Recommendations require human approval before operational changes.

### UTIL-004 — Acceptance criteria

- Johannesburg, Emfuleni and Eskom sample invoices can be processed.
- Financial totals reconcile independently of consumption data.
- Meter readings and tariff information remain available for analysis.
- Uncertain OCR results require review.
- Historical invoices retain the tariff version applicable to their billing period.
- Missing or unverified tariffs cannot silently drive financial calculations.
- Tenant-recovery comparisons respect lease terms and approved recovery rules.
