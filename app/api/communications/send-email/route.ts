import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

export async function POST(request: NextRequest) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) sgMail.setApiKey(apiKey);

  const { to, subject, html, text, attachments } = await request.json();

  if (!apiKey) {
    return NextResponse.json({ error: "SendGrid not configured" }, { status: 500 });
  }

  try {
    const msg: any = {
      to,
      from: { email: "hello@assetflow.africa", name: "AssetFlow" },
      replyTo: "hello@assetflow.africa",
      subject,
      html: html || text,
    };

    if (attachments?.length) {
      msg.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
        type: att.type || 'application/pdf',
        disposition: 'attachment',
      }));
    }

    await sgMail.send(msg);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("SendGrid error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
