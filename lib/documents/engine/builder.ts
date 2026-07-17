// lib/documents/engine/builder.ts
// Assembles document model from business data

import type { DocumentModel, DocumentMetadata, DocumentSection } from '../types';

interface BuilderParams {
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
  private model: Partial<DocumentModel>;

  constructor(params: BuilderParams) {
    this.model = {
      ...params,
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
    this.model.sections!.push({ type, title, data });
    return this;
  }

  setTotals(totals: DocumentModel['totals']): this {
    this.model.totals = totals;
    return this;
  }

  build(): DocumentModel {
    return this.model as DocumentModel;
  }
}
