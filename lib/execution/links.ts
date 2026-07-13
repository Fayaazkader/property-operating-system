// lib/execution/links.ts
// Signing link generation

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateSigningLink(
  participantId: string,
  executionId: string
): Promise<string> {
  // Generate a secure token
  const token = crypto.randomUUID().replace(/-/g, '');
  
  // Store token in a new table or in participant record
  const { error } = await supabase
    .from('execution_participants')
    .update({ 
      otp_code: token,
      otp_sent_at: new Date().toISOString(),
    })
    .eq('id', participantId);
  
  if (error) {
    console.error('Error generating signing link:', error);
    throw error;
  }
  
  // Construct the signing URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/execution/sign/${token}`;
}
