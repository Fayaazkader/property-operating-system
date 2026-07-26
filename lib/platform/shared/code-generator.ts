import { supabase } from '@/lib/supabase';

export const codeGenerator = {
  async generate(prefix: string): Promise<string> {
    const { data, error } = await supabase.rpc('next_sequence', { seq_name: prefix });
    if (error) throw error;
    return data as string;
  }
};
