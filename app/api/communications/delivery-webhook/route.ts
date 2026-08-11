import { NextRequest, NextResponse } from "next/server";
import { updateCommunicationStatus } from "@/lib/communications/communication-log";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  const url = request.url;

  try {
    // ─── TWILIO WEBHOOK (x-www-form-urlencoded) ───
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const twilioSignature = request.headers.get('x-twilio-signature');
      if (!twilioSignature) {
        return NextResponse.json({ error: 'Missing Twilio signature' }, { status: 401 });
      }

      const formBody = await request.text();
      const params = new URLSearchParams(formBody);
      const twilioParams: Record<string, string> = {};
      params.forEach((value, key) => { twilioParams[key] = value; });

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

      const messageSid = twilioParams['MessageSid'];
      const messageStatus = twilioParams['MessageStatus'];
      if (messageSid && messageStatus) {
        await updateCommunicationStatus(messageSid, mapTwilioStatus(messageStatus));
      }

      return NextResponse.json({ success: true });
    }

    // ─── SENDGRID WEBHOOK (JSON, signed) ───
    if (contentType.includes('application/json')) {
      const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
      
      // MANDATORY: verification key must be configured
      if (!verificationKey) {
        return NextResponse.json({ error: 'SendGrid webhook verification not configured' }, { status: 503 });
      }

      const rawBody = await request.text();
      const sendgridSignature = request.headers.get('x-twilio-email-event-webhook-signature');
      const sendgridTimestamp = request.headers.get('x-twilio-email-event-webhook-timestamp');

      // MANDATORY: signature and timestamp required
      if (!sendgridSignature || !sendgridTimestamp) {
        return NextResponse.json({ error: 'Missing SendGrid signature headers' }, { status: 401 });
      }

      // Verify against EXACT raw body (not JSON.parsed + stringified)
      const { EventWebhook, EventWebhookHeader } = require('@sendgrid/eventwebhook');
      const ew = new EventWebhook();
      const signatureHeader: any = {};
      signatureHeader[EventWebhookHeader.SIGNATURE().toLowerCase()] = sendgridSignature;
      signatureHeader[EventWebhookHeader.TIMESTAMP().toLowerCase()] = sendgridTimestamp;

      let verified = false;
      try {
        verified = ew.verifySignature(signatureHeader, rawBody, verificationKey);
      } catch {
        verified = false;
      }

      if (!verified) {
        return NextResponse.json({ error: 'Invalid SendGrid signature' }, { status: 401 });
      }

      // Signature valid — parse and process
      const body = JSON.parse(rawBody);
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
