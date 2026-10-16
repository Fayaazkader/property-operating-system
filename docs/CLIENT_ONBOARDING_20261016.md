# First-client onboarding milestone

Base: `13a8467a4b22fa18301faf6c1b96e3635839600d` (published WhatsApp release candidate).
Development branch: `work/assetflow-client-onboarding-20261016`.

## Delivered

- Signup now invokes canonical `provision_client_account`, never a direct entity
  insert or the retired `provision_workspace` path.
- Existing signed-in users can finish setup from the unassigned-account screen.
  New registrations without a session wait for email confirmation; form drafts
  survive in user metadata, which grants no authority. No database provisioning
  occurs until authenticated identity is verified.
- Explicit client/legal entity/code/role inputs, accessible labels, mobile sizing,
  loading, error, retry, sign-in and existing-workspace actions. A completed
  transaction reloads the application to refresh membership providers.
- Actor transaction lock and private receipt prevent duplicate graphs and recover
  lost responses. Creation, access profiles, financial foundation and receipt are
  atomic. Existing/legacy membership is not silently replaced; suspended or
  demoted users cannot recover stale authority. Platform roles are preserved.
- Empty financial template data now fails clearly instead of reporting an empty
  foundation as provisioned. No accounting defaults or commercial terms invented.
- Protected layout denies access on verification/query failure, supports retry,
  and closes on sign-out. Login no longer prints session credentials and handles
  failed sign-in/session establishment without becoming permanently busy.

## Migration and integration dependencies

`supabase/migrations/20261016140000_retry_safe_client_onboarding.sql` requires the
existing 20260928 canonical client foundation, provisioning and administration
schema/functions. It replaces the canonical provisioning function and adds the
private `client_onboarding_receipts` table, with no browser direct grants.
No remote migrations were applied. Review and approve staging application before
using the new UI; the previous RPC alone does not supply the new retry guarantees.

The canonical template entity `00000000-0000-0000-0000-000000000000` must have the
approved chart of accounts and posting templates/lines. Verify the complete
approved seed inventory, not just non-empty counts. Missing configuration needs
approved seed restoration, not ad hoc accounts or removal of the guard.
Supabase Auth must allow the staging `/auth/callback?next=/signup` confirmation
redirect. Confirm the project's actual email-confirmation behavior in staging.

## Verification

Commands:

```sh
node --test tests/onboarding/*.test.mjs tests/execution/*.test.mjs tests/maintenance/*.test.mjs tests/communications/*.test.mjs
node --experimental-strip-types --test lib/financial/*.test.mts
npx tsc --noEmit
git diff --check
```

The onboarding tests execute selected repository table definitions and actual
canonical provisioning, Standard Access and financial-foundation SQL in PGlite.
They exercise graph creation, account hierarchy, periods/configuration, safe
retries, missing seeds, wrong identity, anonymous/direct access denial,
entity-code conflicts, financial/receipt failure rollback and recovery,
suspended/demoted/legacy access, actor isolation and TypeScript-to-SQL integration.
Application tests prove membership errors never return an allowed state.
Queued duplicate calls in one embedded session are NOT proof of independent
PostgreSQL-session concurrency. Deployed JWT/RLS and complete migration-chain
validation remain staging gates.

Browser acceptance is preserved in `tests/onboarding/acceptance.browser.mjs`.
It requires Playwright with Chromium and an isolated staging test user without
memberships. Explicit opt-in is required because it creates a synthetic workspace.
Supply secrets through your environment, not committed files:

```sh
# Set ONBOARDING_STAGING_URL, ONBOARDING_TEST_EMAIL,
# ONBOARDING_TEST_PASSWORD and ALLOW_ONBOARDING_STAGING_WRITE=true securely.
node tests/onboarding/acceptance.browser.mjs
```

This browser script was NOT executed: local Playwright Chromium is absent and
Next development startup encountered `uv_interface_addresses` system error 1.
No production build was run. Independently test new-user email confirmation,
existing-user setup, access-query outage/recovery, mobile/keyboard behavior,
parallel independent-session requests and refresh after a lost response in staging.
Do not delete receipts or manually create memberships to bypass a failed check.

## Readiness

Implemented and locally integration-tested; not staging-certified. User-reported
13a8467 staging deployment/migration/login success is preserved and is not evidence
that this new migration or UI has passed staging. No website expansion, WhatsApp
scope expansion, Production modification or main merge belongs to this milestone.

Final local results: 214 onboarding/execution/maintenance/communications tests
passed, 0 failed, 0 skipped (15 onboarding tests + 199 existing regressions).
10 financial tests passed. `npx tsc --noEmit` and `git diff --check` passed.
Browser acceptance was not run and is not included in those passing counts.
