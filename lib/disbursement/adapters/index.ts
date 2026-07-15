// lib/disbursement/adapters/index.ts
// Bank Adapter Registry

import { generateStandardEFT } from './standard-eft';
import type { BankFile } from '../types';

export type BankAdapterName = 'standard_eft' | 'nedbank' | 'standard_bank' | 'absa' | 'fnb' | 'capitec' | 'investec';

const adapters: Record<string, (batch: any, payments: any[]) => BankFile> = {
  standard_eft: generateStandardEFT,
  // Future adapters:
  // nedbank: generateNedbankFile,
  // standard_bank: generateStandardBankFile,
  // absa: generateABSAFile,
  // fnb: generateFNBFile,
  // capitec: generateCapitecFile,
  // investec: generateInvestecFile,
};

export function generateBankFile(adapter: BankAdapterName, batch: any, payments: any[]): BankFile {
  const generator = adapters[adapter] || adapters.standard_eft;
  return generator(batch, payments);
}

export { generateStandardEFT };
