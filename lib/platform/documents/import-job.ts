// lib/platform/documents/import-job.ts
import { supabase } from '@/lib/supabase';

export type ImportJobStatus = 'uploaded' | 'ocr_processing' | 'classifying' | 'extracting' | 'validating' | 'pending_review' | 'accepted' | 'rejected' | 'failed';

export interface ImportJob {
  id: string;
  entityId: string;
  fileName: string;
  fileUrl: string;
  status: ImportJobStatus;
  documentClass?: string;
  ocrConfidence?: number;
  extractionConfidence?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export async function createImportJob(entityId: string, fileName: string, fileUrl: string): Promise<string> {
  const id = crypto.randomUUID();
  await supabase.from('document_import_jobs').insert({
    id, entity_id: entityId, file_name: fileName, file_url: fileUrl,
    status: 'uploaded', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  return id;
}

export async function updateImportJobStatus(id: string, status: ImportJobStatus, details?: Partial<ImportJob>): Promise<void> {
  await supabase.from('document_import_jobs').update({
    status, ...details, updated_at: new Date().toISOString(),
  }).eq('id', id);
}

export async function getImportJobs(entityId: string): Promise<ImportJob[]> {
  const { data } = await supabase.from('document_import_jobs').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(20);
  return (data || []) as ImportJob[];
}
