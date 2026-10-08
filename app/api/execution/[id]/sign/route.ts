import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Signing temporarily unavailable while secure verification is implemented.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
