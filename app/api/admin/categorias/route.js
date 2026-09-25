import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  const { nome, ordem } = body || {};
  if (!nome) return Response.json({ erro: 'Nome da categoria é obrigatório.' }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from('categorias')
    .insert({ nome, ordem: Number(ordem) || 0 })
    .select('id')
    .single();
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ id: data.id }, { status: 201 });
}
