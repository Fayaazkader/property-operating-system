import type { SigningProvider, CreateSigningRequestParams, ProviderRequest, ProviderStatus } from './types';

export class NativeSigningProvider implements SigningProvider {
  name = 'native';

  async createRequest(_params: CreateSigningRequestParams): Promise<ProviderRequest> {
    return {
      providerRequestId: crypto.randomUUID(),
      status: 'created',
    };
  }

  async getStatus(_providerRequestId: string): Promise<ProviderStatus> {
    return { status: 'pending' };
  }

  async cancelRequest(_providerRequestId: string): Promise<void> {}
}

export const nativeSigningProvider = new NativeSigningProvider();
