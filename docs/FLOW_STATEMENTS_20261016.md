# Flow: governed statement communications

Base: ae738aae07557bb29d8f4c530450bce083fc22b4.
Branch: work/assetflow-flow-statements-20261016.
Independent of financial-readiness d39ce9f; no financial configuration or posting changes.

## Delivered slice

`/flow` and `/api/flow/statements` accept the bounded instruction
“Send [tenant] [property] their last six months of statements”. Intent extraction
proposes a search and month count only; it has no authority to resolve records,
calculate balances or send communications. Supported range: one to twelve previous
completed calendar months, excluding the current month, explicitly shown at review.
This is a statement action, not a general-purpose conversational agent.

The existing signed Twilio ingress and verified requester bindings record the same
canonical action. WhatsApp returns a request reference; the requester opens Flow,
loads that reference, prepares PDFs and approves in the authenticated web interface.
Multiple/unverified bindings require web verification or clarification. Existing
maintenance commands continue through the prior processor. Pairing remains the
existing maintenance-account connection; finance-only pairing is not added.

Canonical reuse: Supabase session authentication, user_entity_access,
has_entity_permission, tenants, properties, leases, financial_periods,
statements_generated, tenant communication preferences, reporting PDF renderer,
communications_queue, financial_timeline and the SendGrid delivery adapter.
The existing dynamic conversation orchestrator is not a trusted authority boundary;
this action uses restricted database commands and a server service instead.

## Authority and evidence

Migration: `20261016180000_flow_statement_actions.sql`. Depends on the baseline,
including `20261016120000_verified_whatsapp_maintenance.sql`; does not depend on
the unpublished financial-readiness migration. No migration was deployed.

Client-assigned capabilities: communications.statement.prepare and
communications.statement.send. Neither is granted automatically. Entity membership
and canonical permissions are checked independently of navigation and intent parsing.
The requester approves their own exact action; approval cannot expand their authority.

Private action records hold immutable prepared document bytes and SHA-256 manifests.
Statement versions, periods, recipient and preferences are rechecked before approval.
Approval expires after 30 minutes. The authoritative tenant statement_email and an
explicit enabled email preference are required; quiet-hours configuration currently
blocks immediate sending rather than guessing a permitted schedule.

Only one issued snapshot per canonical month is accepted. Missing, competing,
unsupported or multi-property tenant account snapshots block. No zero-balance
fallbacks or invented historical statements. Supported issued data has period_id,
opening_balance, closing_balance and posted_lines with date/reference/description/
debit/credit/balance. Commencement-only charge snapshots are not treated as complete
monthly account statements. PDFs reproduce the issued data without recalculating it.

Row/advisory locks, unique requester keys and a same-snapshot send lock prevent
repeated claims and duplicate sends across new request IDs. Direct CRUD cannot
substitute queued attachments. Restrictive policies isolate Flow queue/audit rows
from permissive legacy read policies. Audit writes and queue insertion are atomic;
audit failure rolls back approval. Privileged staging and outcome commands are not
available to browser users. SQL superusers remain trusted operators.

## Submission and recovery

The existing queue stores Flow sends with flow_* statuses; the legacy worker cannot
claim them. The authenticated approval endpoint claims once and calls the existing
provider adapter with the verified attachments. Known provider rejection permits an
explicit retry while approval remains current. Unknown outcomes never automatically
retry. A repeated approval of a submitting/submitted/uncertain action cannot send.

SendGrid now returns its actual acceptance ID, requires an explicitly configured
sender and reports unknown delivery unless verified separately. The shared worker
logs acceptance as sent, not delivered, and holds uncertain email failures for
reconciliation. No external email was sent during development.

If the process stops after claim, leave the action submitting: do not reset/requeue
or create another send. An authorised operator must compare the exact queue/action,
attempt, timestamp and provider records. The service-only finish command can record
a confirmed outcome for a still-submitting matching attempt. An already recorded
reconciliation_required outcome deliberately has no automatic resend or public
operator override. A governed provider reconciliation/delivery-event integration is
still required before unattended operation. The legacy delivery webhook is not used
as proof of Flow delivery. Submitted means provider acceptance, never inbox delivery.

## Environment and verification

Requires existing Supabase public URL/anon key, server-only service-role key,
SENDGRID_API_KEY and verified SENDGRID_FROM_EMAIL; optional SENDGRID_FROM_NAME.
WhatsApp retains its existing Twilio configuration. No credentials are included.

Actual local results: 237 tests passed (23 Flow tests and 214 existing regression
tests), TypeScript validation passed, git diff --check passed. The new migration
executes against selected actual repository DDL in embedded PostgreSQL. Tests use
fixture identities/permission rows, not deployed JWT/canonical membership resolution.
They exercise real action SQL, legacy queue RLS, PDF generation/parsing, six periods,
application-service claim/finish, denial, source changes, duplicate requests,
audit rollback, retry fencing and uncertainty. Provider transport is controlled in
tests; no live provider success is claimed. Queued duplicate tests share one embedded
session and do not prove independent-session races. A synthetic PDF was rendered
and visually inspected. No Next production build was run.

Outstanding acceptance: complete Supabase migration chain and actual client RBAC,
independent PostgreSQL sessions, real Twilio/SendGrid, signed delivery correlation,
mobile/desktop browser interaction and commercial statement-format review. No
Chromium or standalone PostgreSQL/psql is available in this environment. The opt-in
`tests/flow/acceptance.browser.mjs` is executable but unexecuted; it creates only a
staging draft, checks responsive review and never clicks send. It requires Playwright,
Chromium, explicit staging credentials, issued test statements and the migration.

## Controlled acceptance checklist

1. Apply only to separately approved isolated staging; assign both capabilities to
   a scoped tester and prepare valid issued monthly snapshots and statement email.
2. Prepare the flagship request. Check tenant/property selection, exact dates,
   recipient and each downloaded PDF. Test missing/ambiguous records and disabled email.
3. Change recipient/source after review; approval must fail. Test another company,
   revoked permission, private table access and simultaneous approval sessions.
4. Approve only to an authorised test mailbox. Compare exact PDFs with received
   attachments, provider acceptance ID and immutable audit. Never infer delivery.
5. Interrupt submission and simulate rejection/timeouts. Prove no automatic duplicate
   send; reconcile uncertainty with provider evidence before any further action.
6. Re-run existing maintenance WhatsApp and shared email worker regressions.

Locally tested implementation candidate; not staging- or production-certified.
Full flagship delivery confirmation and broad conversational orchestration remain
open. No other product milestone is included.
