CREATE OR REPLACE FUNCTION public.claim_cashbook_transaction(
  p_transaction_id uuid,
  p_requires_receipt_governance boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_posting_status text;
  v_entity_id uuid;
  v_period_name text;
  v_workflow_phase text;
BEGIN
  /*
   * STEP 1: Lock the bank transaction.
   *
   * This is the authoritative claim boundary. The transaction cannot
   * simultaneously be claimed by another posting worker.
   */
  SELECT
    bt.posting_status,
    ba.entity_id
  INTO
    v_posting_status,
    v_entity_id
  FROM public.bank_transactions bt
  LEFT JOIN public.bank_accounts ba
    ON ba.id = bt.bank_account_id
  WHERE bt.id = p_transaction_id
  FOR UPDATE OF bt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'deferred', false,
      'message', 'Transaction not found'
    );
  END IF;

  IF v_posting_status NOT IN ('not_posted', 'posting_failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'deferred', false,
      'message', 'Transaction cannot be claimed from its current posting state'
    );
  END IF;

  /*
   * STEP 2: Receipt governance.
   *
   * Only tenant-receipt posting is governed by the statement-period
   * receipting gate. Other Cash Book transaction types are unaffected.
   */
  IF p_requires_receipt_governance THEN

    IF v_entity_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'deferred', false,
        'message', 'Cannot govern receipt posting because the bank account has no entity'
      );
    END IF;

    /*
     * Lock the current open statement period before allowing the claim.
     * Statement-period transitions therefore cannot race this governance
     * decision.
     */
    SELECT
      fp.period_name,
      COALESCE(fp.workflow_phase, 'open')
    INTO
      v_period_name,
      v_workflow_phase
    FROM public.financial_periods fp
    WHERE fp.entity_id = v_entity_id
      AND fp.period_type = 'statement'
      AND fp.status = 'open'
    ORDER BY fp.period_end DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'deferred', true,
        'message', 'No open statement period is available for receipt posting.'
      );
    END IF;

    IF v_workflow_phase NOT IN ('open', 'receipting', 'allocation') THEN
      RETURN jsonb_build_object(
        'success', false,
        'deferred', true,
        'periodName', v_period_name,
        'workflowPhase', v_workflow_phase,
        'message',
          'Tenant receipt posting is currently paused because statement period '
          || v_period_name
          || ' is in workflow phase "'
          || v_workflow_phase
          || '".'
      );
    END IF;
  END IF;

  /*
   * STEP 3: Claim atomically.
   */
  UPDATE public.bank_transactions
  SET
    posting_status = 'posting',
    updated_at = NOW()
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'deferred', false,
    'message', 'Transaction claimed for posting'
  );
END;
$$;
