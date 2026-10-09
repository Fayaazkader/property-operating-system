# AssetFlow — Development Handover
Date: 2026-10-09
Phase: Phase 1 architecture audit and pilot-critical remediation

## Latest verified checkpoint

- Branch: main
- Prior checkpoint: ad06a70
- Production Supabase project: syuamqnefexvvridkdjf
- Production migration history verified through 20261009152000.
- Public signing POST remains disabled with HTTP 503.
- Local builds must NOT be run; use `npx tsc --noEmit`.
- Do not stage unrelated untracked audit files.

## Signing database — deployed

Migrations:
- 20261009150000_create_execution_signing_documents.sql
- 20261009151000_require_prepared_execution_pdf.sql
- 20261009152000_preserve_nonlease_execution_snapshots.sql

Production verification:
- All three migrations recorded remotely.
- execution_signing_documents table exists.
- execution_signing_invitations table exists.
- execution-documents and execution-evidence buckets are private.
- Five checked execution RPCs are SECURITY DEFINER.
- Those RPCs permit service_role, not anon/authenticated.
- RLS enabled on execution_signing_documents and
  execution_signature_evidence.
- Verification ran read-only and rolled back.

Rollback-only tests:
- Signing-document registration and commitment.
- Invitation and verified-signature PDF gates.
- Rejected operations and unchanged evidence.
- Non-lease snapshot preservation.
- Missing legacy lease source rejection.

Not yet verified:
- Positive legacy lease snapshot capture with a real lease fixture.
- Real Storage-backed signing-document preparation.
- Real DOCX conversion service and its deployment.
- End-to-end signing, PDF flattening and certificate generation.
- Lease activation and commencement billing after signing.
- Full backup restoration and Storage object recovery.

## Existing implementation

- lib/execution/server/document-source.ts
- lib/execution/server/document-conversion-core.ts
- lib/execution/server/document-conversion.ts
- lib/execution/server/signing-document-storage.ts
- lib/execution/server/signature-submission.ts
- lib/execution/server/signature-evidence-storage.ts
- lib/execution/server/signature-evidence-registry.ts
- lib/execution/server/signer-verification.ts

The conversion boundary exists but the external DOCX converter
is not configured or verified in production.

## Next three actions

1. Connect authorized document source loading, conversion,
   signing PDF Storage readback and database commitment.
   Completion: integration tests prove source identity,
   checksum, permissions, PDF integrity and retry behavior.

2. Complete native signing workflow for both generated leases
   and manually uploaded documents.
   Completion: participant authority confirmation, email OTP,
   actual signatures/initials, immutable execution evidence,
   signed PDF and completion certificate verified end to end.

3. Connect completed lease execution to activation and billing.
   Completion: verified lease state, financial postings,
   commencement charges, failure recovery and audit trail.

## Operational restrictions

- Do not enable public signing prematurely.
- Do not reuse insecure legacy signing implementations.
- Do not run npm run build on the Windows development machine.
- Use npx tsc --noEmit and git diff --check.
- Never use git add . because unrelated audit files exist.
- Avoid speculative refactoring and repeated deep discovery.
- Continue the 221-item whole-app audit by verified dependency.
- Keep docs/ASSETFLOW_SYSTEM_MAP.md updated as domains close.
- Production Supabase Free plan lacks managed backups/PITR.
- Existing database dump is not a tested full restore and
  does not include Storage object backup.
