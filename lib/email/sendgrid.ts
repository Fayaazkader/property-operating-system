import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) sgMail.setApiKey(apiKey);

export async function sendEmail(to: string, subject: string, html: string) {
  if (!apiKey) {
    console.log("SendGrid not configured — skipping email to:", to);
    return;
  }

  try {
    await sgMail.send({
      to,
      from: "fayaaz318@gmail.com",
      subject,
      html,
    });
  } catch (error: any) {
    console.error("SendGrid error:", error.message);
  }
}
