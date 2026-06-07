export type AllocationCategory = {
  id: string;

  code: string;

  name: string;

  description?: string;

  glAccountCode?: string;

  createdByRole:
    | "admin"
    | "portfolio_manager";

  active: boolean;
};
export type SplitAllocation = {
  id: string;

  category: string;

  amount: number;

  percentage?: number;

  glAccountCode?: string;
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  vatTreatment?: "vat-inclusive" | "vat-exclusive" | "no-vat";
  vatAmount?: number;
  notes?: string;

};
export type AllocationInput = {
  category: string;

  amount: number;
};
export type AllocationRule = {
  id: string;

  tenantName?: string;

  allocationCategory:
    string;

  percentage: number;

  autoApply: boolean;
};
export type AllocationStatus =
  | "unallocated"
  | "partially_allocated"
  | "fully_allocated"
  | "suspense";