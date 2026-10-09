BEGIN;

-- Staged uploads are attempts, not completed signatures.
-- A failed attempt must not permanently consume an invitation.

ALTER TABLE public.execution_signature_evidence
  DROP CONSTRAINT execution_signature_evidence_invitation_id_key;

ALTER TABLE public.execution_signature_evidence
  DROP CONSTRAINT execution_signature_evidence_verification_id_key;

-- Only one successfully committed signature may use a given
-- invitation or verification challenge.
CREATE UNIQUE INDEX execution_signature_evidence_committed_invitation_idx
  ON public.execution_signature_evidence (invitation_id)
  WHERE status = 'committed';

CREATE UNIQUE INDEX execution_signature_evidence_committed_verification_idx
  ON public.execution_signature_evidence (verification_id)
  WHERE status = 'committed';

COMMIT;
