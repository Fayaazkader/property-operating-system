// lib/documents/document-actions.ts

import { getRenderer } from '@/lib/reporting/renderers/factory';
import { downloadBlob } from '@/lib/reporting/renderers/download';
import type { ReportLayout } from '@/lib/reporting/layout/engine';

export type DocumentAction = 'download' | 'pdf' | 'email' | 'whatsapp' | 'print' | 'issue' | 'cancel' | 'regenerate';

export interface DocumentActionContext {
  documentTitle: string;
  tenantId?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  layout?: ReportLayout;
}

export async function handleDocumentAction(action: DocumentAction, ctx: DocumentActionContext): Promise<void> {
  switch (action) {
    case 'download':
    case 'pdf': {
      if (!ctx.layout) throw new Error('No layout provided for PDF export');
      const renderer = getRenderer('pdf');
      if (!renderer) throw new Error('PDF renderer not available');
      const result = await renderer.render(ctx.layout);
      downloadBlob(result.blob, `${ctx.documentTitle}-${new Date().toISOString().split('T')[0]}.${result.extension}`);
      break;
    }
    case 'email': {
      throw new Error('Email sending not yet implemented — pending communication service integration');
    }
    case 'whatsapp': {
      throw new Error('WhatsApp sending not yet implemented — pending communication service integration');
    }
    case 'print': {
      window.print();
      break;
    }
    case 'issue': {
      throw new Error('Document issuance not yet implemented');
    }
    case 'regenerate': {
      throw new Error('Document regeneration not yet implemented');
    }
    case 'cancel': {
      throw new Error('Document cancellation not yet implemented');
    }
    default:
      throw new Error(`Unknown document action: ${action}`);
  }
}
