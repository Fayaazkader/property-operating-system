export type ProviderMessage = {
  phoneNumber: string;
  templateName: string;
  bodyParams: { name: string; value: string }[];
};

export type ProviderResponse = {
  id: string;
  status: "sent" | "failed";
  error?: string;
};

export type MessageProvider = {
  send: (message: ProviderMessage) => Promise<ProviderResponse>;
  getStatus: (messageId: string) => Promise<string>;
  isEnabled: () => boolean;
};