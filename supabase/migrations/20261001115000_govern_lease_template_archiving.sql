-- Permission-governed archiving of approved lease templates.
BEGIN;

CREATE FUNCTION public.archive_lease_template(
  p_template_id uuid,
  p_entity_id uuid
)
RETURNS public.lease_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_template public.lease_templates%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  IF p_entity_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_entity_access AS uea
       WHERE uea.user_id = v_user_id
         AND uea.entity_id = p_entity_id
     )
     OR public.has_entity_permission(
       v_user_id,
       p_entity_id,
       'leasing.template.archive'
     ) IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION 'Lease-template archiving access denied'
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

  IF v_template.status <> 'active'
     OR v_template.review_status <> 'approved'
  THEN
    RAISE EXCEPTION
      'Only active, approved templates can be archived'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.lease_templates
  SET status = 'archived',
      archived_by = v_user_id,
      archived_at = now(),
      updated_at = now()
  WHERE id = p_template_id
    AND entity_id = p_entity_id
    AND status = 'active'
    AND review_status = 'approved'
  RETURNING * INTO v_template;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template archive state changed'
      USING ERRCODE = '23514';
  END IF;

  RETURN v_template;
END;
$$;

REVOKE ALL ON FUNCTION
  public.archive_lease_template(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.archive_lease_template(uuid, uuid)
TO authenticated;

COMMIT;
