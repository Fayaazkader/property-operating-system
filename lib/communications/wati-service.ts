const WATI_API_KEY = process.env.WATI_API_KEY || "";
const WATI_API_URL = process.env.WATI_API_URL || "https://api.wati.io";
const WATI_ENABLED = process.env.WATI_ENABLED === "true";

type WatiResponse = {
  id: string;
  status: string;
  error?: string;
};

export async function sendWatiMessage(
  phoneNumber: string,
  templateName: string,
  bodyParams: { name: string; value: string }[]
): Promise<WatiResponse> {
  if (!WATI_ENABLED || !WATI_API_KEY) {
    console.log("[WATI] Disabled — using simulated send");
    return {
      id: `SIM-${Date.now()}`,
      status: "simulated",
    };
  }

  try {
    const response = await fetch(`${WATI_API_URL}/api/v1/sendTemplateMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WATI_API_KEY}`,
      },
      body: JSON.stringify({
        whatsappNumber: phoneNumber,
        template_name: templateName,
        parameters: bodyParams.map(p => ({
          name: p.name,
          value: p.value,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WATI] Send failed:", data);
      return { id: "", status: "failed", error: data.message || "Unknown error" };
    }

    return { id: data.id || data.messageId, status: "sent" };
  } catch (error: any) {
    console.error("[WATI] Error:", error);
    return { id: "", status: "failed", error: error.message };
  }
}

export async function getWatiMessageStatus(messageId: string): Promise<string> {
  if (!WATI_ENABLED || !WATI_API_KEY) return "simulated";

  try {
    const response = await fetch(`${WATI_API_URL}/api/v1/getMessageStatus/${messageId}`, {
      headers: { "Authorization": `Bearer ${WATI_API_KEY}` },
    });

    if (!response.ok) return "unknown";

    const data = await response.json();
    return data.status || "unknown";
  } catch {
    return "unknown";
  }
}

export function isWatiEnabled(): boolean {
  return WATI_ENABLED && !!WATI_API_KEY;
}