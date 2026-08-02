// lib/signing/engine.ts
// Signing Engine — lease execution + document signing

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { generateLeaseSigningFields } from './lease-template';
import { generateSignatureCertificate } from './pdf-flattener';
import type { SigningField, SigningRequest } from './types';

export class SigningEngine {
  async createLeaseSigningRequest(
    entityId: string, leaseId: string, documentUrl: string,
    documentName: string, totalPages: number, createdBy: string,
    templateId?: string, templateVersion?: number
  ): Promise<SigningRequest> {
    const fields = generateLeaseSigningFields(totalPages, await (await import('./lease-template')).getLeaseTemplate(entityId).then(t => t.template));

    const { data, error } = await supabase.from('signature_requests').insert({
      entity_id: entityId, request_type: 'lease', lease_id: leaseId,
      document_name: documentName, document_url: documentUrl, fields,
      status: 'draft', created_by: createdBy, expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      template_id: templateId, template_version: templateVersion || 1,
    }).select('*').single();

    if (error) throw error;

    await publish('signing.request.created', {
      correlationId: crypto.randomUUID(), source: 'signing-engine', version: '1.0',
      payload: { requestId: data.id, leaseId, requestType: 'lease' },
    });

    return data as SigningRequest;
  }

  async updateField(requestId: string, fieldId: string, value: string): Promise<void> {
    const { data: request } = await supabase.from('signature_requests').select('fields').eq('id', requestId).single();
    if (!request) throw new Error('Request not found');

    const fields = (request.fields as SigningField[]).map(f => {
      if (f.id === fieldId) return { ...f, value };
      if (f.templateId === fieldId && f.isReplica) return { ...f, value };
      return f;
    });

    await supabase.from('signature_requests').update({ fields }).eq('id', requestId);

    await publish('signing.field.signed', {
      correlationId: crypto.randomUUID(), source: 'signing-engine', version: '1.0',
      payload: { requestId, fieldId },
    });
  }

  async moveField(requestId: string, fieldId: string, x: number, y: number, moveReplicas: boolean): Promise<void> {
    const { data: request } = await supabase.from('signature_requests').select('fields').eq('id', requestId).single();
    if (!request) throw new Error('Request not found');

    const fields = (request.fields as SigningField[]).map(f => {
      if (f.id === fieldId) return { ...f, x, y };
      if (moveReplicas && f.templateId === fieldId && f.isReplica) return { ...f, x, y };
      return f;
    });

    await supabase.from('signature_requests').update({ fields }).eq('id', requestId);
  }

  async completeSigning(
    requestId: string, signerName: string, signerEmail: string,
    executedPdfBytes?: ArrayBuffer
  ): Promise<void> {
    const { data: request } = await supabase.from('signature_requests').select('*').eq('id', requestId).single();
    if (!request) throw new Error('Request not found');

    // Generate certificate
    const certificate = generateSignatureCertificate(requestId, request.fields, signerName, signerEmail);

    // Compute SHA-256 of the executed PDF bytes (not metadata)
    let executionHash = '';
    if (executedPdfBytes) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', executedPdfBytes);
      executionHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Update signing request
    await supabase.from('signature_requests').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      certificate_id: certificate.certificate_id,
      execution_package_hash: executionHash || null,
    }).eq('id', requestId);

    // Store execution artifacts (metadata only — not duplicate of PDF)
    await supabase.from('execution_artifacts').insert([
      {
        entity_id: request.entity_id,
        artifact_type: 'execution_certificate',
        artifact_data: certificate,
      },
      {
        entity_id: request.entity_id,
        artifact_type: 'audit_trail',
        artifact_data: {
          request_id: requestId,
          signed_by: { name: signerName, email: signerEmail },
          signed_at: new Date().toISOString(),
          template_id: request.template_id,
          template_version: request.template_version,
        },
      },
      {
        entity_id: request.entity_id,
        artifact_type: 'verification_data',
        artifact_data: {
          execution_hash: executionHash,
          algorithm: 'SHA-256',
          request_id: requestId,
          document_id: request.lease_id || requestId,
          signed_at: new Date().toISOString(),
          provider: 'native',
          template_version: request.template_version || 1,
        },
      },
    ]);

    // Store executed PDF in documents (user-facing)
    await supabase.from('documents').insert({
      entity_id: request.entity_id,
      file_name: `executed-${request.document_name}`,
      file_url: request.document_url,
      mime_type: 'application/pdf',
      document_type: 'signed_lease',
      status: 'stored',
      related_entity_type: request.request_type === 'lease' ? 'lease' : 'document',
      related_entity_id: request.lease_id || requestId,
    });

    // Update lease status based on commencement date
    if (request.request_type === 'lease' && request.lease_id) {
      const { data: leaseData } = await supabase.from('leases')
        .select('lease_start_date').eq('id', request.lease_id).single();
      
      const startDate = leaseData?.lease_start_date ? new Date(leaseData.lease_start_date) : new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      
      const newStatus = startDate > today ? 'Pending Commencement' : 'Active';
      await supabase.from('leases').update({ lease_status: newStatus }).eq('id', request.lease_id);

      await publish('lease.execution.completed', {
        correlationId: crypto.randomUUID(), source: 'signing-engine', version: '1.0',
        payload: { requestId, leaseId: request.lease_id, entityId: request.entity_id, executionHash },
      });
    }

    await publish('signing.request.completed', {
      correlationId: crypto.randomUUID(), source: 'signing-engine', version: '1.0',
      payload: { requestId, requestType: request.request_type },
    });
  }

  async getRequest(requestId: string): Promise<SigningRequest | null> {
    const { data } = await supabase.from('signature_requests').select('*').eq('id', requestId).single();
    return data as SigningRequest || null;
  }
}

export const signingEngine = new SigningEngine();
