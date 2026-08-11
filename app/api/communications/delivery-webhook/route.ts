import { NextRequest, NextResponse } from "next/server";
import { updateCommunicationStatus } from "@/lib/communications/communication-log";

// Twilio signature verification
function verifyTwilioSignature(request: NextRequest, body: string): boolean {
  const url = request.url;
  const signature = request.headers.get('x-twilio-signature');
  if (!signature) return false;

  const twilio = require('twilio');
  const params: Record<string, string> = {};
  const searchParams = new URL(url).searchParams;
  searchParams.forEach((value, key) => { params[key] = value; });

  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const url = request.url;

  try {
    // Twilio webhook — verify signature
    if (body.MessageSid && body.MessageStatus) {
      const twilioSignature = request.headers.get('x-twilio-signature');
      if (twilioSignature) {
        const twilio = require('twilio');
        const isValid = twilio.validateRequest(
          process.env.TWILIO_AUTH_TOKEN!,
          twilioSignature,
          url,
          {}
        );
        if (!isValid) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }

      await updateCommunicationStatus(body.MessageSid, mapTwilioStatus(body.MessageStatus));
      return NextResponse.json({ success: true });
    }

    // SendGrid webhook
    if (Array.isArray(body)) {
      for (const event of body) {
        if (event.sg_message_id && event.event) {
          await updateCommunicationStatus(event.sg_message_id, mapSendGridStatus(event.event));
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown webhook format" }, { status: 400 });
  } catch (error: any) {
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
