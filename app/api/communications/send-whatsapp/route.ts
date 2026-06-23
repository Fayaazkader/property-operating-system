import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request: NextRequest) {
  const { to, message } = await request.json();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ success: false, error: "Twilio not configured" }, { status: 500 });
  }

  const client = twilio(accountSid, authToken);

  try {
    console.log("Sending to:", `whatsapp:${to.replace(/\D/g, "")}`);
    const msg = await client.messages.create({
      from: fromNumber,
      to: `whatsapp:${to.replace(/\D/g, "")}`,
      body: message,
    });

    return NextResponse.json({ success: true, messageId: msg.sid });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
