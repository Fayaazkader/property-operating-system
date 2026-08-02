import { nativeSigningProvider } from './native-provider';
import type { SigningProvider } from './types';

const providers: Record<string, SigningProvider> = {
  native: nativeSigningProvider,
};

export function getSigningProvider(name: string = 'native'): SigningProvider {
  return providers[name] || providers.native;
}

export type { SigningProvider };
