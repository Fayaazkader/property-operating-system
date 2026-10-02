-- Read-only inspection of lease-template upload outcomes.
-- Does not release reservations, delete resources or change state.
BEGIN;

CREATE FUNCTION public.inspect_lease_template_upload_attempt(
    p_attempt_id uuid
)
RETURNS TABLE (
    attempt_id uuid,
    attempt_status text,
    entity_id uuid,
    template_id uuid,
    document_id uuid,
    storage_key text,
    lease_expires_at timestamptz,
    template_exists boolean,
    document_exists boolean,
    document_matches_attempt boolean,
    document_attached_to_template boolean,
    template_has_different_document boolean,
    requires_storage_inspection boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        a.id,
        a.status,
        a.entity_id,
        a.template_id,
        a.document_id,
        a.storage_key,
        a.lease_expires_at,
        (t.id IS NOT NULL),
        (d.id IS NOT NULL),
        COALESCE(
            d.id IS NOT NULL
            AND d.entity_id = a.entity_id
            AND d.checksum = a.checksum
            AND d.storage_key IS NOT DISTINCT FROM a.storage_key
            AND d.document_type = 'lease_template_source'
            AND d.uploaded_by = a.actor_id
            AND d.status = 'received',
            FALSE
        ),
        (
            t.id IS NOT NULL
            AND t.source_document_id = a.document_id
            AND a.document_id IS NOT NULL
        ),
        (
            t.source_document_id IS NOT NULL
            AND t.source_document_id IS DISTINCT FROM a.document_id
        ),
        (a.storage_key IS NOT NULL)
    FROM public.lease_template_upload_attempts AS a
    LEFT JOIN public.lease_templates AS t
        ON t.id = a.template_id
       AND t.entity_id = a.entity_id
    LEFT JOIN public.documents AS d
        ON d.id = a.document_id
       AND d.entity_id = a.entity_id
    WHERE a.id = p_attempt_id;
$$;

REVOKE ALL ON FUNCTION
    public.inspect_lease_template_upload_attempt(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.inspect_lease_template_upload_attempt(uuid)
TO service_role;

COMMIT;
