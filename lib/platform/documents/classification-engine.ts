// lib/platform/documents/classification-engine.ts
// Classification Engine — Rules-based + AI fallback

import { supabase } from '@/lib/supabase';
import type { DocumentType, ClassificationRule, ClassifierType } from './types';

interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  classifiedBy: ClassifierType;
}

export class ClassificationEngine {
  async classify(entityId: string, fileName: string, mimeType: string): Promise<ClassificationResult> {
    // Try rules first
    const rulesResult = await this.classifyByRules(entityId, fileName);
    if (rulesResult && rulesResult.confidence >= 0.80) {
      return rulesResult;
    }

    // Fallback to heuristic
    return this.classifyHeuristic(fileName, mimeType);
  }

  private async classifyByRules(entityId: string, fileName: string): Promise<ClassificationResult | null> {
    const { data: rules } = await supabase
      .from('document_classification_rules')
      .select('*')
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (!rules?.length) return null;

    const name = fileName.toLowerCase();
    let bestMatch: ClassificationRule | null = null;

    for (const rule of rules as ClassificationRule[]) {
      if (rule.pattern_type === 'filename_contains' && name.includes(rule.pattern)) {
        if (!bestMatch || rule.priority > bestMatch.priority) {
          bestMatch = rule;
        }
      }
    }

    if (bestMatch) {
      return {
        documentType: bestMatch.document_type,
        confidence: bestMatch.confidence,
        classifiedBy: 'rules',
      };
    }

    return null;
  }

  private classifyHeuristic(fileName: string, mimeType: string): ClassificationResult {
    const name = fileName.toLowerCase();
    const type = mimeType.toLowerCase();

    if (name.includes('lease') && name.includes('application')) return { documentType: 'lease_application', confidence: 0.75, classifiedBy: 'rules' };
    if (name.includes('lease') && (name.includes('signed') || name.includes('executed'))) return { documentType: 'signed_lease', confidence: 0.85, classifiedBy: 'rules' };
    if (name.includes('invoice') || name.includes('bill')) return { documentType: 'invoice', confidence: 0.70, classifiedBy: 'rules' };
    if (name.includes('po') || name.includes('purchase')) return { documentType: 'purchase_order', confidence: 0.70, classifiedBy: 'rules' };
    if (name.includes('bank') || name.includes('statement')) return { documentType: 'bank_statement', confidence: 0.65, classifiedBy: 'rules' };
    if (name.includes('meter') || name.includes('reading')) return { documentType: 'meter_reading', confidence: 0.70, classifiedBy: 'rules' };
    if (name.includes('inspection') || name.includes('report')) return { documentType: 'inspection_report', confidence: 0.65, classifiedBy: 'rules' };
    if (name.includes('quote') || name.includes('estimate')) return { documentType: 'quote', confidence: 0.60, classifiedBy: 'rules' };
    if (name.includes('id') || name.includes('passport')) return { documentType: 'id_document', confidence: 0.55, classifiedBy: 'rules' };
    if (type.includes('image')) return { documentType: 'maintenance_photo', confidence: 0.50, classifiedBy: 'rules' };

    return { documentType: 'unknown', confidence: 0.30, classifiedBy: 'rules' };
  }
}

export const classificationEngine = new ClassificationEngine();
