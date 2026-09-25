import { supabaseAdmin } from './supabaseAdmin';

export async function getConfig(chave) {
  const { data, error } = await supabaseAdmin().from('config').select('valor').eq('chave', chave).maybeSingle();
  if (error) throw error;
  return data ? data.valor : null;
}

export async function setConfig(chave, valor) {
  const { error } = await supabaseAdmin().from('config').upsert({ chave, valor });
  if (error) throw error;
}
