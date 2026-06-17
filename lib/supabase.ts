import { createClient } from "@supabase/supabase-js";

// These are injected at build time — work everywhere
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Default client — uses anon key (works in browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-only client — uses service role key
export const getServiceSupabase = () => {
  if (typeof window === 'undefined') {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
};
