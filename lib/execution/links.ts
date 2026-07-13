import { supabase } from "@/lib/supabase";

export async function generateSigningLink(
  participantId: string,
  executionId: string
): Promise<string> {
  // Generate a secure token
  const token = crypto.randomUUID().replace(/-/g, '');
  
  // Store token in the participant record
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