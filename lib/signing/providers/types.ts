export interface SigningProvider {
  name: string;
  createRequest(params: CreateSigningRequestParams): Promise<ProviderRequest>;
  getStatus(providerRequestId: string): Promise<ProviderStatus>;
  cancelRequest(providerRequestId: string): Promise<void>;
}

export interface CreateSigningRequestParams {
  documentName: string;
  documentUrl: string;
  signers: Array<{ name: string; email: string; role: string }>;
  fields: Array<{ type: string; page: number; x: number; y: number; signerIndex: number }>;
  redirectUrl?: string;
}

export interface ProviderRequest {
  providerRequestId: string;
  status: string;
  signingUrl?: string;
}

export interface ProviderStatus {
  status: string;
  completedAt?: string;
  signedBy?: string[];
}
