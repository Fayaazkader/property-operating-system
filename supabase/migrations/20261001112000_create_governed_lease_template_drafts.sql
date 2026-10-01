-- AssetFlow: atomic, permission-governed lease-template draft creation.
-- Deploy together with the application RPC integration and write restrictions.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_lease_template_draft(
  p_entity_id uuid,
  p_template_name text,
  p_category text,
  p_applies_to_property_types text[],
  p_property_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS public.lease_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_template public.lease_templates;
  v_valid_categories constant text[] := ARRAY[
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
     OR NOT public.has_entity_permission(
       v_user_id,
       p_entity_id,
       'leasing.template.create'
     )
  THEN
    RAISE EXCEPTION 'Lease-template creation access denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_template_name IS NULL
     OR length(btrim(p_template_name)) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'Template name must contain 1–200 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_category IS NULL
     OR p_category <> ALL (v_valid_categories)
  THEN
    RAISE EXCEPTION 'Invalid lease-template category'
      USING ERRCODE = '22023';
  END IF;

  IF p_applies_to_property_types IS NULL
     OR cardinality(p_applies_to_property_types) = 0
     OR EXISTS (
       SELECT 1
       FROM unnest(p_applies_to_property_types) AS pt(value)
       WHERE pt.value IS NULL
          OR pt.value <> ALL (v_valid_categories)
     )
  THEN
    RAISE EXCEPTION 'Invalid applicable property types'
      USING ERRCODE = '22023';
  END IF;

  IF p_property_ids IS NULL
     OR array_position(p_property_ids, NULL) IS NOT NULL
     OR (
       SELECT COUNT(DISTINCT requested.property_id)
       FROM unnest(p_property_ids) AS requested(property_id)
     ) <> (
       SELECT COUNT(DISTINCT p.id)
       FROM public.properties AS p
       WHERE p.entity_id = p_entity_id
         AND p.id = ANY(p_property_ids)
     )
  THEN
    RAISE EXCEPTION
      'Every selected property must belong to the template entity'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.lease_template_families (
    entity_id,
    name,
    category,
    is_active,
    created_by
  )
  VALUES (
    p_entity_id,
    btrim(p_template_name),
    p_category,
    true,
    v_user_id
  )
  RETURNING id INTO v_family_id;

  INSERT INTO public.lease_templates (
    entity_id,
    family_id,
    template_name,
    category,
    version,
    status,
    review_status,
    property_ids,
    applies_to_property_types,
    created_by
  )
  VALUES (
    p_entity_id,
    v_family_id,
    btrim(p_template_name),
    p_category,
    1,
    'draft',
    'pending',
    ARRAY(
      SELECT DISTINCT requested.property_id
      FROM unnest(p_property_ids) AS requested(property_id)
    ),
    ARRAY(
      SELECT DISTINCT pt.value
      FROM unnest(p_applies_to_property_types) AS pt(value)
    ),
    v_user_id
  )
  RETURNING * INTO v_template;

  RETURN v_template;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lease_template_draft(
  uuid, text, text, text[], uuid[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_lease_template_draft(
  uuid, text, text, text[], uuid[]
) TO authenticated;

COMMIT;
