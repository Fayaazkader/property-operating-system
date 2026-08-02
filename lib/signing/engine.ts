// lib/signing/engine.ts
// Signing Engine — shared by Lease Execution and Document Signing Pro

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { generateLeaseSigningFields } from './lease-template';
import { generateSignatureCertificate } from './pdf-flattener';
import type { SigningField, SigningRequest } from './types';

export class SigningEngine {
  // Create a lease signing request with pre-placed fields
  async createLeaseSigningRequest(
    entityId: string,
    leaseId: string,
    documentUrl: string,
    documentName: string,
    totalPages: number,
    createdBy: string
  ): Promise<SigningRequest> {
    const fields = generateLeaseSigningFields(totalPages);

    const { data, error } = await supabase.from('signature_requests').insert({
      entity_id: entityId,
      request_type: 'lease',
      lease_id: leaseId,
      document_name: documentName,
      document_url: documentUrl,
      fields,
      status: 'draft',
      created_by: createdBy,
    }).select('*').single();

    if (error) throw error;

    await publish('signing.request.created', {
      correlationId: crypto.randomUUID(),
      source: 'signing-engine',
      version: '1.0',
      payload: { requestId: data.id, leaseId, requestType: 'lease' },
    });

    return data as SigningRequest;
  }

  // Update a field's value (signature applied)
  async updateField(requestId: string, fieldId: string, value: string): Promise<void> {
    const { data: request } = await supabase.from('signature_requests').select('fields').eq('id', requestId).single();
    if (!request) throw new Error('Request not found');

    const fields = (request.fields as SigningField[]).map(f => {
      if (f.id === fieldId) return { ...f, value };
      // Also update replicas if this is a template initial
      if (f.templateId === fieldId && f.isReplica) return { ...f, value };
      return f;
    });

    await supabase.from('signature_requests').update({ fields }).eq('id', requestId);

    await publish('signing.field.signed', {
      correlationId: crypto.randomUUID(),
      source: 'signing-engine',
      version: '1.0',
      payload: { requestId, fieldId },
    });
  }

  // Move a field (and optionally its replicas)
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

  // Complete the signing process
  async completeSigning(requestId: string, signerName: string, signerEmail: string): Promise<void> {
    const { data: request } = await supabase.from('signature_requests').select('*').eq('id', requestId).single();
    if (!request) throw new Error('Request not found');

    const certificate = generateSignatureCertificate(requestId, request.fields, signerName, signerEmail);

    await supabase.from('signature_requests').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      certificate,
    }).eq('id', requestId);

    if (request.request_type === 'lease' && request.lease_id) {
      // Update lease status to executed
      await supabase.from('leases').update({ lease_status: 'Executed' }).eq('id', request.lease_id);
      
      // Archive executed PDF
      await supabase.from('documents').insert({
        entity_id: request.entity_id,
        file_name: `executed-${request.document_name}`,
        file_url: request.document_url,
        mime_type: 'application/pdf',
        document_type: 'signed_lease',
        status: 'stored',
        related_entity_type: 'lease',
        related_entity_id: request.lease_id,
      });

      await publish('lease.fully_executed', {
        correlationId: crypto.randomUUID(),
        source: 'signing-engine',
        version: '1.0',
        payload: { requestId, leaseId: request.lease_id, entityId: request.entity_id },
      });
    }

    await publish('signing.request.completed', {
      correlationId: crypto.randomUUID(),
      source: 'signing-engine',
      version: '1.0',
      payload: { requestId, requestType: request.request_type },
    });
  }

  // Get signing request
  async getRequest(requestId: string): Promise<SigningRequest | null> {
    const { data } = await supabase.from('signature_requests').select('*').eq('id', requestId).single();
    return data as SigningRequest || null;
  }
}

export const signingEngine = new SigningEngine();
