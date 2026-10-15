import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ValidSigningInvitation } from './invitation-validation';
import type { ExecutionField } from '../field-manifest';

export async function loadSigningFields(client: SupabaseClient, invitation: ValidSigningInvitation) {
  const { data: execution, error: executionError } = await client.from('executions')
    .select('source_type').eq('id',invitation.execution_id).maybeSingle();
  if (executionError || !execution) throw new Error('Execution unavailable');
  if (execution.source_type !== 'leasing_opportunity') {
    // Existing non-lease signing remains governed by its existing PDF/OTP/evidence
    // transaction. This lease rollout must not require a lease-only editor there.
    return { fields: [] as ExecutionField[], manifestSha256: null, pdfSha256: null };
  }
  const { data: manifest, error } = await client.from('execution_field_manifests')
    .select('fields, manifest_sha256, pdf_sha256, status')
    .eq('execution_id', invitation.execution_id).eq('document_version_id', invitation.document_version_id)
    .eq('status', 'frozen').maybeSingle();
  if (error || !manifest || !Array.isArray(manifest.fields) || !/^[a-f0-9]{64}$/.test(manifest.manifest_sha256)) {
    throw new Error('Frozen signing fields unavailable');
  }
  const fields = (manifest.fields as ExecutionField[]).filter(f => f.participantId === invitation.participant_id);
  if (!fields.length || !fields.some(f => f.type === 'signature')) throw new Error('Participant signing fields missing');
  return { fields, manifestSha256: manifest.manifest_sha256 as string, pdfSha256: manifest.pdf_sha256 as string };
}

export function requireCompletedSigningFields(required: ExecutionField[], submitted: unknown): string[] {
  if (!Array.isArray(submitted) || submitted.length !== required.length ||
      new Set(submitted).size !== submitted.length ||
      submitted.some(id => typeof id !== 'string' || !required.some(f => f.id === id))) {
    throw new Error('Complete every required signing field');
  }
  return submitted as string[];
}
