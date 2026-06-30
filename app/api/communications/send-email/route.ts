import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

export async function POST(request: NextRequest) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) sgMail.setApiKey(apiKey);

  const { to, subject, html } = await request.json();

  if (!apiKey) {
    return NextResponse.json({ error: "SendGrid not configured" }, { status: 500 });
  }

  try {
    await sgMail.send({ to, from: "hello@assetflow.africa", subject, html });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("SendGrid error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
