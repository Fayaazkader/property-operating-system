// lib/platform/documents/engine.ts
// Document Intelligence Platform — Registry, Classification, OCR, Extraction, Lifecycle, Relationships

import { supabase } from '@/lib/supabase';
import { publish } from '../events/event-bus';
import { logger } from '../events/logger.service';
import { classificationEngine } from './classification-engine';
import { getOCRAdapter } from './ocr';
import type {
  Document, DocumentType, DocumentStatus, DocumentSource,
  ExtractionRule, ExtractedFields, DocumentResult, ProcessDocumentParams,
  DocumentRelationship, DocumentLifecycleEvent, DocumentVersion,
} from './types';

const LIFECYCLE_STAGES: DocumentStatus[] = [
  'received', 'virus_scanning', 'stored', 'classifying',
  'classified', 'ocr_processing', 'extracting',
  'validating', 'review', 'approved', 'archived',
];

export class DocumentEngine {
  // ============================================================
  // DOCUMENT INTAKE
  // ============================================================

  async processDocument(params: ProcessDocumentParams): Promise<DocumentResult> {
    const storageKey = `documents/${params.entityId}/${Date.now()}-${params.fileName}`;

    // Stage 1: Received
    const doc = await this.createDocument(params, storageKey);
    await this.transitionStage(doc, 'received');

    // Stage 2: Virus scanning (placeholder)
    await this.transitionStage(doc, 'virus_scanning');
    await this.transitionStage(doc, 'stored');

    // Stage 3: Classification
    await this.transitionStage(doc, 'classifying');
    const classification = await classificationEngine.classify(params.entityId, params.fileName, params.mimeType);
    await this.updateDocument(doc.id, {
      document_type: classification.documentType,
      classification_confidence: classification.confidence,
      classified_by: classification.classifiedBy,
      status: 'classified',
    });
    await this.transitionStage(doc, 'classified');

    // Stage 4: OCR
    await this.transitionStage(doc, 'ocr_processing');
    if (params.fileBuffer) {
      const ocrAdapter = getOCRAdapter('none');
      const ocrResult = await ocrAdapter.extractText(params.fileBuffer, params.mimeType);
      await this.updateDocument(doc.id, {
        ocr_provider: ocrResult.provider as any,
        ocr_text: ocrResult.text,
        ocr_confidence: ocrResult.confidence,
      });
    }

    // Stage 5: Extraction
    await this.transitionStage(doc, 'extracting');
    const extractedFields = await this.extractFields(classification.documentType, params.entityId, params.metadata, doc.ocr_text);
    await this.updateDocument(doc.id, {
      extracted_fields: extractedFields,
      extraction_confidence: extractedFields.confidence / 100,
      status: 'validating',
    });

    // Stage 6: Validation
    await this.transitionStage(doc, 'validating');
    const requiresReview = extractedFields.requiresHumanReview || classification.confidence < 0.70;
    await this.updateDocument(doc.id, {
      requires_review: requiresReview,
      status: requiresReview ? 'review' : 'approved',
    });

    if (requiresReview) {
      await this.transitionStage(doc, 'review');
    } else {
      await this.transitionStage(doc, 'approved');
    }

    // Relationships
    if (params.relatedEntities) {
      for (const rel of params.relatedEntities) {
        await this.addRelationship(doc.id, rel.type, rel.id);
      }
    }

    // Get final document
    const finalDoc = await this.getDocument(doc.id);

    // Publish
    await publish('document.processed', {
      correlationId: crypto.randomUUID(),
      source: 'document-engine',
      version: '1.0',
      payload: { document: finalDoc, extractedFields },
    });

    // Route workflow
    const workflowId = await this.routeToWorkflow(finalDoc!, extractedFields);

    return {
      document: finalDoc!,
      documentType: classification.documentType,
      extractedFields,
      workflowId,
      message: requiresReview
        ? `${classification.documentType.replace(/_/g, ' ')} received. Review required.`
        : `${classification.documentType.replace(/_/g, ' ')} processed automatically.`,
    };
  }

  // ============================================================
  // VERSIONING
  // ============================================================

  async addVersion(parentDocumentId: string, params: ProcessDocumentParams): Promise<DocumentResult> {
    const parent = await this.getDocument(parentDocumentId);
    if (!parent) throw new Error('Parent document not found');

    // Mark parent as not latest
    await supabase.from('documents').update({ is_latest_version: false }).eq('id', parentDocumentId);

    // Create new version
    const versionNumber = parent.version_number + 1;
    const storageKey = `documents/${params.entityId}/v${versionNumber}-${params.fileName}`;

    const result = await this.processDocument(params);

    await this.updateDocument(result.document.id, {
      parent_document_id: parentDocumentId,
      version_number: versionNumber,
      is_latest_version: true,
    });

    await publish('document.version.created', {
      correlationId: crypto.randomUUID(),
      source: 'document-engine',
      version: '1.0',
      payload: { parentId: parentDocumentId, newVersionId: result.document.id, versionNumber },
    });

    return result;
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion | null> {
    const doc = await this.getDocument(documentId);
    if (!doc) return null;

    const parentId = doc.parent_document_id || doc.id;
    const { data: versions } = await supabase
      .from('documents')
      .select('*')
      .or(`id.eq.${parentId},parent_document_id.eq.${parentId}`)
      .order('version_number', { ascending: true });

    return {
      document: (versions || []).find(v => v.id === parentId) as Document,
      versions: (versions || []).filter(v => v.id !== parentId) as Document[],
    };
  }

  // ============================================================
  // RELATIONSHIPS
  // ============================================================

  async addRelationship(documentId: string, entityType: string, entityId: string, relationshipType: string = 'attached_to'): Promise<void> {
    await supabase.from('document_relationships').upsert({
      document_id: documentId,
      related_entity_type: entityType,
      related_entity_id: entityId,
      relationship_type: relationshipType,
    }, { onConflict: 'document_id,related_entity_type,related_entity_id' });
  }

  async getRelatedDocuments(entityType: string, entityId: string): Promise<Document[]> {
    const { data: rels } = await supabase
      .from('document_relationships')
      .select('document_id')
      .eq('related_entity_type', entityType)
      .eq('related_entity_id', entityId);

    if (!rels?.length) return [];

    const ids = rels.map(r => r.document_id);
    const { data } = await supabase.from('documents').select('*').in('id', ids).order('created_at', { ascending: false });
    return (data || []) as Document[];
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  private async transitionStage(document: Document, stage: DocumentStatus): Promise<void> {
    const fromStatus = document.status;
    await this.updateDocument(document.id, { status: stage });

    await supabase.from('document_lifecycle_events').insert({
      document_id: document.id,
      entity_id: document.entity_id,
      stage,
      from_status: fromStatus,
      to_status: stage,
    });

    await publish('document.lifecycle.changed', {
      correlationId: crypto.randomUUID(),
      source: 'document-engine',
      version: '1.0',
      payload: { documentId: document.id, stage, fromStatus, toStatus: stage },
    });
  }

  // ============================================================
  // REVIEW
  // ============================================================

  async reviewDocument(id: string, reviewerId: string, approved: boolean, corrections?: Record<string, any>): Promise<void> {
    const updates: Record<string, any> = {
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      status: approved ? 'approved' : 'rejected',
    };
    if (corrections) updates.extracted_fields = corrections;

       await supabase.from('documents').update(updates).eq('id', id);

    const reviewDoc = await this.getDocument(id);
    if (reviewDoc) {
      await this.transitionStage(reviewDoc, approved ? 'approved' : 'rejected');
    }

    await publish('document.reviewed', {
      correlationId: crypto.randomUUID(),
      source: 'document-engine',
      version: '1.0',
      payload: { documentId: id, approved, reviewerId },
    });
  }

  async archiveDocument(id: string): Promise<void> {
    await this.updateDocument(id, { status: 'archived' });
    const doc = await this.getDocument(id);
    if (doc) await this.transitionStage(doc, 'archived');
  }

  // ============================================================
  // QUERIES
  // ============================================================

  async getDocument(id: string): Promise<Document | null> {
    const { data } = await supabase.from('documents').select('*').eq('id', id).single();
    return data as Document || null;
  }

  async getDocuments(entityId: string, filters?: { type?: DocumentType; status?: DocumentStatus }): Promise<Document[]> {
    let query = supabase.from('documents').select('*').eq('entity_id', entityId).order('created_at', { ascending: false });
    if (filters?.type) query = query.eq('document_type', filters.type);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data } = await query.limit(50);
    return (data || []) as Document[];
  }

  async getDocumentsNeedingReview(entityId: string): Promise<Document[]> {
    const { data } = await supabase.from('documents').select('*').eq('entity_id', entityId).eq('status', 'review').order('created_at', { ascending: true });
    return (data || []) as Document[];
  }

  async getLifecycle(documentId: string): Promise<DocumentLifecycleEvent[]> {
    const { data } = await supabase.from('document_lifecycle_events').select('*').eq('document_id', documentId).order('created_at', { ascending: true });
    return (data || []) as DocumentLifecycleEvent[];
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async createDocument(params: ProcessDocumentParams, storageKey: string): Promise<Document> {
    const { data, error } = await supabase.from('documents').insert({
      entity_id: params.entityId,
      file_name: params.fileName,
      mime_type: params.mimeType,
      storage_provider: 'supabase',
      storage_bucket: 'documents',
      storage_key: storageKey,
      storage_version: 'v1',
      status: 'received',
      source: params.source || 'upload',
      tags: [],
      uploaded_by: params.metadata?.uploaded_by,
    }).select('*').single();

    if (error) throw error;
    return data as Document;
  }

  private async updateDocument(id: string, updates: Record<string, any>): Promise<void> {
    await supabase.from('documents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  }

  private async extractFields(
    documentType: DocumentType,
    entityId: string,
    metadata?: Record<string, any>,
    ocrText?: string
  ): Promise<ExtractedFields> {
    const { data: rules } = await supabase
      .from('document_extraction_rules')
      .select('*')
      .eq('entity_id', entityId)
      .eq('document_type', documentType)
      .eq('is_active', true)
      .order('priority');

    const extracted: Record<string, any> = {};
    const missingFields: string[] = [];
    let confidence = 85;

    const sourceData = metadata || {};

    for (const rule of (rules || []) as ExtractionRule[]) {
      const value = sourceData[rule.field_name];
      if (value) {
        extracted[rule.field_name] = value;
        confidence = Math.min(confidence + 3, 98);
      } else if (rule.required) {
        missingFields.push(rule.field_label);
        confidence = Math.max(confidence - 15, 40);
      }
    }

    if (!metadata && !ocrText) {
      for (const rule of (rules || []) as ExtractionRule[]) {
        if (rule.required) missingFields.push(rule.field_label);
      }
      confidence = 50;
    }

    return { ...extracted, confidence, requiresHumanReview: missingFields.length > 0, missingFields };
  }

  private async routeToWorkflow(document: Document, fields: ExtractedFields): Promise<string | undefined> {
    switch (document.document_type) {
      case 'lease_application':
        await publish('lease.application.received', { correlationId: crypto.randomUUID(), source: 'document-engine', version: '1.0', payload: { document, fields } });
        return 'lease_intake';
      case 'signed_lease':
        await publish('lease.signed.received', { correlationId: crypto.randomUUID(), source: 'document-engine', version: '1.0', payload: { document, fields } });
        return 'lease_activation';
      case 'invoice':
        await publish('supplier.invoice.received', { correlationId: crypto.randomUUID(), source: 'document-engine', version: '1.0', payload: { document, fields } });
        return 'invoice_intake';
      case 'id_document':
        await publish('tenant.document.received', { correlationId: crypto.randomUUID(), source: 'document-engine', version: '1.0', payload: { document, fields } });
        return 'tenant_verification';
      default:
        return undefined;
    }
  }
}

export const documentEngine = new DocumentEngine();
