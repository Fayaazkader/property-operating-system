import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assembleExecutedPdf, type FinalisationSigner } from './finalisation-pdf';
import { assembleExecutionCertificate } from './finalisation-certificate';
import type { ExecutionFieldManifest } from '../field-manifest';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function download(client: SupabaseClient, bucket: string, path: string, sha256: string, length: number, limit: number) {
  if (!Number.isSafeInteger(length) || length < 1 || length > limit || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid artifact metadata');
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data || data.size !== length) throw new Error('Artifact storage unavailable');
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (hash(bytes) !== sha256) throw new Error('Artifact integrity mismatch');
  return bytes;
}

/** Trusted canonical server command; SQL rechecks all immutable authority at each
 * stage/commit/completion. Storage is content-addressed, never overwritten. A
 * failure leaves registered attempts recoverable by invoking this command again.
 */
export async function finaliseExecution(client: SupabaseClient, executionId: string, documentVersionId: string) {
  if (!UUID.test(executionId) || !UUID.test(documentVersionId)) throw new Error('Invalid finalisation reference');
  const { data: execution, error: executionError } = await client.from('executions')
    .select('status, version, is_locked, deleted_at').eq('id', executionId).maybeSingle();
  if (executionError || !execution || execution.deleted_at || !execution.is_locked || !['partially_signed','executed'].includes(execution.status)) {
    throw new Error('Execution cannot finalise');
  }
  const { data: manifest, error: manifestError } = await client.from('execution_field_manifests')
    .select('fields, manifest_sha256, pdf_sha256, signing_document_id').eq('execution_id', executionId)
    .eq('document_version_id', documentVersionId).eq('status', 'frozen').maybeSingle();
  if (manifestError || !manifest) throw new Error('Frozen manifest unavailable');
  const { data: pdf, error: pdfError } = await client.from('execution_signing_documents')
    .select('storage_path, pdf_checksum, content_length').eq('id', manifest.signing_document_id)
    .eq('execution_id', executionId).eq('document_version_id', documentVersionId).eq('status', 'committed').maybeSingle();
  if (pdfError || !pdf || pdf.pdf_checksum !== manifest.pdf_sha256) throw new Error('Signing PDF unavailable');
  const { data: participants, error: participantError } = await client.from('execution_participants')
    .select('id, name, email, status, signed_at, signature_data, ip_address, user_agent').eq('execution_id', executionId).order('signing_order').order('id');
  if (participantError || !participants?.length || participants.some(p => p.status !== 'signed' || !p.signed_at || p.signature_data?.manifest_sha256 !== manifest.manifest_sha256)) {
    throw new Error('Signatures incomplete');
  }
  const { data: records, error: recordsError } = await client.from('execution_signature_evidence')
    .select('id, participant_id, storage_path, content_sha256, content_type, content_length, initials_storage_path, initials_sha256, initials_content_type, initials_content_length')
    .eq('execution_id', executionId).eq('document_version_id', documentVersionId).eq('status', 'committed');
  if (recordsError || !records) throw new Error('Signature evidence unavailable');
  const signers: FinalisationSigner[] = [];
  for (const p of participants) {
    const evidence = records.find(e => e.id === p.signature_data.evidence_id && e.participant_id === p.id);
    if (!evidence || evidence.content_sha256 !== p.signature_data.signature_sha256 || !['image/png','image/jpeg'].includes(evidence.content_type)) {
      throw new Error('Signature evidence identity mismatch');
    }
    const bytes = await download(client, 'execution-evidence', evidence.storage_path, evidence.content_sha256, evidence.content_length, 2*1024*1024);
    const signer: FinalisationSigner = { participantId: p.id, name: p.name, email: p.email, signedAt: p.signed_at,
      signatureBytes: bytes, signatureContentType: evidence.content_type, signatureSha256: evidence.content_sha256 };
    if (evidence.initials_storage_path) {
      if (evidence.initials_sha256 !== p.signature_data.initials_sha256 || !['image/png','image/jpeg'].includes(evidence.initials_content_type)) throw new Error('Initials evidence identity mismatch');
      signer.initials = { bytes: await download(client,'execution-evidence',evidence.initials_storage_path,evidence.initials_sha256,evidence.initials_content_length,2*1024*1024),
        contentType: evidence.initials_content_type, sha256: evidence.initials_sha256 };
    }
    signers.push(signer);
  }
  const original = await download(client,'execution-documents',pdf.storage_path,pdf.pdf_checksum,pdf.content_length,30*1024*1024);
  const bound: ExecutionFieldManifest = { executionId, documentVersionId, originalSha256: pdf.pdf_checksum, fields: manifest.fields };
  const signed = await assembleExecutedPdf({ originalPdf: original, originalSha256: pdf.pdf_checksum, executionId, documentVersionId, manifest: bound, signers });
  const certificate = await assembleExecutionCertificate({ executionId, documentVersionId, sourcePdfSha256: pdf.pdf_checksum,
    executedPdfSha256: signed.sha256, manifestSha256: manifest.manifest_sha256,
    signers: participants.map(p => ({ participantId:p.id, name:p.name, email:p.email, signedAt:p.signed_at, evidence:{ ...p.signature_data, ip_address:p.ip_address, user_agent:p.user_agent } })) });
  for (const [kind, artifact] of [['signed_pdf',signed],['execution_certificate',certificate]] as const) {
    const path = `${executionId}/${documentVersionId}/${kind}/${artifact.sha256}.pdf`;
    const { data: artifactId, error: stageError } = await client.rpc('stage_execution_final_artifact', {
      p_execution_id:executionId,p_document_version_id:documentVersionId,p_artifact_type:kind,
      p_storage_path:path,p_content_sha256:artifact.sha256,p_content_length:artifact.bytes.length,
    });
    if (stageError || typeof artifactId !== 'string' || !UUID.test(artifactId)) throw new Error('Final artifact registration requires recovery');
    const bucket = client.storage.from('execution-documents');
    // A concurrent/recovered attempt may already have created the immutable path.
    // Never trust an upload error; only successful byte read-back permits commit.
    await bucket.upload(path,artifact.bytes,{ contentType:'application/pdf',upsert:false,cacheControl:'0' });
    await download(client,'execution-documents',path,artifact.sha256,artifact.bytes.length,30*1024*1024);
    const { error: commitError } = await client.rpc('commit_execution_final_artifact',{p_artifact_id:artifactId});
    if (commitError) throw new Error('Final artifact commit requires recovery');
  }
  const { data: completed, error: completionError } = await client.rpc('complete_execution_finalisation',{
    p_execution_id:executionId,p_document_version_id:documentVersionId,
  });
  if (completionError || completed !== executionId) throw new Error('Finalisation completion requires recovery');
  return { executionId, documentVersionId, signedPdfSha256:signed.sha256, certificateSha256:certificate.sha256 };
}
