import { createClient } from '@supabase/supabase-js';

// Cliente Supabase com a chave "service_role" — acesso total ao banco.
// Só pode ser importado em código que roda no servidor (app/api/**),
// nunca em componentes de cliente ("use client"). A chave nunca deve
// levar o prefixo NEXT_PUBLIC_.
let client = null;

export function supabaseAdmin() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const UPLOADS_BUCKET = 'uploads';
