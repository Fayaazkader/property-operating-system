// lib/platform/shared/code-generator.ts
// Reusable business code generator for all modules

import { supabase } from '@/lib/supabase';

export const codeGenerator = {
  async generate(prefix: string, table: string, column = 'code'): Promise<string> {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    const next = (count || 0) + 1;
    return `${prefix}-${String(next).padStart(6, '0')}`;
  }
};
