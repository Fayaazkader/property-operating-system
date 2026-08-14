// lib/communications/signed-urls.ts
// Signed URLs for secure document delivery — expires after configured time

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function createSignedUrl(bucket: string, path: string, expiresInSeconds: number = 3600): Promise<string> {
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
  return data.signedUrl;
}

export async function uploadAndGetSignedUrl(
  bucket: string,
  path: string,
  fileData: Uint8Array,
  contentType: string = 'application/pdf',
  expiresInSeconds: number = 3600,
  db: SupabaseClient = supabase
): Promise<string> {
  const { error: uploadError } = await db
    .storage
    .from(bucket)
    .upload(path, fileData, { contentType, upsert: true, cacheControl: '3600' });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data, error: signError } = await db
    .storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (signError || !data?.signedUrl) throw new Error(`Failed to create signed URL: ${signError?.message || 'unknown'}`);
  return data.signedUrl;
}
