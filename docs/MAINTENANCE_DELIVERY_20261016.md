# Maintenance execution and accounting checkpoint — 2026-10-16

Base: `59491f48b7f97daf6b105f08673d21e2cf42a5ef`.
Branch: `work/assetflow-execution-20261015`. Exact checkpoint commit is recorded in
the recovery archive manifest (avoids a self-referential commit hash).

## Existing architecture and defects

The previous checkpoint already prepared an issue-bound work order atomically.
Existing quotes, approval rules, suppliers, purchase orders, visits, expectations,
AP invoices, journals, bank allocations and timeline tables remain canonical.
Generic maintenance assignment/completion could previously bypass configured
approval and ignore failed writes. AP capture/posting could split a multi-line
invoice across non-atomic operations; supplier projection included non-control
lines, obscuring the payable. Repair completion was not a verified payment.

## Implementation

- Migration `20261016050000_govern_maintenance_lifecycle.sql`: versioned commands,
  exact-request recovery, configured gross approval limits and explicit capabilities,
  separation of duties, eligible supplier quotation, reviewed document hashes,
  authorized PO, acceptance evidence, visit scheduling/arrival, progress, completion,
  rejection/recovery and independent certification. Reads are entity scoped and
  direct mutations cannot replace the governed path. Legacy quotes without a work
  order remain readable only with the corresponding entity maintenance capability.
- Migration `20261016060000_maintenance_invoice_accounting.sql`: canonical AP
  capture, immutable document/allocation authority, independent approval, configured
  VAT, certified-cost ceiling, one balanced expense/capital/VAT/AP journal, atomic
  AP-only supplier ledger, open-period control, immutable invoice mutations, scoped
  reads and duplicate recovery. Shared journal posting owns supplier projection;
  no independent maintenance ledger exists.
- Migration `20261016070000_maintenance_payment_reconciliation.sql`: reuse bank
  allocations with a distinct supplier-invoice FK. Reconciliation requires a posted
  supplier payment, same entity/account and verified statement coverage, matching
  GL/subledger amounts and full bank allocation. Partial invoices remain open;
  overpayment fails. Audit failure rolls binding/paid amount back. Closure checks
  certified cost, invoices, GL/AP and verified payments again, atomically closing
  the expectation, PO and work order. It never sends a payment or treats an invoice
  as evidence of one.
- `work-order.service.ts`, maintenance engine and AP API/engine use these canonical
  commands. Maintenance workspace components expose quotations/transitions,
  evidence, multi-line invoice allocation, approval/posting, existing bank-payment
  review and reconciliation, retry feedback and explicit financial closure.
- The expanded mandate is preserved as AF-MAINT-001–016 in the same master
  register, with subrequirements and dependencies. Original 221 + 32 + 58 IDs are
  unchanged; their existence does not establish verification.

## Actual verification

`node --test tests/execution/*.test.mjs tests/maintenance/*.test.mjs`: **184 pass,
0 fail, 0 skipped**. Includes 28 maintenance tests. Actual TypeScript work-order
and AP application entrypoints call actual repository SQL through a test transport.
SQL uses selected real schema and migrations in PGlite with fixture auth/permissions;
financial posting privileges are exercised. No live Supabase claim.

`node --experimental-strip-types --test lib/financial/*.test.mts`: **10 pass**.
`npx tsc --noEmit`: **passed**. `git diff --check`: **passed**.
No `npm run build` was run.

Coverage includes configured VAT (12% fixture, deliberately not a hardcoded rate),
multi-line GL/AP balance, refundable-deposit/NO_VAT and commencement regression,
exact/changed duplicate submissions, foreign context/read denial, independent
approval/certification, explicit spend limits, stale competing commands, document
checksum changes, blocked CRUD, closed periods, missing GL evidence, partial and
excess payments, unverified/cross-entity statements and audit rollback/retry.
PGlite serializes its commands: competing-version tests are not a proof of real
multi-connection locking/deadlock behavior. Statement verification is an explicit
fixture boundary, not a real bank import/reconciliation certification.

## Open acceptance gates and known limitations

- Full deployed Supabase migration chain, actual JWT/RLS policies/roles, storage,
  multi-session races and provider delivery remain unexecuted. No staging URL or
  authorized credentials were provided to this runtime. New capabilities are not
  auto-granted: client role authority must be configured and tested before rollout.
- Browser/mobile/accessibility behavior is not verified. Playwright browser
  binaries are absent; the separate browser could not reach isolated localhost.
  Shared tokens and responsive layouts are implementation, not rendered evidence.
- Maintenance variation/reapproval, tenant-recoverable cost authority, insurance
  claims, general budget variance reporting, OCR-to-reviewed-AP handoff, zero-cost
  closure and payment reversal/reopening remain open. Over-authority costs and
  tenant-chargeable invoices fail closed. One invoice may have multiple allocations
  within this work order; allocating one invoice across work orders remains open.
- Generic non-maintenance AP capture/credit-note/posting paths still require a
  dedicated coherent hardening batch. This checkpoint does not certify all AP.
- Existing WhatsApp webhook lacks provider verification and uses phone-only tenant
  identity. It must not be enabled publicly. Multi-unit secure identity, inbox
  deduplication, governed routing, contractor sessions and media ingestion remain
  implementation work. The maintenance test's WhatsApp-origin issue is a fixture,
  not a verified provider journey.
- Existing `lib/inspections/engine.ts`/property inspection services require a
  canonical transactional completion/defect boundary (current completion ignores
  update failures). Templates, evidence/offline sync, take-on/back comparison,
  report sharing/signatures and deposit deductions are not certified.

Beta readiness: **not ready for an unsupervised pilot**. The governed staff
maintenance/accounting path has local evidence, but deployment, rendered UX and
channel/inspection acceptance gates remain open. Production readiness: **not
certified**. Confidence is high in the executed local assertions, limited for real
provider/deployed/multi-session behavior, and absent for unexecuted feature parity.

## Public RedRabbit comparison

Reviewed official public material on 2026-10-16:
https://weconnectu.co.za/redrabbit and publisher listing
https://apps.apple.com/za/app/redrabbit-by-weconnectu/id1636697466 .
These are vendor-described capabilities, not independent testing of RedRabbit.

| Capability | Public RedRabbit evidence | Actual AssetFlow evidence / gap |
|---|---|---|
| Templates and room/area checklists | Templates; app checklists and added areas | Existing checklist payloads; reusable hierarchical template/version lifecycle unverified |
| Incoming/outgoing | Reusable exit/entry checklists and photographs | Baseline comparison, responsibility/dispute and deduction workflow unverified |
| Photographic evidence | HD, multiple pictures, timestamped checklist images | Reviewed-document hashes in maintenance; native inspection media/upload integrity not verified |
| Offline mobile | Offline mode and live synchronization | Durable inspection drafts, conflicts and upload recovery not verified |
| Signatures | Participants sign in app | Lease signing exists; inspection acknowledgement/signature integration unverified |
| Interactive reports | Online inspection reports | Inspection PDF and authorized web report parity unverified |
| Inspection-generated maintenance | Tickets from findings | Existing inspection and work-order records; atomic defect lineage not verified |
| Contractor communication | Integrated communication and notifications | Staff-recorded contractor acceptance and progression; secure contractor channel remains open |
| Tracking and notifications | Task visibility and automated notifications | Versioned canonical lifecycle and audit locally tested; delivery/reminders not end-to-end verified |
| Differentiation targets | No unsupported absence claim | Native verified WhatsApp, explainable triage, commercial asset context and unified governed finance/deposits require demonstrated end-to-end evidence |

No parity or superiority claim is made from planned features.

## Recovery and publication

The v4 archive restored into a new clean checkout at exact 59491f4, with internal
SHA-256 checks passed. Its ZIP SHA-256 is
`25d29771a06094f204a92da447602c1122a45c287fd4a4b2b28f348f44be719b`.
The new archive includes all reachable history, full and incremental binary patches,
mailbox commits, changed-file inventories, test logs and clean clone/patch recovery
proof. Prior archives remain unchanged. GitHub HTTP 403 remains unresolved; no
successful push is claimed or retried. No production data/migrations or main merge.
