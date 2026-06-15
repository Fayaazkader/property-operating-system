import { MessageProvider, ProviderMessage, ProviderResponse } from "./index";

const WATI_API_KEY = process.env.WATI_API_KEY || "";
const WATI_API_URL = process.env.WATI_API_URL || "https://api.wati.io";
const WATI_ENABLED = process.env.WATI_ENABLED === "true";

export const watiProvider: MessageProvider = {
  async send(message: ProviderMessage): Promise<ProviderResponse> {
    if (!WATI_ENABLED || !WATI_API_KEY) {
      return { id: `SIM-${Date.now()}`, status: "sent" };
    }

    try {
      const response = await fetch(`${WATI_API_URL}/api/v1/sendTemplateMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WATI_API_KEY}`,
        },
        body: JSON.stringify({
          whatsappNumber: message.phoneNumber,
          template_name: message.templateName,
          parameters: message.bodyParams.map(p => ({ name: p.name, value: p.value })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { id: "", status: "failed", error: data.message || "Unknown error" };
      }
      return { id: data.id || data.messageId, status: "sent" };
    } catch (error: any) {
      return { id: "", status: "failed", error: error.message };
    }
  },

  async getStatus(messageId: string): Promise<string> {
    if (!WATI_ENABLED) return "simulated";
    try {
      const response = await fetch(`${WATI_API_URL}/api/v1/getMessageStatus/${messageId}`, {
        headers: { Authorization: `Bearer ${WATI_API_KEY}` },
      });
      if (!response.ok) return "unknown";
      const data = await response.json();
      return data.status || "unknown";
    } catch {
      return "unknown";
    }
  },

  isEnabled(): boolean {
    return WATI_ENABLED && !!WATI_API_KEY;
  },
};