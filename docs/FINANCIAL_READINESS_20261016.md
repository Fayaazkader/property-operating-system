# Client-owned financial setup

Base: ae738aae07557bb29d8f4c530450bce083fc22b4.
Branch: work/assetflow-financial-readiness-20261016.

## Platform vs client

AssetFlow owns accounting/posting integrity, the permission catalogue, audit,
workflow state and isolation. Clients own their legal entities, assignments,
accounting structures, mappings, VAT treatment and commercial policies. Setup
accepts client-supplied records; it does not generate professional accounting or
tax decisions. No commercial-property chart is supplied in this milestone.
Test charts are synthetic fixtures only and are never deployed as client defaults.

## Changes

- Canonical initial provisioning remains atomic/retry-safe but no longer calls
  financial template cloning. It returns `configuration_required` with the client
  graph. Existing receipts retain their historical result; use readiness RPC for
  current state rather than interpreting a past receipt as posting permission.
- A scoped financial setup page supports reviewable JSON import into existing
  chart_of_accounts, accounting_config and tax_config; parentCode resolves inside
  the entity. Arrays: accounts, taxes, mappings. Required fields are documented in
  the UI. Existing differing values fail atomically rather than being overwritten.
  Replay the same import after reloading revision to recover a lost response.
- Explicit review records VAT registration, accounting method, currency and year
  start, with a full immutable audit snapshot in the existing financial timeline.
  Existing invoice payment terms, per-line VAT evidence, period opening/closing,
  posting templates and commercial policies remain separate canonical controls.
- Readiness gates new journal posting, billing approval and invoice issuance.
  Client structures can be incomplete; only configured operations become ready.
  Every relevant configuration mutation invalidates review. No legacy entity is
  silently grandfathered into ready state.
- New permission capability is assignable by clients, not granted automatically.
  Active client Super Users may configure entities within their assigned scope.
  Scoped users without that authority cannot import, approve or bypass via legacy
  direct configuration writes.

## Migration

`20261016160000_client_financial_readiness.sql` depends on the ae738aae schema,
including canonical client administration, permission-catalogue flags, onboarding
receipts and existing financial tables. Apply only after review and approval in
isolated staging. This batch does not deploy migrations or modify Production.

Review deployment impact: all entities need explicit financial review before new
posting. Preserve historical journals, ledgers, reconciliations and receipts.
No template entity seed is required for organisation creation. The historical
private template-bootstrap function remains available to its existing privileged
callers, but is not an automatic signup action or a public adoption workflow.

## Validation and limits

Targeted PGlite tests apply the new migration and actual canonical account
provisioning and journal/GL primitive over selected actual repository DDL, with
fixture auth and an explicit fixture permission table (not deployed JWT/RLS). They test empty-template
onboarding, receipt rollback, entity authority, client import, hierarchy cycles,
conflicts/replays, stale review, configuration invalidation, VAT/control-account
validation, billing/issuance guards, posting/GL consistency and audit-failure
rollback. The actual public journal command is tested with period checks, tenant
and supplier subledger projections, committed replay and invalidated readiness.
Direct GL inserts must match a posted canonical journal line and cannot duplicate
its projection. Posting-template and formula changes also invalidate review and
are included in the review snapshot. Queued provisioning tests share one embedded
session; they do not establish independent-session concurrency. Prior onboarding regression tests deliberately retain their historical
migration fixture; current empty-template behavior is verified in the new suite.

Run:

```sh
node --test tests/financial-readiness/*.test.mjs tests/onboarding/*.test.mjs tests/execution/*.test.mjs tests/maintenance/*.test.mjs tests/communications/*.test.mjs
node --experimental-strip-types --test lib/financial/*.test.mts
npx tsc --noEmit
git diff --check
```

Local results (2026-10-16): 235 regression tests passed, including 21 new
financial-readiness integration cases; 10 financial calculation tests passed;
`npx tsc --noEmit` and `git diff --check` passed. The migration executes in the
embedded PostgreSQL fixture; this is not a full Supabase migration deployment.
No PostgreSQL server/client or Docker is available for independent sessions.

Not demonstrated locally: deployed Supabase JWT/RLS/full migration chain,
independent PostgreSQL-session concurrency/deadlock recovery, real browser/mobile
interaction or complete staging lease/maintenance accounting lifecycle with the
new gate. Browser onboarding acceptance script now expects financial setup after
signup. The earlier environment lacks Chromium and Next dev startup reported
uv_interface_addresses error 1. No local production build was run.

Staging acceptance:
1. Create a new organisation with empty global financial templates. Verify one
   client/admin/entity/membership/receipt and zero automatically cloned accounts.
2. Select the correct entity; import an independently reviewed client chart,
   mappings and tax codes. Verify conflicts and foreign accounts are rejected.
3. Confirm policies as an authorised client administrator; verify other entity
   users and ordinary scoped members cannot configure or approve them.
4. Attempt posting before review, after review and after changing configuration.
   Verify independent-session concurrent import/review/posting serializes or
   safely aborts; retry cannot leave partial journals, GL or subledger entries.
5. Run canonical lease invoice, maintenance AP and bank/payment reconciliation
   with explicit periods, mappings and client policies; verify existing authority,
   VAT evidence, balance and closed-period tests still hold.
6. Review saved snapshot/audit and responsive, keyboard-accessible setup UI.

Implemented and locally tested; not staging- or production-certified. No whole-app
UX, tenant WhatsApp expansion or other workstream is part of this milestone.
