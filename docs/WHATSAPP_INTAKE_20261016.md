# Verified-account WhatsApp maintenance intake

Base: 90922f170452da95bf7251bb4f673c5e7a645f00.
Branch: work/assetflow-whatsapp-intake-20261016.

## Implemented boundary

The previous provider route accepted unsigned forms, treated a phone lookup as
identity, used a separate tasks-based maintenance handler, and contained invented
banking details, response deadlines and escalation promises. This route now uses
provider validation and the canonical maintenance transaction. Its former balance,
lease, payment and document handlers are not reachable through this endpoint.

A signed-in AssetFlow user visits `/maintenance/whatsapp`, selects a property for
which the existing `maintenance.work_order.create` capability is present, and
requests a cryptographically random connection code bound to their number. Sending
that single-use code through the signed Twilio callback proves number possession
in addition to the authenticated account authority. Codes expire after 10 minutes;
bindings expire after 24 hours and can be revoked. Every mutation rechecks the
capability. No role or spending permission is automatically granted.

This is a working authorized-account pilot path, NOT tenant self-service. The
repository has no verified tenant-user mapping suitable for granting narrow
property/unit authority. Do not grant tenants broad entity maintenance permission
as a workaround. Dedicated tenant/contact enrollment and contractor scopes remain
required before those audiences use this interface.

Provider HMAC verification uses the installed Twilio SDK, fixed HTTPS callback URL
and account SID; no forwarded header becomes signing authority. Invalid/oversized
or duplicate form fields fail before database access. The webhook service client
has no session persistence. Pairing uses the authenticated cookie client and
same-origin checks. No secret or raw connection code is persisted in the inbox.

The transport inbox commits receipt separately before processing. Unique provider
account/message identity and exact normalized payload hash detect changed replays.
Processing locks the sender and message; committed results are replayed. A failure
returns non-2xx, leaving durable receipt for retry rather than claiming success.
Issue creation, existing work-order preparation, audit and result commit together.
The shared preparation body now has a private actor-aware SQL entry point, called
only by the existing authenticated wrapper or authorized transport processing.
No duplicated work-order, contractor, billing or approval logic was introduced.

Multiple verified properties produce persisted authorized choices. A numbered
selection resolves only that sender's most recent unexpired pending request and
rechecks current permission; arbitrary or cross-sender selection fails. A created
response includes only the confirmed work-order UUID. Contractor appointment,
expenditure and dispatch are never implied. Deterministic intent recognition is
limited to maintenance text and asks for clarification otherwise. This is not the
requested full conversational intelligence layer; it must remain an explicit gap.

## Validation and deployment gates

Local suite: `node --test tests/execution/*.test.mjs tests/maintenance/*.test.mjs tests/communications/*.test.mjs`.
Financial regression: `node --experimental-strip-types --test lib/financial/*.test.mts`.
TypeScript: `npx tsc --noEmit`. No build executed.

Tests execute selected actual schema/migrations in embedded PostgreSQL, actual
application service -> durable receipt -> canonical work-order transaction, plus
actual route rejection before database construction. Cases include pairing,
unknown/unauthorized senders, foreign property/entity, ambiguous and numbered
selection, duplicate/changed replay, expired challenge, revoked binding/capability,
missing SLA and audit-outage recovery, and XML escaping. Independent PostgreSQL
sessions, real Supabase JWT/RLS deployment, browser interaction and real Twilio
requests have NOT been verified. Embedded test migration execution is isolated;
no remote migration was applied.

Required integration: reviewed migration 20261016120000, pre-existing entity
maintenance capability and routine/emergency SLA configuration, private server
SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, TWILIO_AUTH_TOKEN,
TWILIO_ACCOUNT_SID and exact TWILIO_WHATSAPP_WEBHOOK_URL. Provider retry/fallback
configuration must be demonstrated in staging. Do not enable public intake before
independent security/provider testing. Pending inbox operational monitoring,
retention, rate controls and production recovery tooling remain open.

Media is explicitly rejected with an accurate explanation; no unsafe remote URL
fetch or claim that photographs were attached. Tenant/unit/lease enrollment,
media ingestion, recurring-issue correlation, intelligent conversation continuity,
client-configurable routing/triage and real notifications are NOT complete.
The full requested tenant journey remains partially implemented. Beta: controlled
verified-account text path locally demonstrated, not rollout-ready. Production:
not certified. No unsupported readiness percentage or productivity claim.

## Original checkout reconciliation

Original checkout and all seven files remain untouched on 59491f4:

| Original file | Comparison against independently verified 90922f1 |
|---|---|
| components/maintenance/WorkOrderLifecycle.tsx | Byte-identical; already preserved upstream |
| lib/maintenance/engine.ts | Byte-identical; already preserved upstream |
| app/(protected)/maintenance/[id]/page.tsx | Older version lacks canonical invoice review integration |
| lib/property-operations/services/work-order.service.ts | Older version lacks reconciled closure command |
| 20261016050000_govern_maintenance_lifecycle.sql | Older quote read policy lacks preserved scoped legacy-quote access |
| 20261016060000_maintenance_invoice_accounting.sql | Older accounting version lacks verified AP projection/read controls |
| tests/maintenance/work-order-integration.test.mjs | Older tests lack subsequent payment/GL/subledger verification |

None were copied over the independently verified branch. Their differences were
inspected; the new branch retains the verified implementations. Earlier reported
uncommitted WhatsApp files were absent from the restored original checkout, so
this batch was implemented against actual 90922f1 source, not assumed files.

## Bulk expense dependency inventory

Existing `lib/document-intelligence/engine.ts` supplies shared OCR/classification/
field evidence; `ingestion/index.ts` contains the independently migrated spreadsheet
readers. `lib/accounts-payable/{api,engine}.ts` and maintenance invoice RPCs own AP
posting, not the communication layer. `lib/finance/bulk-governance.ts` filters bank
transactions; it is NOT a bulk expense workspace. Existing supplier invoices,
recurring UI and expectations should be reused. Generic non-maintenance AP still
needs atomic multi-line posting/approval hardening before bulk expense posting.
Next financial batch: canonical document-backed capture drafts with correction
provenance, supplier/property matching and exception review, followed by governed
AP issuance. No week-to-minutes claim is supported without representative timed
municipal-account trials.

## Final local checkpoint results

199 execution/maintenance/provider tests passed, 0 failed, 0 skipped. 10 financial
regression tests passed. TypeScript and `git diff --check` passed. Register integrity
tests passed (included in the 199, also rerun after register additions). No browser,
real Twilio, deployed Supabase or independent-session result is claimed.
