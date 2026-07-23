import type { OCRProvider, OCRResult, AzureAnalyzeResult } from './types';

export class AzureOCRAdapter implements OCRProvider {
  name = 'azure';
  private endpoint: string;
  private apiKey: string;

  constructor() {
    this.endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || process.env.AZURE_FORM_RECOGNIZER_ENDPOINT || '';
    this.apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY || process.env.AZURE_FORM_RECOGNIZER_KEY || '';
  }

  async extractText(fileBuffer: Uint8Array, mimeType: string): Promise<OCRResult> {
    if (!this.endpoint || !this.apiKey) {
      return { text: '', confidence: 0, provider: 'azure', processedAt: new Date().toISOString() };
    }

    const url = `${this.endpoint}formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2023-07-31`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': mimeType, 'Ocp-Apim-Subscription-Key': this.apiKey },
      body: fileBuffer,
    });

    if (!response.ok) throw new Error(`Azure OCR failed: ${response.status}`);

    const operationLocation = response.headers.get('operation-location');
    if (!operationLocation) throw new Error('No operation location');

    let result: AzureAnalyzeResult;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollRes = await fetch(operationLocation, { headers: { 'Ocp-Apim-Subscription-Key': this.apiKey } });
      result = await pollRes.json();
      if (result.status === 'succeeded') break;
      if (result.status === 'failed' || result.status === 'canceled') {
        throw new Error(`Azure OCR ${result.status}: ${result.error?.message || 'Unknown error'}`);
      }
    }

    return this.buildResult(result!);
  }

  private buildResult(result: AzureAnalyzeResult): OCRResult {
    const ar = result.analyzeResult;
    const paragraphs = ar?.paragraphs || [];
    const text = paragraphs.map(p => p.content).join('\n');
    const totalConf = paragraphs.reduce((s, p) => s + (p.confidence || 0), 0);
    const confidence = paragraphs.length > 0 ? Math.round((totalConf / paragraphs.length) * 100) / 100 : 0;

    return {
      text,
      confidence,
      provider: 'azure',
      processedAt: new Date().toISOString(),
      raw: result,
      pages: (ar?.pages || []).map(p => ({
        pageNumber: p.pageNumber,
        text: (p.lines || []).map(l => l.content).join(' '),
        confidence: p.confidence || 0,
      })),
      keyValuePairs: (ar?.keyValuePairs || []).map(kv => ({
        key: kv.key?.content || '',
        value: kv.value?.content || '',
        confidence: kv.confidence || 0,
      })),
      tables: (ar?.tables || []).map(t => ({
        rowCount: t.rowCount,
        columnCount: t.columnCount,
        cells: (t.cells || []).map(c => ({
          rowIndex: c.rowIndex,
          columnIndex: c.columnIndex,
          content: c.content,
          confidence: c.confidence || 0,
        })),
      })),
    };
  }
}
