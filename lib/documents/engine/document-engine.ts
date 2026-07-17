// lib/documents/engine/document-engine.ts
// Document Engine — Builds renderer-agnostic document models

import { brandingService } from '../branding/branding-service';
import { buildInvoice } from '../templates/invoice';
import { buildStatement } from '../templates/statement';
import type { DocumentModel, DocumentMetadata, DocumentType } from '../types';

interface GenerateParams {
  entityId: string;
  documentType: DocumentType;
  tenantName: string;
  propertyName?: string;
  leaseRef?: string;
  headerMessage?: string;
  footerMessage?: string;
  depositHeld?: number;
  data: any;
}

export const documentEngine = {
  async generate(params: GenerateParams): Promise<DocumentModel> {
    const branding = await brandingService.getBranding(params.entityId);
    const companyInfo = await brandingService.getCompanyInfo(params.entityId);

    const metadata: DocumentMetadata = {
      document_type: params.documentType,
      document_number: `${params.documentType.toUpperCase()}-${Date.now()}`,
      issue_date: new Date().toISOString().split('T')[0],
      version: 1,
      status: 'draft',
      generated_at: new Date().toISOString(),
    };

    const company = {
      name: companyInfo.name,
      vat_number: companyInfo.vat_number,
      physical_address: companyInfo.physical_address,
      telephone: companyInfo.telephone,
      email: companyInfo.email,
    };

    const customer = {
      name: params.tenantName,
      property_name: params.propertyName,
      lease_ref: params.leaseRef,
    };

    const base = {
      header_message: params.headerMessage,
      footer_message: params.footerMessage,
      deposit_held: params.depositHeld,
    };

    switch (params.documentType) {
      case 'invoice':
        return buildInvoice(base, metadata, company, customer, branding, params.data);
      case 'statement':
        return buildStatement(base, metadata, company, customer, branding, params.data);
      default:
        throw new Error(`Unknown document type: ${params.documentType}`);
    }
  }
};
