/**
 * Browser Supabase client compatibility export.
 *
 * Canonical browser authentication is owned by lib/supabase/client.ts.
 * Keep this module as a compatibility surface for existing imports so the
 * application cannot create a second browser client with independent auth
 * storage/session state.
 */
export { supabase } from './supabase/client';
