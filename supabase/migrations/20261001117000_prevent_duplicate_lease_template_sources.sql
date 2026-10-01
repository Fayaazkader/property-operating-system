-- Enforce one lease-template source per entity and checksum.
-- Deployment must stop if new duplicates have appeared.

BEGIN;

CREATE UNIQUE INDEX
  idx_documents_lease_template_source_entity_checksum_unique
ON public.documents (entity_id, checksum)
WHERE document_type = 'lease_template_source'
  AND checksum IS NOT NULL;

COMMIT;
