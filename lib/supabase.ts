import { createClient } from "@supabase/supabase-js";

// Use service role key for full access (development only)
// Swap back to anon key before production
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);