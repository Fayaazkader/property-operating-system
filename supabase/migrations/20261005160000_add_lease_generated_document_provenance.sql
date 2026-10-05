BEGIN;

CREATE TABLE public.lease_generated_document_provenance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_id uuid NOT NULL
        REFERENCES public.entities(id),

    document_id uuid NOT NULL
        REFERENCES public.documents(id)
        ON DELETE RESTRICT,

    opportunity_id uuid NOT NULL
        REFERENCES public.leasing_opportunities(id),

    commercial_version_id uuid NOT NULL
        REFERENCES public.leasing_opportunity_versions(id),

    template_id uuid NOT NULL
        REFERENCES public.lease_templates(id),

    template_version integer NOT NULL
        CHECK (template_version > 0),

    template_source_document_id uuid NOT NULL
        REFERENCES public.documents(id)
        ON DELETE RESTRICT,

    template_source_checksum text NOT NULL,
    generated_checksum text NOT NULL,

    created_by uuid NOT NULL
        REFERENCES auth.users(id),

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lease_generated_document_provenance_document_key
        UNIQUE (document_id),

    CONSTRAINT lease_generated_document_provenance_generation_key
        UNIQUE (
            entity_id,
            commercial_version_id,
            template_id,
            template_version
        ),

    CONSTRAINT lease_generated_document_provenance_checksum_nonempty
        CHECK (length(btrim(generated_checksum)) > 0),

    CONSTRAINT lease_generated_document_provenance_source_checksum_nonempty
        CHECK (length(btrim(template_source_checksum)) > 0)
);

CREATE INDEX idx_lease_generated_document_provenance_entity
    ON public.lease_generated_document_provenance(entity_id);

CREATE INDEX idx_lease_generated_document_provenance_opportunity
    ON public.lease_generated_document_provenance(opportunity_id);

CREATE INDEX idx_lease_generated_document_provenance_commercial_version
    ON public.lease_generated_document_provenance(commercial_version_id);

CREATE INDEX idx_lease_generated_document_provenance_template
    ON public.lease_generated_document_provenance(template_id);

CREATE INDEX idx_lease_generated_document_provenance_source_document
    ON public.lease_generated_document_provenance(template_source_document_id);

ALTER TABLE public.lease_generated_document_provenance
    ENABLE ROW LEVEL SECURITY;

/*
 * Contractual generation provenance is server-controlled.
 *
 * No browser-facing RLS policies are intentionally created here.
 * Generation must pass through the authenticated, entity-authorized,
 * permission-checked server workflow.
 */

CREATE OR REPLACE FUNCTION public.prevent_lease_generated_document_provenance_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Lease generated document provenance is immutable';
END;
$$;

CREATE TRIGGER prevent_lease_generated_document_provenance_update
BEFORE UPDATE ON public.lease_generated_document_provenance
FOR EACH ROW
EXECUTE FUNCTION public.prevent_lease_generated_document_provenance_mutation();

CREATE TRIGGER prevent_lease_generated_document_provenance_delete
BEFORE DELETE ON public.lease_generated_document_provenance
FOR EACH ROW
EXECUTE FUNCTION public.prevent_lease_generated_document_provenance_mutation();

COMMENT ON TABLE public.lease_generated_document_provenance IS
'Immutable provenance linking each generated lease document to the approved commercial version and approved lease-template source that produced it.';

COMMENT ON COLUMN public.lease_generated_document_provenance.generated_checksum IS
'SHA-256 checksum of the actual generated document bytes registered in public.documents.';

COMMENT ON COLUMN public.lease_generated_document_provenance.template_source_checksum IS
'SHA-256 checksum of the verified approved lease-template source used to generate the document.';

COMMIT;
