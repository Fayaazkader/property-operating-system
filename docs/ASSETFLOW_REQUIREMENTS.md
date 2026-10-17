# AssetFlow Master Requirement Register

Canonical tracking register. Updated 2026-10-15. No item is complete merely because
code exists. Original numbered IDs are preserved verbatim; new requirements use
`AF-ADD-*`; unnumbered source follow-ups use `AF-SOURCE-*`.

Source: **To do.docx**, 2026-09-30, Library identity
`libfile_7f7bba85f6a481919819846fc3311aa2`, read in full (16 pages).
The extracted source (trailing whitespace normalized) is archived in `docs/requirements/source-20260930.md`.
Historical source checkmarks and descriptions are not current verification.
The 221-item source has been recovered and imported, **not fully reconciled**.
FLO's original intended definition is not established by this source or the
repository search; do not invent a meaning or implement a guessed product.

Allowed status: Verified complete; Implemented but defective; Partially implemented;
Missing; Conflicting or duplicated; Not yet verified.

Evidence `E1`: system map checkpoint **2026-10-15 governed field signing batch**,
new migrations 20261015190000/20261015200000/20261015210000, canonical services in
`lib/execution/server`, and `tests/execution/field-manifest-database.test.mjs`.
Tests use embedded PostgreSQL, actual selected repository schema/migrations and
canonical TypeScript services, fixture permission/auth functions, and in-memory
storage transport. They are neither deployed Supabase nor full-application E2E.

Evidence `E5`: system map **explicit commercial tax authority and lease-specific
tenant policy** checkpoint; migrations 20261016030000/20261016040000,
canonical opportunity create/update/submission and generation/activation tests.
Explicit parking and fee VAT, snapshot/template continuity, no tenant merging,
inactive-context rejection and fail-closed legacy intake. Local tests only;
controlled import, actual browser and deployed integration remain open.

Evidence `E4`: system map **canonical maintenance preparation** checkpoint;
20261016020000, tests/maintenance/work-order-integration.test.mjs and the real
PrepareWorkOrderAction component. Nine local integration tests; no provider or
rendered browser certification.

Evidence `E3`: system map **commencement invoice and shared financial posting**
checkpoint; migrations 20261016000000/20261016010000; actual billing/posting/tenant
report service integration in tests/execution/field-manifest-database.test.mjs.
This proves local commencement posting, not production or recurring invoicing.

Evidence `E2`: `docs/ASSETFLOW_DELIVERY_BASELINE.md`, activation migrations
20261015220000/20261015230000 and execution activation/commencement tests.
Local activation and approval are tested; invoice/ledger, deposit receipt, real
providers, rendered UI, deployed RLS and full E2E remain open. The baseline also
indexes all application domains without treating discovery as verification.

Unreviewed originals default to Not yet verified, never Missing. Their dependency
and remaining-work entries deliberately require canonical discovery before code
changes. No requirement below has been explicitly deferred or waived.

## Original 221 items

| Original ID | Domain | Original requirement | Source label | Status | Evidence / remaining work and dependencies |
| --- | --- | --- | --- | --- | --- |
| 1 | Cash Book | Actions column alignment still broken | Today | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 2 | Cash Book | Manual allocate page review as workspace | Today | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 3 | Cash Book | Bank charges/interest auto-capture from statements | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 4 | Cash Book | Receipts vs Payments consistency on manual allocate page | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 5 | Accounts Payable | Invoice detail — click → full detail view with lines | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 6 | Accounts Payable | Supplier detail page — full ledger, accounts, stats, timeline | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 7 | Accounts Payable | Credit Notes — issue from invoice detail, multi-select | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 8 | Accounts Payable | Capture modal — supplier account dropdown visible | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 9 | Accounts Payable | Recurring Expense matching engine | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 10 | Accounts Payable | Bulk invoice capture — drag 50 PDFs, OCR, draft queue | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 11 | Accounts Payable | Document viewer — side-by-side PDF + captured data | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 12 | Accounts Payable | Intelligent coding — learn from past invoices per supplier | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 13 | Accounts Payable | Supplier timeline — full event history | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 14 | Accounts Payable | Supplier Score — invoices, outstanding, credits, avg days | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 15 | Accounts Payable | AP Intelligence — duplicates, VAT warnings, missing property | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 16 | Accounts Payable | Supplier Statement Reconciliation — import + compare | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 17 | Accounts Payable | Credit management — available, reserved, applied, refunded | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 18 | Accounts Payable | Payment Allocation Workspace — daily AP workspace | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 19 | Accounts Payable | Supplier invoice capture via WhatsApp (photo→OCR→draft) | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 20 | Accounts Payable | OCR scan supplier invoices reads and captures | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 21 | Accounts Payable | Supplier insurance tracking | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 22 | Financial Workspace | Global search across GL, journals, tenants, suppliers | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 23 | Financial Workspace | Trial Balance row click → journal drawer with trace | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 24 | Financial Workspace | Income Statement hierarchy | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 25 | Financial Workspace | Balance Sheet exact difference when unbalanced | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 26 | Financial Workspace | Export on ALL reports | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 27 | Financial Workspace | Cash Flow — proper indirect method | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 28 | Financial Workspace | VAT — generate return, download PDF | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 29 | Financial Workspace | Budget — variance %, sortable | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 30 | Financial Workspace | Financial Health Indicator | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 31 | Financial Workspace | Audit Ribbon | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 32 | Financial Workspace | Journal Drawer tabs — Lines, Posting, Trace, Why | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 33 | Financial Workspace | Drill-down from any number to source | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 34 | Revenue Operations | Billing Preview — click tenant → full invoice modal | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 35 | Revenue Operations | Credit Note UI — issue from invoice | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 36 | Revenue Operations | Regeneration flow — regenerate with reason | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 37 | Revenue Operations | Billing Run integration with Period Governance | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 38 | Revenue Operations | PDF export of invoices/statements | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 39 | Revenue Operations | Email/WhatsApp send from preview actions | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 40 | Revenue Operations | Tenant branding on documents | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 41 | Revenue Operations | Statement regeneration with toggles | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 42 | Revenue Operations | Late Interest engine — auto-calculate | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 43 | Revenue Operations | Letter of Demand engine | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 44 | Revenue Operations | Billing Intelligence — suggestions | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 45 | Revenue Operations | Pre-Billing Verification | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 46 | Revenue Operations | Recovery Analysis — utilities, rates, operating costs | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 47 | Revenue Operations | 6-Stage Lease Pipeline | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 48 | Revenue Operations | Automatic lease renewal system | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 49 | Revenue Operations | Flags for expiries | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 50 | Revenue Operations | Full automatic leasing and renewal pipelines | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 51 | Revenue Operations | In-app payment / payment links on invoices | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 52 | Revenue Operations | Insurance claims tracker | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 53 | Revenue Operations | Utility tracking, under recovery analysis | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 54 | Period Governance | Revenue owns billing transitions (event-driven) | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 55 | Period Governance | Workflow phase contract enforced | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 56 | Period Governance | End-to-end workflow testing | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 57 | Tenant Management | Notes on tenancy — visible on age analysis | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 58 | Tenant Management | Age analysis with tenant notes | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 59 | Tenant Management | Billing review per tenant | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 60 | Tenant Management | Tenant detail — Invoices tab | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 61 | Tenant Management | Tenant detail — Statements tab | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 62 | Tenant Management | Tenant detail — full ledger view | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 63 | Tenant Management | Deposit management UI — register, interest, apply, refund | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 64 | Tenant Management | Tenant deposits ledger | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 65 | Tenant Management | Deposit suspense account | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 66 | Tenant Management | FICA verification for tenants | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 67 | WhatsApp & Conversation | WhatsApp sandbox setup | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 68 | WhatsApp & Conversation | Tenant invoices via WhatsApp | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 69 | WhatsApp & Conversation | Tenant statements via WhatsApp | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 70 | WhatsApp & Conversation | WhatsApp messaging allowance tracking | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 71 | WhatsApp & Conversation | Two-way WhatsApp threads in Tenant Workspace | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 72 | WhatsApp & Conversation | WhatsApp as Professional Colleague (never AI/bot) | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 73 | WhatsApp & Conversation | Natural Language Intents | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 74 | WhatsApp & Conversation | Conversation Memory across context | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 75 | WhatsApp & Conversation | Escalation to specific Roles | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 76 | WhatsApp & Conversation | Never "Connect to Human" — always escalate to role | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 77 | WhatsApp & Conversation | Conversation Standards — professional, natural | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 78 | WhatsApp & Conversation | No AI Mention — never says "As an AI..." | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 79 | WhatsApp & Conversation | WhatsApp Tiers — PM, Executive, Maintenance, Finance | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 80 | WhatsApp & Conversation | Bulk WhatsApp campaigns | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 81 | WhatsApp & Conversation | Conversation Analytics — top questions, patterns | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 82 | WhatsApp & Conversation | WhatsApp Maintenance tier — job lists, completion photos | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 83 | WhatsApp & Conversation | WhatsApp Finance tier — unallocated, exceptions | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 84 | WhatsApp & Conversation | WhatsApp Executive tier — Portfolio Pulse | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 85 | Settings & Admin | Platform settings accessible | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 86 | Settings & Admin | User access control per module | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 87 | Settings & Admin | Role-based access (RBAC) | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 88 | Settings & Admin | Entity configuration (logo, branding, VAT, banking) | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 89 | Settings & Admin | Statement/invoice configuration UI | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 90 | Settings & Admin | Feature flags UI | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 91 | Settings & Admin | RBAC Roles: admin, entity_admin, property_manager, finance, tenant | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 92 | Settings & Admin | RLS on every table | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 93 | Settings & Admin | Entity Isolation — auth_entities() | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 94 | Settings & Admin | Approval Matrices — configurable thresholds | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 95 | Reports | Rent Roll | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 96 | Reports | Occupancy Report | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 97 | Reports | Arrears Report | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 98 | Reports | Aged Debtors | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 99 | Reports | Aged Creditors | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 100 | Reports | Tenant Statements (bulk) | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 101 | Reports | Supplier Statements (bulk) | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 102 | Reports | Lease Expiry Schedule | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 103 | Reports | Vacancy Report | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 104 | Reports | NOI Report | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 105 | Reports | Recovery Analysis | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 106 | Reports | Budget vs Actual | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 107 | Reports | Executive Pack | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 108 | Reports | Export all (PDF, Excel, CSV) | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 109 | Reports | Drill-down from any number to source | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 110 | Reports | WALE Reporting | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 111 | Reports | Tenant Concentration | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 112 | Reports | Scheduled reports — auto-delivery | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 113 | Document Engine | PDF generation (actual PDFs) | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 114 | Document Engine | Email delivery of documents | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 115 | Document Engine | WhatsApp delivery of documents | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 116 | Document Engine | Document versioning with history | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 117 | Document Engine | Document storage in registry | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 118 | Document Engine | Every document exportable | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 119 | Document Engine | Immutable Documents after execution | New | Partially implemented | E1 — Committed artifact immutability, private read-back and signed hash checked locally; deployed storage policy and supersession verification pending. |
| 120 | Document Engine | OCR scan leases reads and captures | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 121 | Document Engine | AI Extraction — OCR, PDF parsing, field extraction | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 122 | Document Engine | Document Classification — auto-classify incoming | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 123 | Security & Compliance | MFA — multi-factor authentication | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 124 | Security & Compliance | All security super tight | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 125 | Security & Compliance | Audit Trail — every mutation logged | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 126 | Security & Compliance | Trust Accounting — client money management | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 127 | Security & Compliance | Managing Agent Accounting | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 128 | Security & Compliance | Compliance Reporting — regulatory | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 129 | Security & Compliance | Backup & DR — disaster recovery | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 130 | Security & Compliance | Rate Limiting — API protection | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 131 | Execution Engine | Native Digital Signature (not DocuSign) | New | Partially implemented | E1 — Canonical native signing extended through final PDF/certificate/private retrieval; full approval-to-billing E2E pending. |
| 132 | Execution Engine | Signature Methods — Type, Draw, Upload | New | Partially implemented | E1 — Typed public signature and separate initials integrated; drawn/uploaded public capture still requires completion. |
| 133 | Execution Engine | Execution Lifecycle — Draft→Review→Sent→Signed | New | Partially implemented | E1 — Readiness, sequential signatures and completion locally integrated; upstream/downstream and real invitation/OTP delivery pending. |
| 134 | Execution Engine | Participants with signing order | New | Partially implemented | E1 — Two nominated signatories and sequential gate locally tested; configurable witnesses and broader participant policies pending. |
| 135 | Execution Engine | Execution Locks — terms freeze during execution | New | Partially implemented | E1 — Frozen field manifest, source and completion integrity gates locally tested; established-environment regression pending. |
| 136 | Execution Engine | Immutable Snapshots at send time | New | Partially implemented | E1 — Document-bound placement freeze tested; complete commercial/template/send snapshot chain requires E2E proof. |
| 137 | Execution Engine | Execution Certificate — auto-generated | New | Partially implemented | E1 — Detached PDF certificate auto-generated by finalisation with exact executed PDF hash; deployed review pending. |
| 138 | Execution Engine | Drawing allowed but embedded for safety (OCR-proof) | New | Partially implemented | E1 — Original-page embedding and evidence checksum tests pass; drawn capture UI and full security review pending. |
| 139 | Execution Engine | Digital signatures for leasing AND suppliers/contracts | New | Partially implemented | E1 — Lease-only extension; preserve non-lease canonical signature defaults. Supplier/contracts E2E not verified. |
| 140 | Property Operations | Asset Register — lift, generator, HVAC per property | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 141 | Property Operations | Service Contracts — recurring, auto-generate work orders | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 142 | Property Operations | Inspections — checklist, defects, photos, severity | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 143 | Property Operations | Work Orders full lifecycle | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 144 | Property Operations | Supplier Scorecard per property | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 145 | Property Operations | Asset Health Score | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 146 | Property Operations | CAPEX vs OPEX classification | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 147 | Property Operations | Property Timeline — every event | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 148 | Property Operations | Maintenance engine | New | Conflicting or duplicated | lib/maintenance/engine.ts and lib/property-operations/services/work-order.service.ts share work_orders but have different mutation paths/status contracts. E4 consolidates preparation with real issue workspace action and local integration proof. Other transition/assignment commands still conflict and need governed integration. |
| 149 | Property Operations | Compliance — certificates, insurance, licenses, expiry | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 150 | Brokerage Operations | Broker Companies management | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 151 | Brokerage Operations | Broker Profiles | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 152 | Brokerage Operations | Broker Mandates | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 153 | Brokerage Operations | Enquiries — lead tracking | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 154 | Brokerage Operations | Viewings — scheduling, tracking | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 155 | Brokerage Operations | Offers — commercial proposal management | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 156 | Brokerage Operations | Negotiation — full history with counter-offers | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 157 | Disbursement Operations | Supplier Payments — creation and tracking | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 158 | Disbursement Operations | Payment Approval workflows | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 159 | Disbursement Operations | Payment Batches — batch processing | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 160 | Disbursement Operations | Bank Integration — payment file generation | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 161 | Disbursement Operations | Payment Reconciliation — match to invoices | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 162 | Disbursement Operations | Cash Book Integration — auto-reconciliation | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 163 | Disbursement Operations | Disbursement Dashboard | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 164 | Morning Brief & Search | Universal Search — federated across all domains | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 165 | Morning Brief & Search | Natural Language Search | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 166 | Morning Brief & Search | Command Palette ⌘K global | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 167 | Morning Brief & Search | Search Federation — Revenue, Property, Brokerage, Docs | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 168 | Morning Brief & Search | Search bar assists with app navigation | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 169 | Morning Brief & Search | Morning Brief — daily operational summary | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 170 | Morning Brief & Search | Portfolio Pulse — real-time health | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 171 | Morning Brief & Search | Decision Feed — every important business event | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 172 | Portfolio & Executive Intelligence | Revenue Leakage Detection | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 173 | Portfolio & Executive Intelligence | Ghost Tenant Detection | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 174 | Portfolio & Executive Intelligence | Occupancy Forecasting | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 175 | Portfolio & Executive Intelligence | Renewal Risk Scoring | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 176 | Portfolio & Executive Intelligence | Executive Dashboards | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 177 | Portfolio & Executive Intelligence | Operational Timeline — every object | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 178 | Portfolio & Executive Intelligence | Deal Pipeline — acquisition and disposals | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 179 | Portfolio & Executive Intelligence | AI Recommendations — intelligent suggestions | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 180 | Platform Maturity | Performance optimization | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 181 | Platform Maturity | Error handling standardization | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 182 | Platform Maturity | Loading skeletons all pages | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 183 | Platform Maturity | Mobile responsiveness | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 184 | Platform Maturity | Data migration tools (MDA, MRI presets) | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 185 | Platform Maturity | Favicon/OG image | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 186 | Platform Maturity | Remove hardcoded test data | Earlier | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 187 | Platform Maturity | Confirm theme — universal fonts, colors | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 188 | Platform Maturity | Confirm if web-based or launcher app | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 189 | Platform Maturity | Finish website/landing page | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 190 | Platform Maturity | Public Roadmap — Under Review→Planned→Building→Released | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 191 | Platform Maturity | Feature Voting | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 192 | Platform Maturity | Multi-Currency support | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 193 | Testing & Validation | End-to-End Workflow Testing | New | Partially implemented | E1/E2 — Local signing-to-private-artifact, activation and commencement charges tested; E3 adds issued commencement invoices, GL and tenant ledger; real providers/RLS, recurring billing and full established-environment E2E pending. |
| 194 | Testing & Validation | Happy Path Testing | New | Partially implemented | E1 — Local execution happy paths exercised; application-wide happy paths unverified. |
| 195 | Testing & Validation | Missing Document Path | New | Partially implemented | E1 — Local missing manifest/evidence/artifact cases tested; application-wide coverage unverified. |
| 196 | Testing & Validation | Permission Failures | New | Partially implemented | E1 — Manifest actor/entity and RPC privileges tested on fixture permissions; production JWT/RLS and application-wide permission failures pending. |
| 197 | Testing & Validation | Validation Failures | New | Partially implemented | E1 — Field geometry/completion/hash/body validation tested; application-wide validation inventory pending. |
| 198 | Testing & Validation | Approval Flow tests | New | Partially implemented | E1 — Readiness guard tested; commercial/financial approval flows not reverified in this batch. |
| 199 | Testing & Validation | Notifications tests | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 200 | Testing & Validation | Audit Entries tests | New | Partially implemented | E1 — Manifest save/freeze, signature and single executed audit event verified locally; global mutation coverage pending. |
| 201 | Testing & Validation | Timeline tests | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 202 | Testing & Validation | Morning Brief tests | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 203 | Testing & Validation | Conversation Response tests | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 204 | Testing & Validation | Regression Testing | New | Partially implemented | E1 — Existing converter/invitation/PDF regressions pass; whole-app regressions pending. |
| 205 | Ecosystem & Integrations | Bank Integration — direct feeds | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 206 | Ecosystem & Integrations | Accounting Integration — Xero, Sage, QuickBooks | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 207 | Ecosystem & Integrations | Utilities Integration — municipal feeds | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 208 | Ecosystem & Integrations | CRM Integration — Salesforce, HubSpot | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 209 | Ecosystem & Integrations | IoT Integration — smart meters, building access | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 210 | Ecosystem & Integrations | Public API — REST, webhooks | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 211 | Ecosystem & Integrations | Developer Experience — SDK, OAuth, API Keys | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 212 | Ecosystem & Integrations | Bank imports from other systems | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 213 | Ecosystem & Integrations | Migration from other systems | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 214 | Mobile & Future | Tenant Mobile App | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 215 | Mobile & Future | Property Manager App | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 216 | Mobile & Future | Mobile Notifications — push | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 217 | Mobile & Future | Mobile Offline Support | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 218 | Mobile & Future | Digital Twins — IoT, Smart Buildings | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 219 | Mobile & Future | ESG Reporting | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 220 | Mobile & Future | White-labeling | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |
| 221 | Mobile & Future | In-App Payments — zero misallocation | New | Not yet verified | Reconcile actual canonical implementation, migrations and tests; identify domain dependencies before changes. |

## Additional product and architecture requirements

| New ID | Requirement | Original overlap | Status | Dependencies / next verification |
| --- | --- | --- | --- | --- |
| AF-ADD-001 | Single canonical system across web, WhatsApp, future email/mobile/portals/AI; shared identity, entity/RBAC, records, workflows, audit, events, adapters and governed AI. | 73, 87, 92, 93, 125, 167, 210 | Not yet verified | Cross-cutting architecture; inspect existing adapters/services before extension. |
| AF-ADD-002 | Smart leases and client-specific templates. | 47, 113, 120, 121 | Not yet verified | Preserve template governance; complete approved-template-to-executed-agreement E2E. |
| AF-ADD-003 | Complete lease execution, precise placement, configurable witnesses, signing, activation and initial billing. | 131–139 | Partially implemented | E1/E2/E5; explicit commercial parking price/VAT through snapshot and template; placement, final artifacts, activation and atomic commencement charge approval locally integrated; E3 adds locally tested commencement invoice/GL/tenant-ledger integration. Recurring issuance, deposit receipt, witnesses, real providers/RLS and rendered UI remain open. |
| AF-ADD-004 | Tenant deposit engine. | 63–65 | Implemented but defective | E2 — lib/financial/deposit-engine.ts onObligationCreated sets held balance without receipt. New activation avoids this path; canonical obligation/receipt/allocation, interest and refunds need correction and verification. |
| AF-ADD-005 | Dedicated tenant ledgers and manual allocations. | 2, 4, 62, 64 | Partially implemented | E3 — Actual PostingEngine and invoice RPC integrate AR-only tenant ledger atomically with exact replay and configured VAT. Historical projections, receipts, allocations/reconciliation remain open. |
| AF-ADD-006 | Bank import completeness verification. | 3, 162, 212 | Not yet verified | Statement source completeness, duplicates, totals and posting proof. |
| AF-ADD-007 | Payment gateway and settlement reconciliation; receipts never imply verified bank payment. | 51, 161, 221 | Not yet verified | Provider adapters, fees/settlements, tenant allocation and bank reconciliation. |
| AF-ADD-008 | Recurring supplier invoices and missing-invoice alerts. | 9, 141 | Not yet verified | Supplier automation, expectations, OCR/matching, notifications and period controls. |
| AF-ADD-009 | Side-by-side OCR invoice capture. | 10, 11, 19, 20 | Not yet verified | Shared document intelligence and supplier/accounting draft approval. |
| AF-ADD-010 | VAT, tax, trial balances, rent rolls and entity reporting. | 23–28, 95–112, 128 | Partially implemented | E3/E5: configured commencement VAT, inclusive/exclusive/no-VAT classification and frozen approved tax tested locally. Returns, credits, broader ledger reports, source trace and deployed verification remain open. |
| AF-ADD-011 | Rates and taxes escalation engine. | 46, 53, 207 | Not yet verified | Governed tariffs, effective dates, budgets and tenant recovery rules. |
| AF-ADD-012 | Acquisitions, disposals and financial adjustments. | 178 | Not yet verified | Deal governance, asset/ledger postings and approvals. |
| AF-ADD-013 | Flagship maintenance and contractor lifecycle: requests, urgency, SLAs, emergencies, planned work, statutory inspections, contractor records, quotations, approval authority, work orders, communications, photos/documents, budgets, invoices, cost allocation, closure, reporting/intelligence. | 82, 140–149 | Partially implemented | E4 — Canonical issue-to-reported-order preparation, scoped context, configured SLA, audit and real UI command implemented/tested locally. Approval/quotations, contractor, completion and supplier finance remain open. |
| AF-ADD-014 | Preventative and compliance maintenance. | 140–142, 149 | Not yet verified | Asset schedules, statutory obligations, inspections, work orders and escalation. |
| AF-ADD-015 | Insurance and investor portals. | 21, 52, 149, 176 | Not yet verified | Entity-scoped access, claims/compliance and canonical reporting. |
| AF-ADD-016 | WhatsApp tenant, staff and support experiences as direct operational entry points. | 67–84 | Not yet verified | Shared identity/authorization, durable ingestion, idempotency, canonical commands, role escalation and delivery. |
| AF-ADD-017 | Future email workflow integration through the same canonical services. | 114, 210 | Not yet verified | Provider adapter and communications orchestration; no separate business logic. |
| AF-ADD-018 | Intelligent search, presets and historical context. | 22, 74, 164–171 | Not yet verified | Permission-filtered canonical search, context and source links. |
| AF-ADD-019 | Financial anomaly detection and tariff intelligence. | 15, 44, 46, 172–179 | Not yet verified | Explainable findings from verified records with human-controlled consequential actions. |
| AF-ADD-020 | Operational notifications and activity history. | 112, 125, 147, 171, 177, 199–201 | Not yet verified | Canonical events, role routing, notification delivery and durable audit. |
| AF-ADD-021 | Theme customization, soft colors and enterprise UX. | 182, 183, 187, 220 | Not yet verified | Preserve established UX and tokens; verify accessibility and responsive behavior. |
| AF-ADD-022 | Global Add New actions. | 166, 168 | Not yet verified | Permission-scoped actions dispatch canonical domain workflows. |
| AF-ADD-023 | Financial and investment calculators. | 29, 30, 178 | Not yet verified | Deterministic assumptions, precision, traceable inputs and entity context. |
| AF-ADD-024 | Widgets and executive intelligence. | 169, 170, 172–179 | Not yet verified | Reuse existing widget/query authorities; verify real-data accuracy. |
| AF-ADD-025 | Secure authentication, rate limiting, RLS and POPIA controls. | 86, 87, 91–94, 123–130 | Not yet verified | Tenancy isolation, minimal disclosure, retention, audit and recovery. Legal review is separate from code verification. |
| AF-ADD-026 | AssetFlow marketing website and waitlist. | 185, 189 | Not yet verified | Commercial content, consent, onboarding and canonical lead capture. |
| AF-ADD-027 | FLO — locate and verify original intended definition before implementation. | Unresolved | Not yet verified | Definition not found in current source; retain blocker without guessing. |
| AF-ADD-028 | WhatsApp offer-to-approved-lease-to-signing-to-activation-to-deposit/invoices canonical journey. | 19, 47, 50, 63–84, 131–139 | Not yet verified | Depends on complete Phase 1 then channel identity/intents/governance and financial integration. |
| AF-ADD-029 | WhatsApp burst-pipe-to-maintenance-to-contractor/invoice/cost-allocation journey. | 19, 82, 140–149 | Not yet verified | Depends on flagship maintenance, communications, supplier finance and approvals. |
| AF-ADD-030 | Authorized WhatsApp balance, statement and receipt operations, preserving payment verification/reconciliation. | 62, 68, 69, 79, 83, 161, 162 | Not yet verified | Depends on canonical financial query/posting services and explicit consequential-action confirmations. |
| AF-ADD-031 | Durable processing, retries, idempotency, recovery and observability across interfaces. | 125, 129, 130, 180, 181, 193–204 | Not yet verified | Signing E1, atomic finance E3 and preparation E4 local proof; app-wide dispatch, provider, independent-session and recovery guarantees require domain verification. |
| AF-ADD-032 | No production mutations/migration deployment/main merge/public signing enablement without approval; no npm build; commit/export isolated checkpoints. | Delivery control | Not yet verified | Operational rule, continuously enforced; publishing remains blocked by GitHub 403. |

## Unnumbered follow-ups in the recovered source

These are preserved as historical source requirements; overlap with numbered items
is intentionally explicit rather than silently dropping them. Historical checked
items remain Not yet verified. Deployment, credentials, deletion and production
cleanup entries do not override approval controls.

| New source ID | Section | Original wording | Historical checked | Current status / remaining work |
| --- | --- | --- | --- | --- |
| AF-SOURCE-001 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Backend code complete | yes | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-002 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | API routes built | yes | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-003 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Webhook handler built | yes | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-004 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Communication service built | yes | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-005 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Twilio account upgrade (in progress) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-006 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Meta business verification (in progress) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-007 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Register WhatsApp sender with your SIM number | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-008 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Submit message templates for approval | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-009 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Update `TWILIO_WHATSAPP_FROM` in `.env.local` | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-010 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Configure webhook URL in Twilio | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-011 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Test send to Acme Corp | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-012 | WhatsApp (Blocked — waiting 48hrs for Twilio approval) | Test two-way messaging (tenant replies) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-013 | DocuSign | Provider code complete (JWT, envelope, signing URL, certificate) | yes | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-014 | DocuSign | Sandbox test with real DocuSign credentials | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-015 | DocuSign | Verify JWT authentication works | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-016 | DocuSign | Create envelope successfully | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-017 | DocuSign | Generate recipient signing URL | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-018 | DocuSign | Confirm webhook callbacks | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-019 | DocuSign | Retrieve completion certificate | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-020 | DocuSign | Test with lease execution flow | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-021 | DocuSign | Test with AssetFlow Signature (paid feature) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-022 | End-to-End Testing | Full workflow: Tenant created → Lease activated → Invoice generated → Tenant pays → Bank  | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-023 | End-to-End Testing | Supplier invoice → Payment → Reconciliation | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-024 | End-to-End Testing | Credit note issued → Statement updated | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-025 | End-to-End Testing | Period close → Financial statements generated | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-026 | End-to-End Testing | Morning Brief reflects real data | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-027 | End-to-End Testing | Multi-entity isolation test | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-028 | End-to-End Testing | RBAC permission test | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-029 | End-to-End Testing | Performance test with 1000+ leases | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-030 | Settings (Minor Placeholders) | Communications: Email Templates, WhatsApp Templates (UI forms) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-031 | Settings (Minor Placeholders) | Security: MFA setup, API Keys page, Audit Log viewer | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-032 | Settings (Minor Placeholders) | Integrations: Bank Feeds config, Data Imports, Webhooks | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-033 | Settings (Minor Placeholders) | AI: Morning Brief config, AI Features toggle, Scheduled Jobs | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-034 | Financial Reports (UI Polish) | Balance Sheet — proper A4 export formatting | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-035 | Financial Reports (UI Polish) | Cash Flow — proper A4 export formatting | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-036 | Financial Reports (UI Polish) | Tenant Statement — PDF export with branding | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-037 | Financial Reports (UI Polish) | Supplier Statement — PDF export | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-038 | Revenue Operations | Import Utilities modal (CSV upload + preview + post) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-039 | Revenue Operations | Bulk statement send with progress tracking | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-040 | Revenue Operations | Letter of Demand engine + templates | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-041 | Tenant Management | Tenant notes appear on age analysis | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-042 | Tenant Management | Billing review from tenant page | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-043 | Tenant Management | Tenant document inheritance (property docs visible on tenant) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-044 | Payment Processing | Debit order integration | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-045 | Payment Processing | Payment gateway (PayFast/Ozow) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-046 | Security & Hardening | Remove all permissive RLS policies (`USING (true)`) | no | Partially implemented — E3 revokes browser journal/GL writes and restricts tenant ledger mutations; full RLS catalogue and deployed tests pending. |
| AF-SOURCE-047 | Security & Hardening | Standardize error handling across all API routes | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-048 | Security & Hardening | Add loading skeletons to all pages | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-049 | Security & Hardening | Rate limiting on public endpoints | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-050 | Security & Hardening | Input validation on all forms | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-051 | Launch Preparation | Remove old landing page at `/landing` | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-052 | Launch Preparation | Remove old public pages (`/about`, `/security`, etc. — now in marketing) | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-053 | Launch Preparation | Remove all hardcoded test data | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-054 | Launch Preparation | Production database cleanup | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-055 | Launch Preparation | SSL/domain verification | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-056 | Launch Preparation | Backup strategy documented | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-057 | Launch Preparation | Privacy policy and terms of service final | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |
| AF-SOURCE-058 | Launch Preparation | Beta customer onboarding guide | no | Not yet verified — reconcile with numbered register and actual canonical evidence. |

## Execution dependency order and closure gate

1. Governed approval/preparation and private PDF provenance (preserve prior evidence).
2. Field manifest/editor, freeze/readiness and mandatory signature/initial evidence (E1).
3. Original-page final PDF, detached certificate, verified private storage, atomic completion and scoped retrieval (E1).
4. Browser/JWT/Supabase/storage-policy/provider verification; real multi-session PostgreSQL locking; controlled witness and signature-method completion.
5. Executed agreement -> canonical activation -> tenant/unit -> deposit and initial rental billing -> invoices/balances, with rollback/idempotency proofs.
6. Only after Phase 1 closure, reconcile all original items against implementation evidence and select coherent financial/maintenance/communications batches.

Rows alone never prove implementation. E3/E4/E5 identify the tested scope of the
new financial, maintenance and commercial changes. WhatsApp provider integration
and full reconciliation remain explicit outstanding tasks.

## Open defect evidence tied to existing requirements

These are newly evidenced defects/dependencies, not invented original audit items.
They remain open; code presence is not completion.

| Defect | Related requirements | Evidence | Remaining work |
| --- | --- | --- | --- |
| AF-DEF-001 | AF-ADD-004; original 63–65 | lib/financial/deposit-engine.ts onObligationCreated records held funds before a verified receipt; new commencement path never invokes it or creates deposit_register funds. | Reconcile legacy records and integrate verified receipt/allocation, interest, application and refund authority atomically. |
| AF-DEF-002 | AF-ADD-008/010; supplier ledger dependencies | lib/accounts-payable/engine.ts postInvoice uses the same invoice source ID for every line; the new shared replay guard rejects differing lines rather than silently omitting them. Source inspection, not a certified supplier E2E. | Replace partial client orchestration with complete canonical atomic supplier posting and verify legacy partial/source records before rollout. |
| AF-DEF-003 | AF-ADD-012; financial adjustments | lib/financial/reversal-engine.ts sends amount 0 to PostingEngine, whose governance rejects nonpositive amounts. | Govern reversal of exact persisted lines/dimensions/VAT into an open period with source uniqueness and downstream ledger proof; no historical rewrites. |
| AF-DEF-004 | AF-ADD-013/029; original 148 | Competing work-order status/assignment mutations remain outside the E4 preparation boundary; approval/quote buttons had no integration. | Integrate quotations/approval authority, contractor acceptance, visits/completion, budgets and supplier invoices; validate channel identity and delivery. |

## Maintenance, WhatsApp and inspections mandate — 2026-10-16

AF-MAINT IDs extend the same master register; all prior IDs remain unchanged.
These rows retain the revised mandate acceptance criteria, not completion claims.
Evidence E6: `docs/MAINTENANCE_DELIVERY_20261016.md`, migrations 20261016050000–070000,
`tests/maintenance/work-order-integration.test.mjs`, canonical work-order/AP services.

| ID | Requirement | Status | Evidence, acceptance criteria and remaining dependencies |
|---|---|---|---|
| AF-MAINT-001 | Governed maintenance execution and accounting | Partially implemented | Quotation, explicit authority, authorization, acceptance evidence, scheduling, progress, independent certification, documented AP capture, configured VAT, atomic GL/AP posting, verified bank allocation and closure have local integration coverage. Remaining: variations, broader contractor contracts, tenant recovery, insurance, OCR review handoff and deployed gates. |
| AF-MAINT-002 | Verified WhatsApp tenant intake | Implemented but defective | Existing webhook and adapters resolve a phone number without secure tenant proof. Require provider verification, verified contact and active lease context, multi-unit disambiguation, secure challenge, original message/media timestamps, targeted follow-ups, canonical correlation, retry deduplication, stakeholder updates and complete conversation history. |
| AF-MAINT-003 | Explainable media-assisted triage | Not yet verified | Reuse shared intelligence/evidence for photos, short videos, voice, text, multiple attachments, follow-ups and before/after comparisons. Plumbing, electrical, HVAC, roofing, structural, fire, lifts, doors, security and general repairs; category, asset, severity, confidence/uncertainty, evidence requests, response time, trade and safety concerns. Advisory only; conservative human safety escalation. |
| AF-MAINT-004 | Client-configurable routing | Partially implemented | Explicit approval rules, eligible suppliers and SLA preparation exist locally. Still require property/category/severity routing, trade/geography, preferred ranking, availability, contract terms, budgets/limits, hours/after-hours, escalation chains, tenant preferences and notifications. No unapproved PO; immutable decision evidence. |
| AF-MAINT-005 | Authorized contractor channel | Partially implemented | Staff can record acceptance evidence in the governed lifecycle. Contractor-scoped identity, notifications, acceptance/rejection, quotation, attendance/arrival, progress/media, variations, completion and invoice submission through WhatsApp or controlled web remain open; no approval bypass. |
| AF-MAINT-006 | Native inspection types and commercial context | Partially implemented | Existing inspections table, engine and property service retained. Require incoming/outgoing, periodic/routine, preventative, health/safety, statutory/compliance, post-repair and acquisition/due-diligence; commercial, retail, industrial, office, mixed-use and residential contexts. |
| AF-MAINT-007 | Versioned area and component templates | Not yet verified | Property → unit → area/room → component → item; reusable client-versioned templates, dynamic areas, customized questions, condition ratings, defects, notes, measurements, photographs/video and required evidence. Commercial asset areas must not inherit mandatory residential room structure. |
| AF-MAINT-008 | Incoming and outgoing comparison | Not yet verified | Baseline-preserving side-by-side images and room comparisons, historical/current defects, authorized fair-wear/damage review, fixtures, meters, keys/access devices, alterations, estimates, responsibility, disputes, acknowledgements and signatures. No AI liability decision. Approved lawful/contractual deductions must use canonical deposit/receivable/accounting services. |
| AF-MAINT-009 | Mobile offline inspections | Not yet verified | Rapid area navigation, high-resolution multi-photo/video/voice/dictation, ratings, defects, dynamic components, meters, signatures, mandatory-item review, durable offline drafts and safe sync. Detect conflicts; recover uploads; deduplicate evidence; preserve capture separately from upload timestamps. |
| AF-MAINT-010 | Professional inspection reports | Not yet verified | Branded PDF and secure interactive reports with client/property/unit/type/date/participants, checklists, assessments, annotations/photos, defects, comparisons, meters, recommendations/actions, signatures/acknowledgements, audit/evidence references. Permission-aware sharing with landlords, tenants, investors, asset managers and contractors. |
| AF-MAINT-011 | Inspection defects feed canonical maintenance | Partially implemented | Existing inspection and maintenance records retained; end-to-end lineage and idempotent defect conversion not verified. Preserve inspection/area/component/defect/work-order/contractor/repair/cost/final-condition relationships and original defect evidence; expose repeated defects. |
| AF-MAINT-012 | Evidence-based maintenance intelligence | Not yet verified | Recurring roof leaks/HVAC failures, contractor overruns, early recurrence, costs per square metre, unresolved prior defects and upcoming preventative work. Recommendations require authoritative history and supporting evidence. |
| AF-MAINT-013 | Complete maintenance financial lifecycle | Partially implemented | Local tests cover certified gross ceiling, explicit tax rates, independent AP approval, one balanced journal with AP-only supplier projection, property/cost centre, periods, retries, duplicate invoice prevention, verified existing bank allocations and separate repair/financial closure. OCR, full PO line reconciliation, budget variance UI, tenant recoverability, insurance, payment reversals and zero-cost closure remain open. |
| AF-MAINT-014 | Maintenance and inspection adversarial gates | Partially implemented | Local tests cover foreign entity reads/commands, approval limits, self-approval, stale/replayed commands, evidence checksum changes, audit rollback, partial/unverified payments, invoice duplicates and ledger corruption. Still require tenant-to-tenant/contractor-to-contractor inspection tests, expired links, upload interruption, real multi-session races and unauthorized deposit deduction checks. |
| AF-MAINT-015 | RedRabbit competitive acceptance | Partially implemented | Public comparison in docs/MAINTENANCE_DELIVERY_20261016.md. No parity or superiority claimed. Templates, room checklists, take-on/back, high-resolution evidence, offline, signatures, interactive reports, inspection tickets, contractor communication, tracking and reminders remain acceptance targets; differentiation requires working governed WhatsApp, media/routing, commercial context, finance/deposits and explainable intelligence. |
| AF-MAINT-016 | Integrated delivery and recovery | Partially implemented | Preserve checkpoint 59491f4 and prior history. Actual canonical service/database integration tests and clean bundle/patch recovery; no production deployment or main merge. Browser/provider/full Supabase and independent sessions remain explicit gates. Shared services for every interface; no parallel engines. |

## Flagship communication and bulk expense extension — 2026-10-16

These IDs extend the same register. Original IDs and AF-MAINT remain unchanged.
Evidence E7: `docs/WHATSAPP_INTAKE_20261016.md`; no full-domain completion claim.

| ID | Requirement | Status | Acceptance / remaining work |
|---|---|---|---|
| AF-COMM-001 | Property-manager communication with client authority | Partially implemented | Identify naturally as AssetFlow; never impersonate a human. Professional, warm, specific, truthful replies; discretion remains with client. Current text intake only. |
| AF-COMM-002 | Layered conversation architecture | Partially implemented | Identity/authorization, intent/context, authoritative retrieval, action planning, policy approval, professional generation, memory, evidence/recovery. Ingress identity/transaction boundary implemented; full intelligence open. |
| AF-COMM-003 | Natural continuity and grounded responses | Not yet verified | Follow-ups, corrections, voice transcription, related requests, frustration/urgency handling, client communication policies and isolated context. No invented balances, dates, availability, approval or dispatch. |
| AF-COMM-004 | Conversation acceptance scenarios | Partially implemented | Tenant recurring leak/safety follow-up, manager current/overdue balances with verified counts, municipal batch preparation/review links. Account-paired text intake is only a subset. |
| AF-COMM-005 | Canonical decision authority | Partially implemented | Separate reads, preparations, explicitly policy-authorized routine work, required approvals and prohibited autonomous decisions; record actor/policy/evidence/time. Existing maintenance authority retained. |
| AF-COMM-006 | Bulk Expense Intelligence Workspace | Not yet verified | Large mixed PDFs/scans/multi-page statements: municipal, electricity/water/rates/refuse/sewerage, security, cleaning, repairs, recurring and other expenses. Multiple invoices/properties per PDF. |
| AF-COMM-007 | Evidence-based extraction and allocation | Not yet verified | Supplier/account/invoice/date/service period/due date/property/entity/municipal refs/meters/readings/categories/VAT/totals/prior balance/current charges/payments/credits/adjustments/tariffs/GL/cost centre/recoverability. Approved history/rules, confidence/evidence; detect duplicates/pages/totals/reference conflicts/charge changes. |
| AF-COMM-008 | High-volume review UX | Not yet verified | Drag/drop, progress, side-by-side original/extraction, editable rows, grouping/search/filter/sort, presets/rules, GL/VAT review, authorized bulk approval, exceptions, keyboard access, evidence, totals/reconciliation, drill-down, retries preserving human corrections. |
| AF-COMM-009 | Municipal intelligence | Not yet verified | Municipality/account/property/period/meters/tariffs/VAT/components; missing months, tariff changes, consumption, estimated readings, duplicates, adjustments, allocation errors/recoverability/variance. Investigate weather/tariff/occupancy/consumption/error causes with uncertainty; no automatic diagnosis. |
| AF-COMM-010 | Canonical bulk posting | Partially implemented | Reuse AP/VAT/GL/subledger/period services, staged receipt/extraction/review/approval/posting/reconciliation, isolation/balance/duplicates/idempotency/property allocation, durable partial outcomes and recovery. Generic AP hardening is prerequisite; never claim all posted with pending/failed items. |
| AF-COMM-011 | Recurring expectations | Partially implemented | Existing expectations reused; due-date missing-account alerts, validated expectation matching, amount/date/period/account exceptions and valid VAT evidence. Full integration open. |
| AF-COMM-012 | WhatsApp bulk invoice submission | Not yet verified | Verified authority, secure multi-document receipt/entity context, extraction batch/progress/exceptions, secure review link/summary, approved mechanism and confirmed posting. No message-based approval bypass. |
| AF-COMM-013 | Demonstrated productivity | Not yet verified | Representative mixed municipal/supplier/property/period/duplicate/exception/VAT batches; measure extraction/matching/GL/VAT accuracy, exception/correction rates, machine/human time, posting recovery and reconciliation differences. No demonstrated time savings yet. |
| AF-COMM-014 | Conversation quality suite | Partially implemented | Test maintenance/emergency/recurrence/arrears/statements/leases/invoices/contractors/inspections/approvals, ambiguity/multiple properties/frustration/missing info/backend failure/unsupported/cross-client. Current tests cover trusted ingress, isolation and truthful transactional outcomes; full quality evaluation open. |
| AF-COMM-015 | Dependency-ordered delivery | Partially implemented | Secure maintenance intake, then native inspections; bulk expense discovery preserved for next financial batch. Preserve all requirements/history, coherent commits/recovery, no production deployment or main merge. |

## Product architecture clarification — client configuration (2026-10-16)

| ID | Requirement | Status | Evidence / remaining gates |
|---|---|---|---|
| AF-ARCH-001 | Platform-owned engines and system capabilities; client-owned financial configuration; organisation creation independent of financial readiness | Implemented; locally integration-tested, staging unverified | `docs/FINANCIAL_READINESS_20261016.md`; migration `20261016160000_client_financial_readiness.sql`; `tests/financial-readiness/integration.test.mjs`. Client JSON import/review and database posting gates. Deployed isolation, browser and independent-session concurrency remain open. |

## AF-FLOW-001 — Governed statement communication action (additional requirement)

Source: Flow Intelligent Action Orchestration directive, 2026-10-16. Preserve the
original audit IDs and any unresolved historical FLO definition separately.
Implemented/local-test evidence: `docs/FLOW_STATEMENTS_20261016.md`, `tests/flow`,
`lib/flow`, `/flow`, `/api/flow/statements`, migration
`20261016180000_flow_statement_actions.sql`. Reuses canonical identity, accounting
snapshots, PDF rendering, queue and audit. Supports WhatsApp request initiation and
web approval of exact recipients/documents. 23 targeted tests plus 214 regressions.
Status: locally tested slice; overall requirement remains partial until deployed
RBAC/concurrency/browser/provider acceptance and verified delivery/reconciliation.
No claim of general conversational orchestration or fully delivered flagship flow.
