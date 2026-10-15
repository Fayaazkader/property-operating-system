import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashSigningInvitationToken } from './invitation-tokens';

export type FinalArtifactType = 'signed_pdf' | 'execution_certificate';
export function requireFinalArtifactType(value: unknown): FinalArtifactType {
  if (value !== 'signed_pdf' && value !== 'execution_certificate') throw new Error('Invalid artifact type');
  return value;
}
/** Caller establishes entity authority or a completed signer's verified invitation.
 * Storage paths are resolved exclusively from committed canonical records.
 */
export async function loadCommittedExecutionArtifact(client: SupabaseClient, executionId: string, documentVersionId: string, type: FinalArtifactType) {
  const {data:execution,error:executionError}=await client.from('executions').select('status, deleted_at, sha_hash, document_package_url, execution_certificate_url')
    .eq('id',executionId).maybeSingle();
  const {data:artifact,error}=await client.from('execution_final_artifacts')
    .select('storage_path, bucket_id, content_sha256, content_length, manifest_sha256').eq('execution_id',executionId)
    .eq('document_version_id',documentVersionId).eq('artifact_type',type).eq('status','committed').maybeSingle();
  const {data:manifest,error:manifestError}=await client.from('execution_field_manifests').select('manifest_sha256')
    .eq('execution_id',executionId).eq('document_version_id',documentVersionId).eq('status','frozen').maybeSingle();
  if(executionError||error||manifestError||!execution||execution.deleted_at||!['executed','activated'].includes(execution.status)||!artifact||!manifest||
      artifact.manifest_sha256!==manifest.manifest_sha256||artifact.bucket_id!=='execution-documents'||
      (type==='signed_pdf'&&(execution.sha_hash!==artifact.content_sha256||execution.document_package_url!==artifact.storage_path))||
      (type==='execution_certificate'&&execution.execution_certificate_url!==artifact.storage_path)||
      !Number.isSafeInteger(artifact.content_length)||artifact.content_length<1||artifact.content_length>30*1024*1024) throw new Error('Executed artifact unavailable');
  const {data:file,error:downloadError}=await client.storage.from('execution-documents').download(artifact.storage_path);
  if(downloadError||!file||file.size!==artifact.content_length)throw new Error('Executed artifact storage unavailable');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==artifact.content_sha256)throw new Error('Executed artifact integrity mismatch');
  return bytes;
}

export async function loadCompletedSignerArtifact(client: SupabaseClient, token: string, verificationId: string, type: FinalArtifactType) {
  const tokenHash=hashSigningInvitationToken(token);
  const {data:invitation,error}=await client.from('execution_signing_invitations')
    .select('id, execution_id, document_version_id, participant_id, consumed_at, revoked_at, expires_at').eq('token_hash',tokenHash).maybeSingle();
  if(error||!invitation||!invitation.consumed_at||invitation.revoked_at||!Number.isFinite(Date.parse(invitation.expires_at))||Date.parse(invitation.expires_at)<=Date.now()) {
    throw new Error('Completed invitation unavailable');
  }
  const {data:verification,error:verificationError}=await client.from('execution_signer_verifications')
    .select('verified_at, revoked_at, delivery_status, channel').eq('id',verificationId).eq('invitation_id',invitation.id).maybeSingle();
  const {data:evidence,error:evidenceError}=await client.from('execution_signature_evidence').select('id')
    .eq('execution_id',invitation.execution_id).eq('participant_id',invitation.participant_id)
    .eq('document_version_id',invitation.document_version_id).eq('invitation_id',invitation.id)
    .eq('verification_id',verificationId).eq('status','committed').maybeSingle();
  if(verificationError||evidenceError||!evidence||!verification?.verified_at||verification.revoked_at||verification.delivery_status!=='accepted'||verification.channel!=='email') {
    throw new Error('Completed signer verification required');
  }
  return loadCommittedExecutionArtifact(client,invitation.execution_id,invitation.document_version_id,type);
}
