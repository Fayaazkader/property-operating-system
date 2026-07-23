// lib/reporting/types.ts

export interface ReportScope {
  portfolioId?: string;
  entityId?: string;
  propertyId?: string;
  buildingId?: string;
  leaseId?: string;
  tenantId?: string;
  supplierId?: string;
  periodId?: string;
  asAtDate?: string;
  fromDate?: string;
  toDate?: string;
  regionId?: string;
}

export interface ReportData {
  metadata: { reportId: string; title: string; generatedAt: string; scope: ReportScope };
  headers: string[];
  rows: string[][];
  totals?: string[];
  summary?: Record<string, string>;
}
