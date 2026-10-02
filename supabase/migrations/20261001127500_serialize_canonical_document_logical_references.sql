-- Serialize logical references to canonical documents with destructive
-- canonical-document recovery.
--
-- document_reviews.document_id and supplier_invoices_new.document_id are
-- existing logical references without foreign keys to public.documents.
-- The triggers below deliberately do not add referential-integrity semantics;
-- they only make reference creation/update participate in the same
-- transaction-scoped advisory-lock protocol used by governed cleanup.

BEGIN;

CREATE OR REPLACE FUNCTION public.lock_canonical_document_reference(
    p_document_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_document_id IS NULL THEN
        RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            'assetflow:canonical-document:' || p_document_id::text,
            0
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION
    public.lock_canonical_document_reference(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.lock_canonical_document_reference(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.serialize_document_review_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_document_id uuid;
BEGIN
    IF NEW.document_id IS NULL
       OR (
            TG_OP = 'UPDATE'
            AND NEW.document_id IS NOT DISTINCT FROM OLD.document_id
          )
    THEN
        RETURN NEW;
    END IF;

    /*
     * document_reviews.document_id is legacy text. Preserve that contract:
     * only UUID-shaped values participate in canonical-document locking.
     */
    BEGIN
        v_document_id := NEW.document_id::uuid;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RETURN NEW;
    END;

    PERFORM public.lock_canonical_document_reference(v_document_id);

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
    public.serialize_document_review_reference()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
    serialize_document_review_reference
ON public.document_reviews;

CREATE TRIGGER serialize_document_review_reference
BEFORE INSERT OR UPDATE OF document_id
ON public.document_reviews
FOR EACH ROW
EXECUTE FUNCTION public.serialize_document_review_reference();

CREATE OR REPLACE FUNCTION public.serialize_supplier_invoice_document_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.document_id IS NULL
       OR (
            TG_OP = 'UPDATE'
            AND NEW.document_id IS NOT DISTINCT FROM OLD.document_id
          )
    THEN
        RETURN NEW;
    END IF;

    PERFORM public.lock_canonical_document_reference(NEW.document_id);

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
    public.serialize_supplier_invoice_document_reference()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
    serialize_supplier_invoice_document_reference
ON public.supplier_invoices_new;

CREATE TRIGGER serialize_supplier_invoice_document_reference
BEFORE INSERT OR UPDATE OF document_id
ON public.supplier_invoices_new
FOR EACH ROW
EXECUTE FUNCTION public.serialize_supplier_invoice_document_reference();

COMMENT ON FUNCTION public.lock_canonical_document_reference(uuid)
IS
'Acquires the transaction-scoped advisory lock used to serialize logical canonical-document references with governed destructive cleanup.';

COMMENT ON FUNCTION public.serialize_document_review_reference()
IS
'Serializes UUID-shaped document_reviews.document_id writes with governed canonical-document cleanup without changing the legacy text reference contract.';

COMMENT ON FUNCTION public.serialize_supplier_invoice_document_reference()
IS
'Serializes supplier_invoices_new.document_id writes with governed canonical-document cleanup without adding new referential-integrity semantics.';

COMMIT;
