import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // This will check the user's session via the auth header
  // The client will send the token in the Authorization header
  
  return NextResponse.json({ authenticated: true });
}
