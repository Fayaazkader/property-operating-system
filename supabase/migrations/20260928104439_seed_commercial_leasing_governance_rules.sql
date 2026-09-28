-- AssetFlow
-- Seed Canonical Commercial Leasing Governance Rules
--
-- Establishes the first AssetFlow-owned governance vocabulary for
-- commercial leasing.
--
-- AssetFlow defines the meaning and evaluation semantics of these rules.
-- Clients define their own effective commercial requirements through
-- governance policy sets and policy rules.
--
-- No commercial thresholds are hard-coded here.
-- No platform invariants are introduced by this migration.

BEGIN;

INSERT INTO public.governance_rule_definitions (
  rule_key,
  domain,
  name,
  description,
  value_type,
  governance_class,
  workflow_stage,
  inheritance_mode,
  override_allowed,
  approval_required_for_override,
  is_active,
  evaluation_operator,
  platform_value,
  platform_failure_outcome
)
VALUES
  (
    'leasing.monthly_rental.minimum',
    'commercial_leasing',
    'Minimum Monthly Rental',
    'Evaluates whether the proposed monthly rental meets the effective client-defined minimum monthly rental requirement.',
    'number',
    'client_governance',
    'commercial_submission',
    'override',
    true,
    true,
    true,
    'greater_than_or_equal',
    NULL,
    NULL
  ),
  (
    'leasing.deposit_amount.minimum',
    'commercial_leasing',
    'Minimum Deposit Amount',
    'Evaluates whether the proposed deposit amount meets the effective client-defined minimum deposit requirement.',
    'number',
    'client_governance',
    'commercial_submission',
    'override',
    true,
    true,
    true,
    'greater_than_or_equal',
    NULL,
    NULL
  ),
  (
    'leasing.escalation_percent.minimum',
    'commercial_leasing',
    'Minimum Escalation Percentage',
    'Evaluates whether the proposed escalation percentage meets the effective client-defined minimum escalation requirement.',
    'number',
    'client_governance',
    'commercial_submission',
    'override',
    true,
    true,
    true,
    'greater_than_or_equal',
    NULL,
    NULL
  ),
  (
    'leasing.lease_term_months.minimum',
    'commercial_leasing',
    'Minimum Lease Term',
    'Evaluates whether the proposed lease term in months meets the effective client-defined minimum lease term requirement.',
    'number',
    'client_governance',
    'commercial_submission',
    'override',
    true,
    true,
    true,
    'greater_than_or_equal',
    NULL,
    NULL
  ),
  (
    'leasing.commission_percent.maximum',
    'commercial_leasing',
    'Maximum Commission Percentage',
    'Evaluates whether the proposed commission percentage is within the effective client-defined maximum commission requirement.',
    'number',
    'client_governance',
    'commercial_submission',
    'override',
    true,
    true,
    true,
    'less_than_or_equal',
    NULL,
    NULL
  )
ON CONFLICT (rule_key)
DO UPDATE SET
  domain = EXCLUDED.domain,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  governance_class = EXCLUDED.governance_class,
  workflow_stage = EXCLUDED.workflow_stage,
  inheritance_mode = EXCLUDED.inheritance_mode,
  override_allowed = EXCLUDED.override_allowed,
  approval_required_for_override =
    EXCLUDED.approval_required_for_override,
  is_active = EXCLUDED.is_active,
  evaluation_operator = EXCLUDED.evaluation_operator,
  platform_value = EXCLUDED.platform_value,
  platform_failure_outcome = EXCLUDED.platform_failure_outcome,
  updated_at = now();

COMMIT;
