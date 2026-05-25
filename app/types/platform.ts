export type Company = {
  id: string;
  name: string;
  tier: "starter" | "portfolio" | "commercial" | "enterprise";
};

export type Portfolio = {
  id: string;
  companyId: string;
  name: string;
  region: string;
};

export type Property = {
  id: string;
  portfolioId: string;
  name: string;
  occupancy: number;
  riskLevel: "low" | "moderate" | "high";
};

export type Lease = {
  id: string;
  propertyId: string;
  tenant: string;
  monthlyRental: number;
  expiryDate: string;
  status: "active" | "renewal" | "expired";
};