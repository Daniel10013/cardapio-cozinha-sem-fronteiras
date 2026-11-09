import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Grava a ordem do cardápio. Body: { tipo: 'categorias' | 'pratos', ids: [id, id, ...] }
// (a posição na lista vira o número de ordem; no caso de pratos, só os de uma categoria).
export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  const tipo = body?.tipo;
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
  if (!['categorias', 'pratos'].includes(tipo) || ids.length === 0 || ids.length > 500 || ids.some((n) => !Number.isInteger(n))) {
    return Response.json({ erro: 'Dados inválidos.' }, { status: 400 });
  }

  const tabela = tipo === 'categorias' ? 'csf_categorias' : 'csf_pratos';
  const db = supabaseAdmin();

  const { data: existentes, error: erroBusca } = await db.from(tabela).select('id').in('id', ids);
  if (erroBusca) return Response.json({ erro: erroBusca.message }, { status: 500 });
  if ((existentes || []).length !== new Set(ids).size) {
    return Response.json({ erro: 'Item não encontrado.' }, { status: 404 });
  }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await db.from(tabela).update({ ordem: i + 1 }).eq('id', ids[i]);
    if (error) return Response.json({ erro: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
