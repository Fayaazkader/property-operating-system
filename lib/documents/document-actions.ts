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

export interface DocumentActionResult {
  success: boolean;
  message: string;
}

function printDocument(): void {
  window.print();
}

export async function handleDocumentAction(action: DocumentAction, ctx: DocumentActionContext): Promise<DocumentActionResult> {
  switch (action) {
    case 'download':
    case 'pdf': {
      if (!ctx.layout) return { success: false, message: 'No layout provided for PDF export' };
      const renderer = getRenderer('pdf');
      if (!renderer) return { success: false, message: 'PDF renderer not available' };
      const result = await renderer.render(ctx.layout);
      downloadBlob(result.blob, `${ctx.documentTitle}-${new Date().toISOString().split('T')[0]}.${result.extension}`);
      return { success: true, message: 'PDF downloaded' };
    }
    case 'email': {
      return { success: false, message: 'Email sending coming soon' };
    }
    case 'whatsapp': {
      return { success: false, message: 'WhatsApp sending coming soon' };
    }
    case 'print': {
      printDocument();
      return { success: true, message: 'Document sent to printer' };
    }
    case 'issue': {
      return { success: false, message: 'Document issuance coming soon' };
    }
    case 'regenerate': {
      return { success: false, message: 'Regeneration coming soon' };
    }
    case 'cancel': {
      return { success: false, message: 'Cancellation coming soon' };
    }
    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}
