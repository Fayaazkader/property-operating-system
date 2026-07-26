export interface Property {
  id: string;
  property_code?: string;
  property_name: string;
  property_type?: string;
  property_status?: string;
  entity_id: string;
  address_line_1?: string;
  city?: string;
  province?: string;
  total_gla_sqm?: number;
  number_of_units?: number;
  owner_entity_id?: string;
  managing_entity_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyData {
  property_name: string;
  property_code?: string;
  property_type?: string;
  entity_id: string;
  address_line_1?: string;
  address_line_2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  country?: string;
  postal_code?: string;
  total_gla_sqm?: number;
  number_of_units?: number;
  owner_entity_id?: string;
  managing_entity_id?: string;
}
