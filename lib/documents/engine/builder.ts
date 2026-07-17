// lib/documents/engine/builder.ts
// Assembles document model from business data

import type { DocumentModel, DocumentMetadata, DocumentSection } from '../types';

export interface BuilderParams {
  metadata: DocumentMetadata;
  company: DocumentModel['company'];
  customer: DocumentModel['customer'];
  branding: DocumentModel['branding'];
  banking?: DocumentModel['banking'];
  header_message?: string;
  footer_message?: string;
  deposit_held?: number;
  payment_terms?: string;
}

export class DocumentBuilder {
  private model: DocumentModel;

  constructor(params: BuilderParams) {
    this.model = {
      metadata: params.metadata,
      company: params.company,
      customer: params.customer,
      branding: params.branding,
      banking: params.banking,
      header_message: params.header_message,
      footer_message: params.footer_message,
      deposit_held: params.deposit_held,
      payment_terms: params.payment_terms,
      sections: [],
      totals: {
        subtotal: 0,
        vat_total: 0,
        total: 0,
        payments_received: 0,
        credits_applied: 0,
        balance_due: 0,
      },
    };
  }

  addSection(type: string, title: string | undefined, data: any): this {
    this.model.sections.push({ type, title, data });
    return this;
  }

  setTotals(totals: DocumentModel['totals']): this {
    this.model.totals = totals;
    return this;
  }

  build(): DocumentModel {
    return this.model;
  }
}
