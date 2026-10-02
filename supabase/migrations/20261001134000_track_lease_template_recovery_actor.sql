-- Track the authorized actor currently owning a lease-template upload recovery.
--
-- actor_id remains immutable provenance for the original uploader.
-- recovery_actor_id identifies the authorized user who owns the current
-- recovery generation/lease. It is populated only by a governed recovery
-- claim and cleared when recovery ownership terminates.

BEGIN;

ALTER TABLE public.lease_template_upload_attempts
    ADD COLUMN recovery_actor_id uuid;

COMMENT ON COLUMN public.lease_template_upload_attempts.recovery_actor_id IS
'Authorized actor owning the current governed recovery generation. Separate from actor_id, which remains original-upload provenance. NULL when no recovery claim is active.';

CREATE INDEX lease_template_upload_attempts_recovery_actor_idx
    ON public.lease_template_upload_attempts (
        entity_id,
        recovery_actor_id
    )
    WHERE recovery_actor_id IS NOT NULL;

COMMIT;
