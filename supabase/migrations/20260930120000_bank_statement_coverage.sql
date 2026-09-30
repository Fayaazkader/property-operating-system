-- Record the actual period covered by the bank-issued statement.
-- Existing imports remain unverified until supporting evidence is provided.

ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS coverage_start date,
  ADD COLUMN IF NOT EXISTS coverage_end date,
  ADD COLUMN IF NOT EXISTS coverage_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS coverage_verified_by uuid REFERENCES auth.users(id);

ALTER TABLE public.bank_statements
  ADD CONSTRAINT bank_statement_coverage_dates_valid
  CHECK (
    (coverage_start IS NULL AND coverage_end IS NULL)
    OR (
      coverage_start IS NOT NULL
      AND coverage_end IS NOT NULL
      AND coverage_start <= coverage_end
    )
  );

ALTER TABLE public.bank_statements
  ADD CONSTRAINT bank_statement_coverage_verification_valid
  CHECK (
    (coverage_verified_at IS NULL AND coverage_verified_by IS NULL)
    OR (
      coverage_verified_at IS NOT NULL
      AND coverage_verified_by IS NOT NULL
      AND coverage_start IS NOT NULL
      AND coverage_end IS NOT NULL
    )
  );

-- Prevent silent changes to verified statement coverage.
CREATE OR REPLACE FUNCTION public.protect_verified_bank_statement_coverage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.coverage_verified_at IS NOT NULL
     AND (
       NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id
       OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
       OR NEW.statement_date IS DISTINCT FROM OLD.statement_date
       OR NEW.opening_balance IS DISTINCT FROM OLD.opening_balance
       OR NEW.closing_balance IS DISTINCT FROM OLD.closing_balance
       OR NEW.coverage_evidence_document_id IS DISTINCT FROM OLD.coverage_evidence_document_id
       OR NEW.coverage_start IS DISTINCT FROM OLD.coverage_start
       OR NEW.coverage_end IS DISTINCT FROM OLD.coverage_end
       OR NEW.coverage_verified_at IS DISTINCT FROM OLD.coverage_verified_at
       OR NEW.coverage_verified_by IS DISTINCT FROM OLD.coverage_verified_by
     )
  THEN
    RAISE EXCEPTION 'Verified bank statement details cannot be modified';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_verified_bank_statement_coverage
BEFORE UPDATE ON public.bank_statements
FOR EACH ROW
EXECUTE FUNCTION public.protect_verified_bank_statement_coverage();


-- Only the dedicated verification function may verify coverage.
-- Its transaction-local flag is an internal coordination mechanism,
-- not the authorisation check.




-- The reviewer must inspect the linked bank-issued document.
-- A document reference alone does not establish the coverage dates.
ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS coverage_evidence_document_id uuid
  REFERENCES public.documents(id) ON DELETE RESTRICT;

ALTER TABLE public.bank_statements
  ADD CONSTRAINT bank_statement_verified_evidence_required
  CHECK (
    coverage_verified_at IS NULL
    OR coverage_evidence_document_id IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.bank_statement_evidence_exists(
  p_document_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN storage.objects o
      ON o.bucket_id = d.storage_bucket
     AND o.name = d.storage_key
    WHERE d.id = p_document_id
      AND d.storage_bucket = 'bank-statement-evidence'
      AND o.is_delete_marker = false
      AND o.archived_at IS NULL
  );
$$;

-- Read the authenticated request identity without granting the
-- dedicated verification role access to the auth schema.
CREATE OR REPLACE FUNCTION public.assetflow_coverage_request_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

REVOKE ALL ON FUNCTION public.assetflow_coverage_request_uid()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_bank_statement_coverage(
  p_statement_id uuid,
  p_document_id uuid,
  p_coverage_start date,
  p_coverage_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := public.assetflow_coverage_request_uid();
  v_entity_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_coverage_start IS NULL
     OR p_coverage_end IS NULL
     OR p_coverage_start > p_coverage_end THEN
    RAISE EXCEPTION 'Invalid statement coverage dates';
  END IF;

  SELECT entity_id INTO v_entity_id
  FROM public.bank_statements
  WHERE id = p_statement_id
    AND coverage_verified_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement not found or already verified';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_entity_permissions
    WHERE user_id = v_user_id
      AND entity_id = v_entity_id
      AND permission_key = 'finance.bank_statement.verify_coverage'
      AND enabled = true
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.document_relationships r
      ON r.document_id = d.id
    WHERE d.id = p_document_id
      AND d.entity_id = v_entity_id
      AND d.document_type = 'bank_statement_source'
      AND d.storage_bucket = 'bank-statement-evidence'
      AND NULLIF(d.storage_key, '') IS NOT NULL
      AND NULLIF(d.checksum, '') IS NOT NULL
      AND r.related_entity_type = 'bank_statement'
      AND r.related_entity_id = p_statement_id
      AND r.relationship_type = 'source_document'
  ) THEN
    RAISE EXCEPTION 'Valid supporting bank statement document required';
  END IF;

  IF NOT public.bank_statement_evidence_exists(p_document_id) THEN
    RAISE EXCEPTION
      'Supporting bank statement file is missing from private storage';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bank_transactions
    WHERE statement_id = p_statement_id
      AND (
        transaction_date IS NULL
        OR transaction_date < p_coverage_start
        OR transaction_date > p_coverage_end
      )
  ) THEN
    RAISE EXCEPTION
      'Imported transactions have missing dates or fall outside statement coverage';
  END IF;

  UPDATE public.bank_statements
  SET coverage_start = p_coverage_start,
      coverage_end = p_coverage_end,
      coverage_evidence_document_id = p_document_id,
      coverage_verified_at = now(),
      coverage_verified_by = v_user_id
  WHERE id = p_statement_id
    AND coverage_verified_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'statementId', p_statement_id,
    'documentId', p_document_id
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.verify_bank_statement_coverage(uuid, uuid, date, date)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.verify_bank_statement_coverage(uuid, uuid, date, date)
TO authenticated;

-- Ordinary API roles cannot directly change coverage verification fields.
-- Verification is performed through the permission-checked RPC.
REVOKE UPDATE (
  coverage_start,
  coverage_end,
  coverage_verified_at,
  coverage_verified_by
)
ON public.bank_statements
FROM anon, authenticated;

-- Preserve verified statements and their audit evidence.
CREATE OR REPLACE FUNCTION public.prevent_verified_bank_statement_deletion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.coverage_verified_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Verified bank statements cannot be deleted';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_verified_bank_statement_deletion
BEFORE DELETE ON public.bank_statements
FOR EACH ROW
EXECUTE FUNCTION public.prevent_verified_bank_statement_deletion();

-- Replace broad API update privileges with explicit operational columns.
REVOKE UPDATE ON public.bank_statements FROM anon, authenticated;

GRANT UPDATE (
  bank_account_id,
  closing_balance,
  entity_id,
  id,
  imported_at,
  opening_balance,
  statement_date,
  status
)
ON public.bank_statements
TO anon, authenticated;

-- Evidence references may only be assigned by the authorised verification RPC.
-- The existing table-level UPDATE grant was revoked earlier in this migration.
REVOKE UPDATE (coverage_evidence_document_id)
ON public.bank_statements
FROM anon, authenticated;

-- Verified evidence must remain linked to its original statement.
CREATE OR REPLACE FUNCTION public.protect_verified_statement_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bank_statements
    WHERE coverage_evidence_document_id = OLD.id
      AND coverage_verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Documents supporting verified bank statement coverage cannot be modified or deleted';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_verified_statement_document
BEFORE UPDATE OR DELETE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.protect_verified_statement_document();

-- Preserve the relationship between verified coverage and its source document.
CREATE OR REPLACE FUNCTION public.protect_verified_statement_relationship()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bank_statements bs
    WHERE bs.coverage_evidence_document_id = OLD.document_id
      AND bs.id = OLD.related_entity_id
      AND OLD.related_entity_type = 'bank_statement'
      AND OLD.relationship_type = 'source_document'
      AND bs.coverage_verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Relationships supporting verified bank statement coverage cannot be modified or deleted';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_verified_statement_relationship
BEFORE UPDATE OR DELETE ON public.document_relationships
FOR EACH ROW
EXECUTE FUNCTION public.protect_verified_statement_relationship();

-- Dedicated, non-login execution role for coverage verification.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'assetflow_coverage_verifier'
  ) THEN
    CREATE ROLE assetflow_coverage_verifier NOLOGIN NOINHERIT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assetflow_coverage_request_uid()
TO assetflow_coverage_verifier;

GRANT USAGE ON SCHEMA public
TO assetflow_coverage_verifier;

GRANT SELECT ON
  public.bank_statements,
  public.documents,
  public.document_relationships,
  public.user_entity_permissions
TO assetflow_coverage_verifier;

GRANT UPDATE (
  coverage_start,
  coverage_end,
  coverage_evidence_document_id,
  coverage_verified_at,
  coverage_verified_by
)
ON public.bank_statements
TO assetflow_coverage_verifier;

CREATE POLICY coverage_verifier_permissions_read
ON public.user_entity_permissions
FOR SELECT
TO assetflow_coverage_verifier
USING (
  user_id = public.assetflow_coverage_request_uid()
  AND enabled = true
);

CREATE POLICY coverage_verifier_statement_update
ON public.bank_statements
FOR UPDATE
TO assetflow_coverage_verifier
USING (coverage_verified_at IS NULL)
WITH CHECK (
  coverage_verified_at IS NOT NULL
  AND coverage_verified_by = public.assetflow_coverage_request_uid()
);

-- PostgreSQL requires the current owner to be a member of the new
-- owner role and the new owner to have CREATE on the function's schema.
GRANT assetflow_coverage_verifier TO postgres;
GRANT CREATE ON SCHEMA public TO assetflow_coverage_verifier;

ALTER FUNCTION public.verify_bank_statement_coverage(
  uuid, uuid, date, date
) OWNER TO assetflow_coverage_verifier;

-- Function ownership does not require permanent schema CREATE access.
REVOKE CREATE ON SCHEMA public FROM assetflow_coverage_verifier;

-- Replace the earlier postgres-based verification guard.
CREATE OR REPLACE FUNCTION public.guard_bank_statement_coverage_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.coverage_verified_at IS NOT NULL
       OR NEW.coverage_verified_by IS NOT NULL
       OR NEW.coverage_evidence_document_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Coverage cannot be verified or assigned evidence during import';
    END IF;
  ELSIF NEW.coverage_verified_at IS DISTINCT FROM OLD.coverage_verified_at
     OR NEW.coverage_verified_by IS DISTINCT FROM OLD.coverage_verified_by
     OR NEW.coverage_evidence_document_id
        IS DISTINCT FROM OLD.coverage_evidence_document_id THEN

    IF current_user <> 'assetflow_coverage_verifier' THEN
      RAISE EXCEPTION
        'Coverage verification requires the authorised database function';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_bank_statement_coverage_verification
BEFORE INSERT OR UPDATE ON public.bank_statements
FOR EACH ROW
EXECUTE FUNCTION public.guard_bank_statement_coverage_verification();

-- TRUNCATE bypasses row-level DELETE protection triggers.
REVOKE TRUNCATE ON
  public.bank_statements,
  public.documents,
  public.document_relationships
FROM anon, authenticated, service_role;

-- Trigger functions are internal database infrastructure, not API endpoints.
REVOKE ALL ON FUNCTION
  public.guard_bank_statement_coverage_verification(),
  public.protect_verified_bank_statement_coverage(),
  public.prevent_verified_bank_statement_deletion(),
  public.protect_verified_statement_document(),
  public.protect_verified_statement_relationship()
FROM PUBLIC, anon, authenticated;

-- Explicitly retain access to auth.uid() for the dedicated function owner.


-- Prevent Storage API operations from removing or replacing verified evidence.
CREATE OR REPLACE FUNCTION public.protect_verified_bank_statement_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bank_statements bs
    JOIN public.documents d
      ON d.id = bs.coverage_evidence_document_id
    WHERE bs.coverage_verified_at IS NOT NULL
      AND d.storage_bucket = OLD.bucket_id
      AND d.storage_key = OLD.name
      AND OLD.bucket_id = 'bank-statement-evidence'
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION
        'Verified bank statement evidence cannot be deleted';
    END IF;

    IF NEW.bucket_id IS DISTINCT FROM OLD.bucket_id
       OR NEW.name IS DISTINCT FROM OLD.name
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.metadata IS DISTINCT FROM OLD.metadata
       OR NEW.user_metadata IS DISTINCT FROM OLD.user_metadata
       OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
       OR NEW.is_delete_marker IS DISTINCT FROM OLD.is_delete_marker
       OR NEW.is_versioned IS DISTINCT FROM OLD.is_versioned THEN
      RAISE EXCEPTION
        'Verified bank statement evidence cannot be replaced or altered';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  public.protect_verified_bank_statement_storage()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER protect_verified_bank_statement_storage
BEFORE UPDATE OR DELETE ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION public.protect_verified_bank_statement_storage();

-- Allow the verification function to validate imported transaction dates.
GRANT SELECT ON public.bank_transactions
TO assetflow_coverage_verifier;

-- The verification role must be able to inspect all transactions
-- belonging to the statement, regardless of their existing RLS policies.
CREATE POLICY coverage_verifier_transactions_read
ON public.bank_transactions
FOR SELECT
TO assetflow_coverage_verifier
USING (true);

-- Permit the verification role to confirm that the evidence object exists.


-- Require the referenced Storage object to exist before verification.


REVOKE ALL ON FUNCTION
  public.bank_statement_evidence_exists(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.bank_statement_evidence_exists(uuid)
TO assetflow_coverage_verifier;

-- Prevent transactions from being added outside verified statement coverage.

-- Prevent transactions from being added outside verified statement coverage.
CREATE OR REPLACE FUNCTION public.enforce_verified_statement_transaction_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_start date;
  v_end date;
BEGIN
  IF NEW.statement_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coverage_start, coverage_end
  INTO v_start, v_end
  FROM public.bank_statements
  WHERE id = NEW.statement_id
    AND coverage_verified_at IS NOT NULL
  FOR UPDATE;

  IF FOUND AND (
    NEW.transaction_date IS NULL
    OR NEW.transaction_date < v_start
    OR NEW.transaction_date > v_end
  ) THEN
    RAISE EXCEPTION
      'Transaction date falls outside verified bank statement coverage';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  public.enforce_verified_statement_transaction_dates()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_verified_statement_transaction_dates
BEFORE INSERT OR UPDATE OF statement_id, transaction_date
ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_verified_statement_transaction_dates();
