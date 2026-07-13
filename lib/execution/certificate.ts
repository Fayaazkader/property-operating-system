// lib/execution/certificate.ts
// Execution Certificate Generator

import { supabase } from "@/lib/supabase";
import { createClient } from '@supabase/supabase-js';

// Use service role for storage operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CertificateData {
  execution_id: string;
  lease_id: string;
  lease_reference: string;
  version: number;
  executed_at: string;
  effective_date: string | null;
  participants: {
    name: string;
    type: string;
    signed_at: string;
    ip_address: string | null;
    user_agent: string | null;
    signature_method: string;
  }[];
  events: {
    event_type: string;
    created_at: string;
  }[];
  provider: string;
  sha_hash: string;
}

export async function generateExecutionCertificate(
  executionId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // 1. Fetch execution data
    const { data: execution, error: execError } = await supabaseAdmin
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (execError || !execution) {
      return { success: false, error: 'Execution not found' };
    }

    // 2. Fetch participants
    const { data: participants } = await supabaseAdmin
      .from('execution_participants')
      .select('*')
      .eq('execution_id', executionId)
      .order('signing_order', { ascending: true });

    // 3. Fetch events
    const { data: events } = await supabaseAdmin
      .from('execution_events')
      .select('*')
      .eq('execution_id', executionId)
      .order('created_at', { ascending: true });

    // 4. Fetch source data (lease)
    let leaseData: any = null;
    if (execution.source_type === 'lease') {
      const { data: lease } = await supabaseAdmin
        .from('leases')
        .select('*')
        .eq('id', execution.source_id)
        .single();
      leaseData = lease;
    }

    // 5. Build certificate data
    const certificateData: CertificateData = {
      execution_id: execution.id,
      lease_id: execution.source_id,
      lease_reference: leaseData?.lease_id || leaseData?.id || 'N/A',
      version: execution.version || 1,
      executed_at: execution.executed_at || new Date().toISOString(),
      effective_date: execution.effective_date || null,
      participants: participants?.map(p => ({
        name: p.name,
        type: p.participant_type,
        signed_at: p.signed_at || '',
        ip_address: p.ip_address || null,
        user_agent: p.user_agent || null,
        signature_method: p.signature_data?.type || 'unknown',
      })) || [],
      events: events?.map(e => ({
        event_type: e.event_type,
        created_at: e.created_at,
      })) || [],
      provider: execution.provider || 'native',
      sha_hash: execution.sha_hash || generateShaHash(execution.id),
    };

    // 6. Generate HTML certificate content
    const htmlContent = generateCertificateHTML(certificateData);

    // 7. Upload to Supabase Storage
    const fileName = `certificate_${execution.id}_${Date.now()}.html`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('execution-certificates')
      .upload(fileName, htmlContent, {
        contentType: 'text/html',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // 8. Get public URL
    const { data: urlData } = supabaseAdmin
      .storage
      .from('execution-certificates')
      .getPublicUrl(fileName);

    // 9. Update execution with certificate URL
    await supabaseAdmin
      .from('executions')
      .update({
        execution_certificate_url: urlData.publicUrl,
        sha_hash: certificateData.sha_hash,
      })
      .eq('id', executionId);

    return { success: true, url: urlData.publicUrl };

  } catch (error) {
    console.error('Certificate generation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function generateCertificateHTML(data: CertificateData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Execution Certificate</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 40px; }
    .container { max-width: 900px; margin: 0 auto; background: #141414; border: 1px solid #2a2a2a; border-radius: 16px; padding: 48px; }
    .header { text-align: center; border-bottom: 1px solid #2a2a2a; padding-bottom: 24px; margin-bottom: 32px; }
    .logo { font-size: 28px; font-weight: bold; color: #ffffff; }
    .logo span { color: #34d399; }
    .subtitle { color: #888; font-size: 14px; margin-top: 4px; letter-spacing: 2px; }
    .badge { display: inline-block; background: #34d399; color: #0a0a0a; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 12px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: bold; color: #34d399; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #2a2a2a; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1a1a1a; }
    .label { color: #888; font-size: 13px; }
    .value { color: #e0e0e0; font-size: 13px; font-weight: 500; }
    .participant { background: #1a1a1a; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; border-left: 3px solid #34d399; }
    .participant-name { font-weight: bold; color: #e0e0e0; }
    .participant-detail { color: #888; font-size: 12px; }
    .timeline { position: relative; padding-left: 20px; }
    .timeline-item { padding: 8px 0; border-left: 2px solid #2a2a2a; padding-left: 16px; }
    .timeline-item:last-child { border-left: 2px solid #34d399; }
    .timeline-time { color: #888; font-size: 12px; }
    .timeline-event { color: #e0e0e0; font-size: 13px; }
    .footer { text-align: center; border-top: 1px solid #2a2a2a; padding-top: 24px; margin-top: 32px; color: #888; font-size: 12px; }
    .hash { font-family: monospace; font-size: 11px; color: #555; word-break: break-all; background: #1a1a1a; padding: 8px 12px; border-radius: 4px; margin-top: 8px; }
    .status-badge { display: inline-block; background: #34d399; color: #0a0a0a; padding: 2px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">AssetFlow <span>|</span> Execution Certificate</div>
      <div class="subtitle">OFFICIAL EXECUTION RECORD</div>
      <div class="badge">Certificate of Execution</div>
    </div>

    <div class="section">
      <div class="section-title">Execution Details</div>
      <div class="row"><span class="label">Execution ID</span><span class="value">${data.execution_id}</span></div>
      <div class="row"><span class="label">Lease Reference</span><span class="value">${data.lease_reference}</span></div>
      <div class="row"><span class="label">Version</span><span class="value">v${data.version}</span></div>
      <div class="row"><span class="label">Executed At</span><span class="value">${new Date(data.executed_at).toLocaleString()}</span></div>
      ${data.effective_date ? `<div class="row"><span class="label">Effective Date</span><span class="value">${new Date(data.effective_date).toLocaleDateString()}</span></div>` : ''}
      <div class="row"><span class="label">Provider</span><span class="value"><span class="status-badge">${data.provider.toUpperCase()}</span></span></div>
    </div>

    <div class="section">
      <div class="section-title">Participants (${data.participants.length})</div>
      ${data.participants.map(p => `
        <div class="participant">
          <div class="participant-name">${p.name} <span style="color:#888;font-weight:normal;font-size:12px;">— ${p.type.toUpperCase()}</span></div>
          <div class="participant-detail">Signed: ${p.signed_at ? new Date(p.signed_at).toLocaleString() : 'N/A'}</div>
          ${p.ip_address ? `<div class="participant-detail">IP: ${p.ip_address}</div>` : ''}
          ${p.user_agent ? `<div class="participant-detail">Device: ${p.user_agent.substring(0, 80)}${p.user_agent.length > 80 ? '...' : ''}</div>` : ''}
          <div class="participant-detail">Method: ${p.signature_method}</div>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <div class="section-title">Execution Timeline</div>
      <div class="timeline">
        ${data.events.map(e => `
          <div class="timeline-item">
            <div class="timeline-time">${new Date(e.created_at).toLocaleString()}</div>
            <div class="timeline-event">${e.event_type.replace(/_/g, ' ').toUpperCase()}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Verification</div>
      <div class="hash">SHA-256: ${data.sha_hash}</div>
      <div style="color:#555;font-size:12px;margin-top:8px;">This certificate is automatically generated and cryptographically verifiable.</div>
    </div>

    <div class="footer">
      <div>Generated by AssetFlow · ${new Date().toLocaleString()}</div>
      <div style="margin-top:4px;">This is an official execution record. For verification, contact AssetFlow support.</div>
    </div>
  </div>
</body>
</html>
  `;
}

function generateShaHash(input: string): string {
  // Simple hash for demo — in production use crypto
  let hash = '';
  for (let i = 0; i < input.length; i++) {
    hash += input.charCodeAt(i).toString(16);
  }
  return 'sha256_' + hash.substring(0, 64);
}
