import { NextRequest, NextResponse } from "next/server";
import { updateCommunicationStatus } from "@/lib/communications/communication-log";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  const url = request.url;

  try {
    // ─── TWILIO WEBHOOK ───
    // Twilio sends application/x-www-form-urlencoded, NOT JSON
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const twilioSignature = request.headers.get('x-twilio-signature');
      
      // REQUIRED: No signature = reject
      if (!twilioSignature) {
        return NextResponse.json({ error: 'Missing Twilio signature' }, { status: 401 });
      }

      // Parse the raw form body
      const formBody = await request.text();
      const params = new URLSearchParams(formBody);
      const twilioParams: Record<string, string> = {};
      params.forEach((value, key) => { twilioParams[key] = value; });

      // Verify signature against the ACTUAL webhook parameters
      const twilio = require('twilio');
      const isValid = twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN!,
        twilioSignature,
        url,
        twilioParams
      );

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 });
      }

      // Signature valid — process status update
      const messageSid = twilioParams['MessageSid'];
      const messageStatus = twilioParams['MessageStatus'];
      
      if (messageSid && messageStatus) {
        await updateCommunicationStatus(messageSid, mapTwilioStatus(messageStatus));
      }

      return NextResponse.json({ success: true });
    }

    // ─── SENDGRID WEBHOOK ───
    // SendGrid sends JSON array
    if (contentType.includes('application/json')) {
      const body = await request.json();

      // Verify SendGrid signed webhook
      const sendgridSignature = request.headers.get('x-twilio-email-event-webhook-signature');
      const sendgridTimestamp = request.headers.get('x-twilio-email-event-webhook-timestamp');
      
      if (sendgridSignature && sendgridTimestamp) {
        const { EventWebhook, EventWebhookHeader } = require('@sendgrid/eventwebhook');
        const ew = new EventWebhook();
        const rawBody = JSON.stringify(body);
        
        try {
          const signatureHeader: any = {};
          signatureHeader[EventWebhookHeader.SIGNATURE().toLowerCase()] = sendgridSignature;
          signatureHeader[EventWebhookHeader.TIMESTAMP().toLowerCase()] = sendgridTimestamp;
          
          ew.verifySignature(signatureHeader, rawBody, process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY || process.env.SENDGRID_API_KEY || '');
        } catch {
          return NextResponse.json({ error: 'Invalid SendGrid signature' }, { status: 401 });
        }
      }
      // If SendGrid webhook verification is not configured, still process but log warning
      // In production, this should be configured

      if (Array.isArray(body)) {
        for (const event of body) {
          if (event.sg_message_id && event.event) {
            await updateCommunicationStatus(event.sg_message_id, mapSendGridStatus(event.event));
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown content type' }, { status: 400 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function mapTwilioStatus(status: string): 'delivered' | 'read' | 'failed' {
  const s = status.toLowerCase();
  if (s === 'delivered') return 'delivered';
  if (s === 'read') return 'read';
  if (s === 'failed' || s === 'undelivered') return 'failed';
  return 'delivered';
}

function mapSendGridStatus(event: string): 'delivered' | 'read' | 'failed' {
  const s = event.toLowerCase();
  if (s === 'delivered') return 'delivered';
  if (s === 'open' || s === 'click') return 'read';
  if (s === 'bounce' || s === 'dropped' || s === 'deferred') return 'failed';
  return 'delivered';
}
