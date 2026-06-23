export async function sendTwilioWhatsApp(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch("/api/communications/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
