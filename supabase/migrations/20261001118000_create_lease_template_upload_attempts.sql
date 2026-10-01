-- Durable, service-controlled lease-template upload ledger.
-- No existing documents or templates are modified.

BEGIN;

CREATE TABLE public.lease_template_upload_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid NOT NULL,
    template_id uuid NOT NULL
        REFERENCES public.lease_templates(id),
    -- May identify a planned document before its row exists.
    -- The attachment RPC validates the actual document.
    document_id uuid UNIQUE,
    actor_id uuid NOT NULL,
    checksum text NOT NULL
        CHECK (checksum ~ '^[0-9a-f]{64}$'),
    storage_key text,
    status text NOT NULL DEFAULT 'reserved'
        CHECK (
            status IN (
                'reserved',
                'processing',
                'attaching',
                'attached',
                'failed',
                'cleaned_up',
                'reconciliation_required'
            )
        ),
    lease_expires_at timestamptz,
    error_code text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT lease_template_upload_attempts_failed_cleanup
        CHECK (
            status <> 'cleaned_up'
            OR completed_at IS NOT NULL
        ),
    CONSTRAINT lease_template_upload_attempts_attached_document
        CHECK (
            status <> 'attached'
            OR document_id IS NOT NULL
        ),
    CONSTRAINT lease_template_upload_attempts_storage_key_unique
        UNIQUE (storage_key)
);

CREATE INDEX idx_lease_template_upload_attempts_entity_template
    ON public.lease_template_upload_attempts (
        entity_id,
        template_id,
        created_at DESC
    );

CREATE INDEX idx_lease_template_upload_attempts_recovery
    ON public.lease_template_upload_attempts (
        status,
        lease_expires_at
    )
    WHERE status IN (
        'reserved',
        'processing',
        'attaching',
        'reconciliation_required'
    );

-- Prevent concurrent reservations of the same source.
-- Failed attempts remain auditable but do not block new reservations.
CREATE UNIQUE INDEX
    idx_lease_template_upload_attempts_active_checksum
ON public.lease_template_upload_attempts (
    entity_id,
    checksum
)
WHERE status <> 'cleaned_up';

-- Only one active upload may target a particular template.
CREATE UNIQUE INDEX
    idx_lease_template_upload_attempts_active_template
ON public.lease_template_upload_attempts (
    template_id
)
WHERE status <> 'cleaned_up';

ALTER TABLE public.lease_template_upload_attempts
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lease_template_upload_attempts
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.lease_template_upload_attempts
    TO service_role;

COMMIT;
