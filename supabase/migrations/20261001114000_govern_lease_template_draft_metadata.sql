-- Govern metadata editing before a draft enters document analysis.
BEGIN;

CREATE FUNCTION public.update_lease_template_draft_metadata(
  p_template_id uuid,
  p_entity_id uuid,
  p_template_name text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_property_ids uuid[] DEFAULT NULL,
  p_applies_to_property_types text[] DEFAULT NULL
)
RETURNS public.lease_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_template public.lease_templates%ROWTYPE;
  v_result public.lease_templates;
  v_name text;
  v_category text;
  v_property_ids uuid[];
  v_property_types text[];
  v_categories constant text[] := ARRAY[
    'industrial', 'retail', 'office', 'residential',
    'commercial', 'informal', 'other'
  ];
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
       v_user_id, p_entity_id, 'leasing.template.edit'
     ) IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION 'Lease-template editing access denied'
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

  IF v_template.status <> 'draft'
     OR v_template.review_status <> 'pending'
     OR v_template.source_document_id IS NOT NULL
  THEN
    RAISE EXCEPTION
      'Metadata editing is restricted to drafts awaiting analysis'
      USING ERRCODE = '23514';
  END IF;

  v_name := COALESCE(p_template_name, v_template.template_name);
  v_category := COALESCE(p_category, v_template.category);
  v_property_ids := COALESCE(
    p_property_ids, v_template.property_ids
  );
  v_property_types := COALESCE(
    p_applies_to_property_types,
    v_template.applies_to_property_types
  );

  IF length(btrim(v_name)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid template name'
      USING ERRCODE = '22023';
  END IF;

  IF v_category <> ALL(v_categories) THEN
    RAISE EXCEPTION 'Invalid template category'
      USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_property_types) = 0
     OR EXISTS (
       SELECT 1
       FROM unnest(v_property_types) AS pt(value)
       WHERE pt.value IS NULL
          OR pt.value <> ALL(v_categories)
     )
  THEN
    RAISE EXCEPTION 'Invalid applicable property types'
      USING ERRCODE = '22023';
  END IF;

  IF array_position(v_property_ids, NULL) IS NOT NULL
     OR (
       SELECT COUNT(DISTINCT requested.property_id)
       FROM unnest(v_property_ids) AS requested(property_id)
     ) <> (
       SELECT COUNT(DISTINCT p.id)
       FROM public.properties AS p
       WHERE p.entity_id = p_entity_id
         AND p.id = ANY(v_property_ids)
     )
  THEN
    RAISE EXCEPTION
      'Every selected property must belong to the template entity'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize family metadata changes with version creation.
  IF v_template.family_id IS NOT NULL
     AND (
       v_name IS DISTINCT FROM v_template.template_name
       OR v_category IS DISTINCT FROM v_template.category
     )
  THEN
    PERFORM 1
    FROM public.lease_template_families AS family
    WHERE family.id = v_template.family_id
      AND family.entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Template family not found'
        USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.lease_templates AS other
      WHERE other.family_id = v_template.family_id
        AND other.id <> v_template.id
    ) THEN
      RAISE EXCEPTION
        'Versioned family metadata cannot be changed in place'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.lease_template_families
    SET name = btrim(v_name),
        category = v_category,
        updated_at = now()
    WHERE id = v_template.family_id
      AND entity_id = p_entity_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Template family not found'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE public.lease_templates
  SET template_name = btrim(v_name),
      category = v_category,
      property_ids = ARRAY(
        SELECT DISTINCT requested.property_id
        FROM unnest(v_property_ids) AS requested(property_id)
      ),
      applies_to_property_types = ARRAY(
        SELECT DISTINCT pt.value
        FROM unnest(v_property_types) AS pt(value)
      ),
      updated_at = now()
  WHERE id = p_template_id
    AND entity_id = p_entity_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION
  public.update_lease_template_draft_metadata(
    uuid, uuid, text, text, uuid[], text[]
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.update_lease_template_draft_metadata(
    uuid, uuid, text, text, uuid[], text[]
  )
TO authenticated;

COMMIT;
