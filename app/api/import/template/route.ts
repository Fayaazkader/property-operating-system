import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('target');
  
  const templates: Record<string, { headers: string[], filename: string }> = {
    properties: {
      headers: ['name', 'address', 'city', 'state', 'postal_code', 'gla_sqft'],
      filename: 'properties_template.csv'
    },
    tenants: {
      headers: ['name', 'code', 'email', 'phone', 'company_type'],
      filename: 'tenants_template.csv'
    },
    leases: {
      headers: ['lease_number', 'property_name', 'tenant_name', 'unit', 'gla_sqft', 'base_rent', 'start_date', 'end_date', 'status'],
      filename: 'leases_template.csv'
    }
  };

  if (!target || !templates[target]) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  }

  const template = templates[target];
  const csvContent = template.headers.join(',') + '\n';
  
  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${template.filename}"`,
    },
  });
}