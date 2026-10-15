# AssetFlow delivery baseline — 2026-10-15

Historical baseline at dd0bbab. The later commencement-invoice/shared-financial and maintenance
checkpoints in ASSETFLOW_SYSTEM_MAP.md supersede its blocked invoice notes;
remaining recurring, deposit receipt, provider and deployed-environment gates
remain open.

This is an evidence index supporting the single requirement register in
`docs/ASSETFLOW_REQUIREMENTS.md`, not another requirement inventory. The recovered
221 original requirements, 32 additions and 58 source follow-ups remain intact.
Whole-platform reconciliation is in progress; no domain below is certified from
file existence. Changes in this checkpoint focus on execution and commencement.

## Whole-platform discovery baseline

| Domain | Existing implementation entry points | Verification boundary / next gate |
| --- | --- | --- |
| Identity, onboarding, permissions | `app/auth`, `lib/auth`, `lib/rbac`, `lib/supabase` | Real JWT, enrollment, RBAC and full deployed RLS not tested here; onboarding journey needs discovery. |
| Companies, portfolios, properties, units | `lib/portfolio`, `lib/property-operations`, `app/(protected)/properties` | Activation checks property entity and unit ownership locally; broader hierarchy and cross-entity operations unverified. |
| Executive dashboard and widgets | `lib/dashboard`, `app/(protected)/executive`, `app/components/dashboard` | Candidate code located; operational correctness, performance and rendered UX unverified. |
| Tenant CRM and ledgers | `app/(protected)/tenants`, `lib/reporting/providers/tenant-ledger.ts`, `lib/financial/sub-ledger-engine.ts` | Tenant/contact activation tested locally; full ledger allocation and reconciliation unverified. |
| Leasing, approval, templates, documents, signing | `lib/leasing`, `lib/execution`, `lib/document-intelligence`, `components/leasing` | Local execution tests; providers, public rollout and established-environment approval-to-signing E2E remain open. |
| Activation, deposits, billing | `lib/workflow/services/lease-activation-service.ts`, `lib/revenue`, `lib/financial/deposit-engine.ts` | E2 below. Deposit engine incorrectly treats an obligation as held funds; new activation does not invoke it. Invoice/ledger integration remains blocked. |
| Revenue and invoicing | `lib/revenue/billing-assembly.ts`, `lib/revenue/billing-freeze.ts`, `lib/revenue-command` | Existing freezer accepts worksheet amounts and generic rental events; governed executions now fail closed before writes. One-time rule repetition/effective-to and charge consumption need correction. |
| Bank import, cash book, allocation | `lib/banking`, `lib/cashbook`, `lib/treasury` | Ten financial date/period tests passed; these do not verify reconciliation, completeness, settlement or allocation workflows. |
| GL and period governance | `lib/financial`, `lib/periods`, `lib/banking/financial-period-governance.ts` | Commencement period scope and rollback tested locally; actual GL posting/concurrent period closure unverified. |
| Suppliers, expenses, VAT | `lib/accounts-payable`, `lib/suppliers`, `app/(protected)/suppliers` | Candidate implementation located; invoice capture-to-post/payment-to-reconciliation unverified. |
| Maintenance, contractors, inspections | `lib/property-operations/services/work-order.service.ts`, `lib/maintenance`, `lib/inspections`, `app/api/property/work-orders` | Canonical overlap must be resolved by tracing actual callers before extension. SLA, emergencies, work orders, contractor/invoice closure and channel journeys unverified. |
| Notifications, tasks, calendars | `lib/platform/notifications`, `app/(protected)/tasks`, `app/(protected)/calendar` | Candidate implementation located; durable dispatch, ownership, retries and actual delivery unverified. |
| WhatsApp and email | `lib/channels`, `lib/communications/providers`, `lib/conversation` | Provider adapters exist; canonical identity/permission/command integration and provider receipts unverified. No independent channel business logic introduced. |
| Reporting and intelligence | `lib/reporting/providers`, `lib/intelligence`, `lib/analytics` | Candidate implementation located; report-to-ledger tie-out and governed AI controls unverified. |
| Insurance, acquisition, disposal, investors | `lib/portfolio`, requirement register | Dedicated complete journeys not established; do not infer Missing from this limited discovery. |
| Search, automation, activity, AI | `lib/intelligence/search`, `lib/workflow`, `lib/platform/events`, `lib/audit` | Multiple workflow directories require caller tracing; global completeness and event recovery unverified. |
| Administration and security | `app/(protected)/admin`, `lib/rbac`, `lib/governance`, migrations | Selected activation/signing boundaries locally tested; security review and production policies remain gates. |
| Marketing, waitlist, customer onboarding | `lib/marketing.config.ts`, `lib/marketing.metadata.ts`, public routes | Assets/configuration located; conversion, waitlist persistence and onboarding completion unverified. |

## E2 — activation and commencement checkpoint

Before: execution artifacts were available, but no governed executed-opportunity
activation command connected them to a tenant/unit and billing review. Manual
activation created rules/workflow through separate client operations. Billing
approval had two posting callers and check-then-insert retries, with default fees
and account/tax fallbacks. The legacy period guard was not entity scoped.

Implemented: a private shared activation transaction, permission-specific manual
and service wrappers, version/provenance binding, committed artifact rehash at the
API, overlapping-unit rejection, KYC Pending, canonical tenant/contact/lease/unit,
private signed-document linkage, rules and durable workflow/audit records.
Contractual executed terms cannot be edited without a governed amendment.
Initial billing is calculated by PostgreSQL, approved by exact review hash and
selected types, atomically inserted and audited once under lease/period locks.
Missing/ambiguous account or tax configuration fails safely; inclusive and
zero-rated amounts remain explicit. No policy means no additional fee. No
receipt, bank confirmation, held deposit, invoice or journal is invented.

Shared billing review now uses a native modal, focus restoration, explicit error
recovery, semantic headings/table labels, selectable lines and 44px actions.
Actual browser verification is **blocked**: local Playwright has no installed
browser executable; the separate cloud browser returned ERR_CONNECTION_REFUSED
for the isolated server. The reusable synthetic adapter fixture and browser
runner are preserved under `tests/ui`; they do not prove a real backend journey.

Verification: `node --test tests/execution/*.test.mjs` (128 passed); financial
period/date tests (10 passed); `npx tsc --noEmit` passed. Database tests execute
selected real schema/migrations using PGlite, with fixture auth/permission
functions and local storage adapters. They demonstrate rollback, permission and
entity denial, stale authority/hash rejection, immutable executed terms,
idempotent retries, explicit VAT, selected charge validation, closed-period
rollback and cross-entity legacy period isolation. API tests inject transport
and authority; real JWT/RLS, independent-session contention/deadlocks/crash
recovery and the full migration chain remain unverified. No migration deployed.

## Open engineering gates

1. Replace unsafe legacy worksheet issuance with an authoritative, atomic invoice
   command consuming approved charge identities and canonical posting rules;
   deposit obligations must post to liability, with correct VAT and GL tie-out.
   Resolve commencement vs recurring rent duplication, once-only rule scheduling,
   effective end dates, entity scopes, escalation and payment-term schema drift.
2. Correct deposit obligation/held-funds distinction through the existing deposit,
   receipt/allocation and reconciliation services. Never backfill money as held
   merely because a lease was activated. Audit existing affected records first.
3. Reconcile the other legacy `activate_lease_rpc` entry point and callers; preserve
   intake behavior while establishing one authority. No claim that this overlap
   has been eliminated platform-wide.
4. Full established Supabase migration chain, JWT/RLS/grants, real independent
   sessions, providers, private delivery, browser accessibility/mobile tests and
   complete approved-lease-to-issued-invoice-to-ledger E2E.
5. Continue item-level reconciliation across all 311 register entries and flagship
   maintenance integration after the lease/financial workflow is closed. FLO's
   intended definition remains unavailable.

## Measurable product and UX standard

Preserve brand and shared primitives. Require visible keyboard focus, accessible
names, semantic headings/forms/tables, modal containment/restoration, explicit
loading/empty/error/retry states and no color-only risk indication. Target WCAG AA
contrast (4.5:1 normal text, 3:1 large text/control boundaries), 44px primary touch
actions, reduced-motion support, and no document overflow at 320/390/1440px.
Dense financial tables may scroll inside a labeled region. Consequential reviews
must display exact amounts, tax, entity, scope and committed result, preserving
input on failure. These are acceptance targets, not platform-wide pass claims.

Measure representative p95 interaction response below 200ms and server read
response below 500ms under an agreed pilot workload; capture error/retry rates,
query counts and accessibility checks before declaring performance verified.
Financial amounts remain deterministic; UI estimates never authorize posting.

## Readiness assessment

Beta: **not ready for the complete pilot lease workflow**. Production: **not
ready**. Confidence is high for the listed local test results and low for
platform-wide integration. A defensible whole-application completion percentage
cannot yet be calculated: most of the 311 requirements lack integration evidence.
Unknown gates are not counted as passed, and no prior percentage is invented.
The concrete progress measure is 21 added execution tests over the previous
107-test checkpoint, plus 10 existing financial regression tests. Phase 1 remains
open. Independent review and established-environment testing are required.
