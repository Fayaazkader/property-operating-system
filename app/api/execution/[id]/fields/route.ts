import { readExecutionJson } from '@/lib/execution/server/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { executionFieldGeometry, executionDateFontSize } from '@/lib/execution/pdf-field-geometry';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { requireExecutionAuthority, ExecutionAccessError } from '@/lib/execution/server/authority';
import { parseExecutionFields } from '@/lib/execution/field-manifest';
import { PERMISSIONS } from '@/lib/rbac/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

async function context(request: NextRequest, id: string, entityId: unknown) {
  if (!UUID.test(id) || typeof entityId !== 'string' || !UUID.test(entityId)) {
    throw new Error('Invalid execution reference');
  }
  const authority = await requireExecutionAuthority(request.headers.get('authorization'), entityId, PERMISSIONS.LEASING.EXECUTION_SEND);
  const client = authority.serviceClient;
  const { data: execution, error: executionError } = await client.from('executions')
    .select('id, source_id, source_type, version, sha_hash, deleted_at, status').eq('id', id).maybeSingle();
  const { data: opportunity, error: opportunityError } = await client.from('leasing_opportunities')
    .select('id').eq('id', execution?.source_id ?? id).eq('entity_id', entityId).maybeSingle();
  if (executionError || opportunityError || !execution || !opportunity || execution.deleted_at || execution.source_type !== 'leasing_opportunity') {
    throw new ExecutionAccessError(403, 'Execution unavailable');
  }
  const { data: version, error: versionError } = await client.from('execution_document_versions')
    .select('id, document_id, document_checksum').eq('execution_id', id).eq('entity_id', entityId)
    .eq('version', execution.version).eq('status', 'active').maybeSingle();
  if (version && !['executed','activated'].includes(execution.status) && version.document_checksum !== execution.sha_hash) {
    throw new Error('Frozen source mismatch');
  }
  const { data: pdf, error: pdfError } = await client.from('execution_signing_documents')
    .select('id, pdf_checksum, page_count, content_length, storage_path, bucket_id, committed_at, source_document_id, source_checksum')
    .eq('execution_id', id).eq('entity_id', entityId).eq('document_version_id', version?.id ?? id).eq('status', 'committed').maybeSingle();
  if (versionError || pdfError || !version || !pdf || !pdf.committed_at || pdf.bucket_id !== 'execution-documents' ||
      pdf.source_document_id !== version.document_id || pdf.source_checksum !== version.document_checksum) {
    throw new Error('Committed signing PDF unavailable');
  }
  return { ...authority, client, execution, version, pdf };
}

export async function GET(request: NextRequest, route: Context) {
  try {
    const { id } = await route.params;
    const data = await context(request, id, request.nextUrl.searchParams.get('entityId'));
    const { client, pdf, version } = data;
    if (request.nextUrl.searchParams.get('pdf') === 'true') {
      if (!Number.isSafeInteger(pdf.content_length) || pdf.content_length < 1 || pdf.content_length > 30 * 1024 * 1024) throw new Error('PDF size invalid');
      const { data: file, error } = await client.storage.from(pdf.bucket_id).download(pdf.storage_path);
      if (error || !file || file.size !== pdf.content_length) throw new Error('PDF unavailable');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== pdf.pdf_checksum) throw new Error('PDF checksum mismatch');
      const document = await PDFDocument.load(bytes, { ignoreEncryption: false });
      if (document.getPageCount() !== pdf.page_count) throw new Error('PDF page count mismatch');
      return new NextResponse(bytes.buffer, { headers: { ...headers, 'Content-Type': 'application/pdf', 'X-Content-Type-Options': 'nosniff' } });
    }
    const { data: manifest, error: manifestError } = await client.from('execution_field_manifests')
      .select('fields, revision, status, manifest_sha256').eq('execution_id', id).eq('entity_id', data.entityId)
      .eq('document_version_id', version.id).maybeSingle();
    if (manifestError) throw new Error('Manifest unavailable');
    return NextResponse.json({ documentVersionId: version.id, pdfSha256: pdf.pdf_checksum, pageCount: pdf.page_count,
      fields: manifest?.fields ?? [], revision: manifest?.revision ?? 0, status: manifest?.status ?? 'draft',
      manifestSha256: manifest?.manifest_sha256 ?? null }, { headers });
  } catch (error) {
    return NextResponse.json({ error: 'Signing field preparation unavailable.' }, { status: error instanceof ExecutionAccessError ? error.status : 409, headers });
  }
}

export async function POST(request: NextRequest, route: Context) {
  try {
    const body = await readExecutionJson(request,200000);
    if (!body || !Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision as number) < 0) throw new Error('Invalid revision');
    const { id } = await route.params;
    const data = await context(request, id, body.entityId);
    if (body.documentVersionId !== data.version.id || body.pdfSha256 !== data.pdf.pdf_checksum) throw new Error('Stale document');
    const { data: participants, error } = await data.client.from('execution_participants').select('id').eq('execution_id', id);
    if (error || !participants) throw new Error('Participants unavailable');
    const fields = parseExecutionFields(body.fields, data.pdf.page_count, participants.map(p => p.id));
    // Reject unusable actual page geometry before a placement can be frozen.
    const { data: file, error: storageError } = await data.client.storage.from('execution-documents').download(data.pdf.storage_path);
    if (storageError || !file || file.size !== data.pdf.content_length || file.size > 30*1024*1024) throw new Error('Signing PDF unavailable');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== data.pdf.pdf_checksum) throw new Error('PDF checksum mismatch');
    const document = await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
    if (document.getPageCount() !== data.pdf.page_count) throw new Error('PDF page count mismatch');
    const font = await document.embedFont(StandardFonts.Helvetica);
    for (const field of fields) {
      const geometry = executionFieldGeometry(document.getPage(field.page-1),field);
      if (field.type === 'date') executionDateFontSize(font,'2000-01-01',geometry.width,geometry.height);
    }
    const { data: result, error: saveError } = await data.client.rpc('save_execution_field_manifest', {
      p_entity_id: data.entityId, p_execution_id: id, p_actor_id: data.actorId,
      p_document_version_id: data.version.id, p_pdf_sha256: data.pdf.pdf_checksum,
      p_fields: fields, p_expected_revision: body.expectedRevision,
    });
    if (saveError) throw new Error('Manifest conflict');
    const saved = Array.isArray(result) ? result[0] : result;
    if (!saved || !Number.isSafeInteger(saved.revision) || !/^[a-f0-9]{64}$/.test(saved.manifest_sha256)) throw new Error('Reconciliation required');
    return NextResponse.json({ revision: saved.revision, manifestSha256: saved.manifest_sha256 }, { headers });
  } catch (error) {
    return NextResponse.json({ error: 'Signing fields could not be saved. Reload to check the current document and revision.' },
      { status: error instanceof ExecutionAccessError ? error.status : 409, headers });
  }
}
