import { NextResponse } from 'next/server';
import { extractRulesForAllLeases } from '@/lib/revenue/rule-extractor';

export async function POST() {
  const result = await extractRulesForAllLeases();
  return NextResponse.json(result);
}
