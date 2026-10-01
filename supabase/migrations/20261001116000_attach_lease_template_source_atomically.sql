-- Atomic, permission-governed attachment of template documents.
BEGIN;

CREATE FUNCTION public.attach_lease_template_source(
  p_template_id uuid,
  p_entity_id uuid,
  p_actor_id uuid,
  p_document_id uuid,
  p_checksum text,
  p_field_mapping jsonb,
  p_ai_suggestions jsonb,
  p_fields jsonb
)
RETURNS public.lease_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_template public.lease_templates%ROWTYPE;
  v_document public.documents%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL
     OR p_entity_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_entity_access AS uea
       WHERE uea.user_id = p_actor_id
         AND uea.entity_id = p_entity_id
     )
     OR public.has_entity_permission(
       p_actor_id,
       p_entity_id,
       'leasing.template.edit'
     ) IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION 'Lease-template attachment access denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_template
  FROM public.lease_templates
  WHERE id = p_template_id
    AND entity_id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lease template not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_template.status IS DISTINCT FROM 'draft'
     OR v_template.review_status IS DISTINCT FROM 'pending'
     OR v_template.source_document_id IS NOT NULL
  THEN
    RAISE EXCEPTION
      'Template already has a source or is under review'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_document
  FROM public.documents
  WHERE id = p_document_id
    AND entity_id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_document.document_type IS DISTINCT FROM 'lease_template_source'
     OR v_document.uploaded_by IS DISTINCT FROM p_actor_id
     OR v_document.checksum IS DISTINCT FROM p_checksum
     OR v_document.status IS DISTINCT FROM 'received'
  THEN
    RAISE EXCEPTION 'Invalid lease-template source document'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lease_templates AS lt
    WHERE lt.entity_id = p_entity_id
      AND lt.source_document_id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Source document is already attached'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.lease_templates
  SET source_document_id = v_document.id,
      source_document_checksum = v_document.checksum,
      source_file_name = v_document.file_name,
      source_mime_type = v_document.mime_type,
      source_document_url = v_document.storage_key,
      field_mapping = COALESCE(p_field_mapping, '[]'::jsonb),
      ai_suggestions = COALESCE(p_ai_suggestions, '[]'::jsonb),
      clause_suggestions = '[]'::jsonb,
      fields = COALESCE(p_fields, '[]'::jsonb),
      review_status = 'in_review',
      updated_at = now()
  WHERE id = p_template_id
    AND entity_id = p_entity_id
    AND status = 'draft'
    AND review_status = 'pending'
    AND source_document_id IS NULL
  RETURNING * INTO v_template;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template attachment state changed'
      USING ERRCODE = '23514';
  END IF;

  RETURN v_template;
END;
$$;

REVOKE ALL ON FUNCTION
  public.attach_lease_template_source(
    uuid, uuid, uuid, uuid, text, jsonb, jsonb, jsonb
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.attach_lease_template_source(
    uuid, uuid, uuid, uuid, text, jsonb, jsonb, jsonb
  )
TO service_role;

COMMIT;
