// lib/communications/signed-urls.ts
// Signed URLs for secure document delivery — expires after configured time

import { supabase } from '@/lib/supabase';

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
  expiresInSeconds: number = 3600
): Promise<string> {
  // Upload to private bucket
  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(path, fileData, {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // Return signed URL
  return createSignedUrl(bucket, path, expiresInSeconds);
}
