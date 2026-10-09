BEGIN;

-- Private evidence bucket. Never expose signatures through public URLs.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'execution-evidence',
  'execution-evidence',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'application/json', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.execution_signature_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  execution_id uuid NOT NULL
    REFERENCES public.executions(id) ON DELETE RESTRICT,

  participant_id uuid NOT NULL
    REFERENCES public.execution_participants(id) ON DELETE RESTRICT,

  document_version_id uuid NOT NULL
    REFERENCES public.execution_document_versions(id) ON DELETE RESTRICT,

  invitation_id uuid NOT NULL
    REFERENCES public.execution_signing_invitations(id) ON DELETE RESTRICT,

  verification_id uuid NOT NULL
    REFERENCES public.execution_signer_verifications(id) ON DELETE RESTRICT,

  bucket_id text NOT NULL DEFAULT 'execution-evidence'
    CHECK (bucket_id = 'execution-evidence'),

  storage_path text NOT NULL UNIQUE,

  content_sha256 text NOT NULL
    CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),

  content_type text NOT NULL
    CHECK (content_type IN ('image/png', 'image/jpeg', 'application/json')),

  content_length bigint NOT NULL
    CHECK (content_length BETWEEN 1 AND 10485760),

  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'committed')),

  UNIQUE (invitation_id),
  UNIQUE (verification_id),

  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,

  CONSTRAINT execution_signature_evidence_commit_check
    CHECK (
      (status = 'staged' AND committed_at IS NULL)
      OR
      (status = 'committed' AND committed_at IS NOT NULL)
    )
);

CREATE INDEX execution_signature_evidence_participant_idx
  ON public.execution_signature_evidence (
    execution_id,
    participant_id,
    created_at DESC
  );

-- Preserve the identity and integrity of registered evidence.
-- Only the staged-to-committed lifecycle transition is permitted.
CREATE FUNCTION public.protect_execution_signature_evidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Signature evidence cannot be deleted';
  END IF;

  IF OLD.status = 'committed' THEN
    RAISE EXCEPTION 'Committed signature evidence is immutable';
  END IF;

  IF (
    NEW.id,
    NEW.execution_id,
    NEW.participant_id,
    NEW.document_version_id,
    NEW.invitation_id,
    NEW.verification_id,
    NEW.bucket_id,
    NEW.storage_path,
    NEW.content_sha256,
    NEW.content_type,
    NEW.content_length,
    NEW.created_at
  ) IS DISTINCT FROM (
    OLD.id,
    OLD.execution_id,
    OLD.participant_id,
    OLD.document_version_id,
    OLD.invitation_id,
    OLD.verification_id,
    OLD.bucket_id,
    OLD.storage_path,
    OLD.content_sha256,
    OLD.content_type,
    OLD.content_length,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Signature evidence identity is immutable';
  END IF;

  IF NEW.status <> 'committed'
     OR NEW.committed_at IS NULL THEN
    RAISE EXCEPTION 'Invalid signature evidence transition';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER protect_execution_signature_evidence_update
BEFORE UPDATE OR DELETE
ON public.execution_signature_evidence
FOR EACH ROW
EXECUTE FUNCTION public.protect_execution_signature_evidence();

REVOKE ALL ON FUNCTION public.protect_execution_signature_evidence()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.protect_execution_signature_evidence()
TO service_role;

ALTER TABLE public.execution_signature_evidence
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.execution_signature_evidence
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.execution_signature_evidence
  TO service_role;

-- Do not create anonymous or authenticated storage policies.
-- The trusted server uses service-role access only.

COMMIT;
