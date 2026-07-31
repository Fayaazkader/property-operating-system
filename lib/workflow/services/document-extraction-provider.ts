// lib/workflow/services/document-extraction-provider.ts
// Abstracted OCR provider — mock today, pluggable for Azure/Google/AWS

export interface ExtractionResult {
  fields: Record<string, { value: string; confidence: number }>;
  exceptions: Array<{ field: string; message: string; severity: 'warning' | 'error' }>;
}

export interface DocumentExtractionProvider {
  extract(fileBuffer: Buffer, fileName: string): Promise<ExtractionResult>;
}

export class MockExtractionProvider implements DocumentExtractionProvider {
  async extract(_fileBuffer: Buffer, _fileName: string): Promise<ExtractionResult> {
    await new Promise(r => setTimeout(r, 1500));

    return {
      fields: {
        tenant_name: { value: 'TechCorp Solutions', confidence: 95 },
        company_registration: { value: '2020/123456/07', confidence: 90 },
        vat_number: { value: '4560123456', confidence: 88 },
        email: { value: 'accounts@techcorp.co.za', confidence: 85 },
        phone: { value: '0115550101', confidence: 82 },
        monthly_rental: { value: '52000', confidence: 97 },
        lease_start_date: { value: '2026-01-01', confidence: 96 },
        lease_end_date: { value: '2028-12-31', confidence: 94 },
        escalation_percent: { value: '8', confidence: 91 },
        deposit_amount: { value: '52000', confidence: 93 },
        parking_bays: { value: '5', confidence: 72 },
        parking_rate: { value: '850', confidence: 78 },
      },
      exceptions: [
        { field: 'parking_bays', message: 'Parking bays — low confidence (72%)', severity: 'warning' },
        { field: 'parking_rate', message: 'Parking rate — low confidence (78%)', severity: 'warning' },
      ],
    };
  }
}

export const documentExtractionProvider: DocumentExtractionProvider = new MockExtractionProvider();
