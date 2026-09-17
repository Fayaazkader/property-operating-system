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
AS $function$
DECLARE
  v_template_entity_id uuid := '00000000-0000-0000-0000-000000000000';
  v_template record;
  v_template_line record;
  v_existing_template_id uuid;
  v_new_template_id uuid;
  v_source_account record;
  v_target_account_id uuid;
  v_source_parent_target_id uuid;
  v_now timestamptz := now();
  v_month text;
  v_year integer;
  v_first_day date;
  v_last_day date;
  v_existing_line record;
  v_source_coa_count integer;
  v_target_coa_count integer;
  v_source_template_count integer;
  v_target_template_count integer;
  v_source_line_count integer;
  v_target_line_count integer;
  v_financial_period_exists boolean;
  v_statement_period_exists boolean;
  v_invoice_config_exists boolean;
  v_statement_config_exists boolean;
BEGIN
  /*
   * ================================================================
   * SECURITY BOUNDARY
   * ================================================================
   */

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity ID is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM entities
    WHERE id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Entity does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM user_entity_access
    WHERE user_id = auth.uid()
      AND entity_id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'User is not authorized to provision this entity';
  END IF;

  /*
   * ================================================================
   * PROFILE
   *
   * platform_role is a platform-level role.
   * Workspace authority is represented separately by
   * user_entity_access.org_role.
   * ================================================================
   */

  INSERT INTO profiles (
    id,
    display_name,
    email,
    platform_role
  )
  VALUES (
    auth.uid(),
    p_full_name,
    p_email,
    'user'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email;

  /*
   * ================================================================
   * CHART OF ACCOUNTS
   *
   * Two-pass cloning:
   *   1. Ensure every account exists without a parent.
   *   2. Resolve all parent relationships using the source->target map.
   *
   * This is hierarchy-safe regardless of account depth/order.
   * ================================================================
   */

  CREATE TEMP TABLE _coa_map (
    source_id uuid PRIMARY KEY,
    target_id uuid NOT NULL
  ) ON COMMIT DROP;

  /*
   * Map any accounts already created by a previous successful
   * provisioning attempt.
   */
  INSERT INTO _coa_map (source_id, target_id)
  SELECT
    source.id,
    target.id
  FROM chart_of_accounts source
  JOIN chart_of_accounts target
    ON target.entity_id = p_entity_id
   AND target.gl_code = source.gl_code
  WHERE source.entity_id = v_template_entity_id;

  /*
   * Create any missing accounts.
   *
   * All parents are initially NULL. Parent relationships are
   * established in the second pass below.
   */
  FOR v_source_account IN
    SELECT *
    FROM chart_of_accounts
    WHERE entity_id = v_template_entity_id
    ORDER BY gl_code
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM _coa_map
      WHERE source_id = v_source_account.id
    ) THEN

      v_target_account_id := gen_random_uuid();

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
        v_target_account_id,
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
        NULL,
        v_now,
        v_now,
        v_source_account.vat_category,
        v_source_account.account_range,
        v_source_account.account_code_prefix,
        v_source_account.cash_flow_category,
        v_source_account.reporting_category
      );

      INSERT INTO _coa_map (source_id, target_id)
      VALUES (v_source_account.id, v_target_account_id);
    END IF;
  END LOOP;

  /*
   * Resolve every parent relationship from the source hierarchy.
   */
  FOR v_source_account IN
    SELECT *
    FROM chart_of_accounts
    WHERE entity_id = v_template_entity_id
  LOOP
    IF v_source_account.parent_account_id IS NOT NULL THEN

      SELECT target_id
      INTO v_source_parent_target_id
      FROM _coa_map
      WHERE source_id = v_source_account.parent_account_id;

      IF v_source_parent_target_id IS NULL THEN
        RAISE EXCEPTION
          'Unable to resolve parent account % for GL account %',
          v_source_account.parent_account_id,
          v_source_account.gl_code;
      END IF;

    ELSE
      v_source_parent_target_id := NULL;
    END IF;

    SELECT target_id
    INTO v_target_account_id
    FROM _coa_map
    WHERE source_id = v_source_account.id;

    IF v_target_account_id IS NULL THEN
      RAISE EXCEPTION
        'Unable to resolve target account for GL account %',
        v_source_account.gl_code;
    END IF;

    UPDATE chart_of_accounts
    SET
      parent_account_id = v_source_parent_target_id,
      updated_at = v_now
    WHERE id = v_target_account_id
      AND entity_id = p_entity_id;
  END LOOP;

  /*
   * Validate COA completeness.
   */
  SELECT count(*)
  INTO v_source_coa_count
  FROM chart_of_accounts
  WHERE entity_id = v_template_entity_id;

  SELECT count(*)
  INTO v_target_coa_count
  FROM chart_of_accounts
  WHERE entity_id = p_entity_id;

  IF v_target_coa_count <> v_source_coa_count THEN
    RAISE EXCEPTION
      'Workspace COA provisioning incomplete: expected %, found %',
      v_source_coa_count,
      v_target_coa_count;
  END IF;

  /*
   * ================================================================
   * POSTING TEMPLATES + LINES
   *
   * Existing templates are reused.
   * Missing templates/lines are created.
   * Existing lines are validated rather than silently overwritten.
   * ================================================================
   */

  FOR v_template IN
    SELECT *
    FROM posting_templates
    WHERE entity_id = v_template_entity_id
    ORDER BY priority DESC, business_event
  LOOP

    SELECT id
    INTO v_existing_template_id
    FROM posting_templates
    WHERE entity_id = p_entity_id
      AND business_event = v_template.business_event
    LIMIT 1;

    IF v_existing_template_id IS NULL THEN

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

    ELSE
      v_new_template_id := v_existing_template_id;

      /*
       * Existing template must still represent the same canonical
       * provisioning template. Do not silently overwrite it.
       */
      IF EXISTS (
        SELECT 1
        FROM posting_templates target
        WHERE target.id = v_new_template_id
          AND (
            target.description IS DISTINCT FROM v_template.description
            OR target.is_active IS DISTINCT FROM v_template.is_active
            OR target.priority IS DISTINCT FROM v_template.priority
          )
      ) THEN
        RAISE EXCEPTION
          'Existing posting template % for business event % differs from the canonical workspace template',
          v_new_template_id,
          v_template.business_event;
      END IF;
    END IF;

    /*
     * Ensure every canonical line exists.
     */
    FOR v_template_line IN
      SELECT *
      FROM posting_template_lines
      WHERE template_id = v_template.id
      ORDER BY sequence
    LOOP

      SELECT *
      INTO v_existing_line
      FROM posting_template_lines
      WHERE template_id = v_new_template_id
        AND sequence = v_template_line.sequence
      LIMIT 1;

      IF v_existing_line.id IS NULL THEN

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
        VALUES (
          v_new_template_id,
          v_template_line.sequence,
          v_template_line.direction,
          v_template_line.account_resolver,
          v_template_line.amount_formula,
          v_template_line.vat_treatment,
          v_template_line.vat_account_resolver,
          v_template_line.condition_formula,
          v_template_line.dimension_mapping
        );

      ELSE

        IF (
          v_existing_line.direction IS DISTINCT FROM v_template_line.direction
          OR v_existing_line.account_resolver IS DISTINCT FROM v_template_line.account_resolver
          OR v_existing_line.amount_formula IS DISTINCT FROM v_template_line.amount_formula
          OR v_existing_line.vat_treatment IS DISTINCT FROM v_template_line.vat_treatment
          OR v_existing_line.vat_account_resolver IS DISTINCT FROM v_template_line.vat_account_resolver
          OR v_existing_line.condition_formula IS DISTINCT FROM v_template_line.condition_formula
          OR v_existing_line.dimension_mapping IS DISTINCT FROM v_template_line.dimension_mapping
        ) THEN
          RAISE EXCEPTION
            'Existing posting template line % for business event % differs from the canonical workspace template',
            v_existing_line.id,
            v_template.business_event;
        END IF;

      END IF;
    END LOOP;

  END LOOP;

  /*
   * Validate template and line completeness.
   */
  SELECT count(*)
  INTO v_source_template_count
  FROM posting_templates
  WHERE entity_id = v_template_entity_id;

  SELECT count(*)
  INTO v_target_template_count
  FROM posting_templates
  WHERE entity_id = p_entity_id;

  IF v_target_template_count <> v_source_template_count THEN
    RAISE EXCEPTION
      'Workspace posting template provisioning incomplete: expected %, found %',
      v_source_template_count,
      v_target_template_count;
  END IF;

  SELECT count(*)
  INTO v_source_line_count
  FROM posting_template_lines lines
  JOIN posting_templates templates
    ON templates.id = lines.template_id
  WHERE templates.entity_id = v_template_entity_id;

  SELECT count(*)
  INTO v_target_line_count
  FROM posting_template_lines lines
  JOIN posting_templates templates
    ON templates.id = lines.template_id
  WHERE templates.entity_id = p_entity_id;

  IF v_target_line_count <> v_source_line_count THEN
    RAISE EXCEPTION
      'Workspace posting template line provisioning incomplete: expected %, found %',
      v_source_line_count,
      v_target_line_count;
  END IF;

  /*
   * ================================================================
   * FINANCIAL + STATEMENT PERIODS
   *
   * Reuse existing periods on retry.
   * ================================================================
   */

  v_month := to_char(v_now, 'FMMonth');
  v_year := EXTRACT(YEAR FROM v_now)::integer;
  v_first_day := date_trunc('month', v_now)::date;
  v_last_day := (
    date_trunc('month', v_now) +
    interval '1 month - 1 day'
  )::date;

  SELECT EXISTS (
    SELECT 1
    FROM financial_periods
    WHERE entity_id = p_entity_id
      AND period_type = 'financial'
      AND period_name = trim(v_month) || ' ' || v_year || ' Financial'
  )
  INTO v_financial_period_exists;

  IF NOT v_financial_period_exists THEN
    INSERT INTO financial_periods (
      entity_id,
      period_name,
      period_start,
      period_end,
      status,
      period_type,
      workflow_phase
    )
    VALUES (
      p_entity_id,
      trim(v_month) || ' ' || v_year || ' Financial',
      v_first_day,
      v_last_day,
      'open',
      'financial',
      'open'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM financial_periods
    WHERE entity_id = p_entity_id
      AND period_type = 'statement'
      AND period_name = 'Statement ' || trim(v_month) || ' ' || v_year
  )
  INTO v_statement_period_exists;

  IF NOT v_statement_period_exists THEN
    INSERT INTO financial_periods (
      entity_id,
      period_name,
      period_start,
      period_end,
      status,
      period_type,
      workflow_phase
    )
    VALUES (
      p_entity_id,
      'Statement ' || trim(v_month) || ' ' || v_year,
      v_first_day,
      v_last_day,
      'open',
      'statement',
      'open'
    );
  END IF;

  /*
   * ================================================================
   * ENTITY CONFIGURATION
   * ================================================================
   */

  SELECT EXISTS (
    SELECT 1
    FROM invoice_configs
    WHERE entity_id = p_entity_id
  )
  INTO v_invoice_config_exists;

  IF NOT v_invoice_config_exists THEN
    INSERT INTO invoice_configs (entity_id)
    VALUES (p_entity_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM statement_configs
    WHERE entity_id = p_entity_id
  )
  INTO v_statement_config_exists;

  IF NOT v_statement_config_exists THEN
    INSERT INTO statement_configs (entity_id)
    VALUES (p_entity_id);
  END IF;

  /*
   * ================================================================
   * FINAL INTEGRITY VALIDATION
   * ================================================================
   */

  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND platform_role = 'user'
  ) THEN
    RAISE EXCEPTION 'Workspace profile provisioning failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM user_entity_access
    WHERE user_id = auth.uid()
      AND entity_id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Workspace membership missing after provisioning';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM financial_periods
    WHERE entity_id = p_entity_id
      AND period_type = 'financial'
      AND period_name = trim(v_month) || ' ' || v_year || ' Financial'
  ) THEN
    RAISE EXCEPTION 'Financial period provisioning failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM financial_periods
    WHERE entity_id = p_entity_id
      AND period_type = 'statement'
      AND period_name = 'Statement ' || trim(v_month) || ' ' || v_year
  ) THEN
    RAISE EXCEPTION 'Statement period provisioning failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM invoice_configs
    WHERE entity_id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Invoice configuration provisioning failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM statement_configs
    WHERE entity_id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Statement configuration provisioning failed';
  END IF;

  RETURN jsonb_build_object(
    'entity_id', p_entity_id,
    'profile_id', auth.uid(),
    'coa_count', v_target_coa_count,
    'posting_template_count', v_target_template_count,
    'posting_template_line_count', v_target_line_count,
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
    'invoice_config_created', v_invoice_config_exists OR EXISTS (
      SELECT 1
      FROM invoice_configs
      WHERE entity_id = p_entity_id
    ),
    'statement_config_created', v_statement_config_exists OR EXISTS (
      SELECT 1
      FROM statement_configs
      WHERE entity_id = p_entity_id
    ),
    'status', 'provisioned'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.provision_workspace(uuid, text, text, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.provision_workspace(uuid, text, text, text)
TO authenticated;
