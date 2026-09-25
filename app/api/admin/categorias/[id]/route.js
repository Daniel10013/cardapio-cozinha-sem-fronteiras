import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { nome, ordem } = body || {};

  const atualizacao = {};
  if (nome !== undefined) atualizacao.nome = nome;
  if (ordem !== undefined) atualizacao.ordem = Number(ordem);

  const { error } = await supabaseAdmin().from('categorias').update(atualizacao).eq('id', id);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const db = supabaseAdmin();

  const { count, error: erroContagem } = await db
    .from('pratos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', id);
  if (erroContagem) return Response.json({ erro: erroContagem.message }, { status: 500 });
  if (count > 0) {
    return Response.json({ erro: 'Remova ou mova os pratos desta categoria antes de excluí-la.' }, { status: 400 });
  }

  const { error } = await db.from('categorias').delete().eq('id', id);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
