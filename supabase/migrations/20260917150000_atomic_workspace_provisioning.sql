CREATE OR REPLACE FUNCTION public.provision_workspace(
  p_entity_id uuid,
  p_full_name text,
  p_email text,
  p_mobile text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_entity_id uuid := '00000000-0000-0000-0000-000000000000';
  v_template record;
  v_new_template_id uuid;
  v_source_account record;
  v_new_account_id uuid;
  v_now timestamptz := now();
  v_month text;
  v_year integer;
  v_first_day date;
  v_last_day date;
BEGIN
  /*
   * Workspace provisioning is intentionally atomic.
   * If any dependent configuration fails, PostgreSQL rolls
   * the entire provisioning transaction back.
   */

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity ID is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM entities
    WHERE id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Entity % does not exist', p_entity_id;
  END IF;

  /*
   * Profile
   */
  INSERT INTO profiles (
    id,
    display_name,
    email,
    mobile_number,
    platform_role
  )
  VALUES (
    auth.uid(),
    p_full_name,
    p_email,
    NULLIF(p_mobile, ''),
    'company_admin'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    mobile_number = EXCLUDED.mobile_number;

  /*
   * Chart of Accounts.
   *
   * We create a source-ID -> new-ID mapping so parent_account_id
   * relationships remain correct for the new entity.
   */
  CREATE TEMP TABLE _coa_map (
    source_id uuid PRIMARY KEY,
    target_id uuid NOT NULL
  ) ON COMMIT DROP;

  FOR v_source_account IN
    SELECT *
    FROM chart_of_accounts
    WHERE entity_id = v_template_entity_id
    ORDER BY
      CASE WHEN parent_account_id IS NULL THEN 0 ELSE 1 END,
      gl_code
  LOOP
    SELECT target_id
    INTO v_new_account_id
    FROM _coa_map
    WHERE source_id = v_source_account.id;

    IF v_new_account_id IS NULL THEN
      v_new_account_id := gen_random_uuid();

      INSERT INTO chart_of_accounts (
        id,
        entity_id,
        gl_code,
        account_name,
        account_type,
        category,
        sub_category,
        is_vatable,
        vat_rate,
        is_active,
        description,
        parent_account_id,
        created_at,
        updated_at,
        vat_category,
        account_range,
        account_code_prefix,
        cash_flow_category,
        reporting_category
      )
      VALUES (
        v_new_account_id,
        p_entity_id,
        v_source_account.gl_code,
        v_source_account.account_name,
        v_source_account.account_type,
        v_source_account.category,
        v_source_account.sub_category,
        v_source_account.is_vatable,
        v_source_account.vat_rate,
        v_source_account.is_active,
        v_source_account.description,
        CASE
          WHEN v_source_account.parent_account_id IS NULL THEN NULL
          ELSE (
            SELECT target_id
            FROM _coa_map
            WHERE source_id = v_source_account.parent_account_id
          )
        END,
        v_now,
        v_now,
        v_source_account.vat_category,
        v_source_account.account_range,
        v_source_account.account_code_prefix,
        v_source_account.cash_flow_category,
        v_source_account.reporting_category
      );

      INSERT INTO _coa_map (source_id, target_id)
      VALUES (v_source_account.id, v_new_account_id);
    END IF;
  END LOOP;

  /*
   * Posting templates and lines.
   */
  FOR v_template IN
    SELECT *
    FROM posting_templates
    WHERE entity_id = v_template_entity_id
    ORDER BY priority DESC, business_event
  LOOP
    INSERT INTO posting_templates (
      entity_id,
      business_event,
      description,
      is_active,
      priority
    )
    VALUES (
      p_entity_id,
      v_template.business_event,
      v_template.description,
      v_template.is_active,
      v_template.priority
    )
    RETURNING id INTO v_new_template_id;

    INSERT INTO posting_template_lines (
      template_id,
      sequence,
      direction,
      account_resolver,
      amount_formula,
      vat_treatment,
      vat_account_resolver,
      condition_formula,
      dimension_mapping
    )
    SELECT
      v_new_template_id,
      sequence,
      direction,
      account_resolver,
      amount_formula,
      vat_treatment,
      vat_account_resolver,
      condition_formula,
      dimension_mapping
    FROM posting_template_lines
    WHERE template_id = v_template.id
    ORDER BY sequence;
  END LOOP;

  /*
   * Open financial + statement periods.
   */
  v_month := to_char(v_now, 'FMMonth');
  v_year := EXTRACT(YEAR FROM v_now)::integer;
  v_first_day := date_trunc('month', v_now)::date;
  v_last_day := (date_trunc('month', v_now) + interval '1 month - 1 day')::date;

  INSERT INTO financial_periods (
    entity_id,
    period_name,
    period_start,
    period_end,
    status,
    period_type,
    workflow_phase
  )
  VALUES
    (
      p_entity_id,
      trim(v_month) || ' ' || v_year || ' Financial',
      v_first_day,
      v_last_day,
      'open',
      'financial',
      'open'
    ),
    (
      p_entity_id,
      'Statement ' || trim(v_month) || ' ' || v_year,
      v_first_day,
      v_last_day,
      'open',
      'statement',
      'open'
    );

  /*
   * Invoice + statement configuration.
   */
  INSERT INTO invoice_configs (entity_id)
  VALUES (p_entity_id);

  INSERT INTO statement_configs (entity_id)
  VALUES (p_entity_id);

  RETURN jsonb_build_object(
    'entity_id', p_entity_id,
    'profile_id', auth.uid(),
    'coa_count', (
      SELECT count(*)
      FROM chart_of_accounts
      WHERE entity_id = p_entity_id
    ),
    'posting_template_count', (
      SELECT count(*)
      FROM posting_templates
      WHERE entity_id = p_entity_id
    ),
    'financial_period_count', (
      SELECT count(*)
      FROM financial_periods
      WHERE entity_id = p_entity_id
        AND period_type = 'financial'
    ),
    'statement_period_count', (
      SELECT count(*)
      FROM financial_periods
      WHERE entity_id = p_entity_id
        AND period_type = 'statement'
    ),
    'invoice_config_created', EXISTS (
      SELECT 1
      FROM invoice_configs
      WHERE entity_id = p_entity_id
    ),
    'statement_config_created', EXISTS (
      SELECT 1
      FROM statement_configs
      WHERE entity_id = p_entity_id
    )
  );
END;
$$;
