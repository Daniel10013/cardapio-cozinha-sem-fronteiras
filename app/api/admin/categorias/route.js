import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  const { nome, ordem } = body || {};
  if (!nome) return Response.json({ erro: 'Nome da categoria é obrigatório.' }, { status: 400 });

  // Categoria nova entra no fim da lista (a menos que a ordem seja informada)
  let ordemFinal = Number(ordem) || 0;
  if (!ordemFinal) {
    const { data: ultima } = await supabaseAdmin()
      .from('csf_categorias')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();
    ordemFinal = (ultima?.ordem || 0) + 1;
  }

  const { data, error } = await supabaseAdmin()
    .from('csf_categorias')
    .insert({ nome, ordem: ordemFinal })
    .select('id')
    .single();
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ id: data.id }, { status: 201 });
}
