import { requireAuth } from '@/lib/auth';
import { supabaseAdmin, UPLOADS_BUCKET } from '@/lib/supabaseAdmin';

export async function PATCH(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { nome, descricao, preco, ativo, ordem, categoriaId, tempoPreparo, peso, quantidade, observacao } = body || {};

  if (preco !== undefined) {
    const precoNum = Number(preco);
    if (Number.isNaN(precoNum) || precoNum < 0) {
      return Response.json({ erro: 'Preço inválido.' }, { status: 400 });
    }
  }

  const atualizacao = {};
  if (nome !== undefined) atualizacao.nome = nome;
  if (descricao !== undefined) atualizacao.descricao = descricao;
  if (preco !== undefined) atualizacao.preco = Number(preco);
  if (ativo !== undefined) atualizacao.ativo = !!ativo;
  if (ordem !== undefined) atualizacao.ordem = Number(ordem);
  if (categoriaId !== undefined) atualizacao.categoria_id = categoriaId;
  if (tempoPreparo !== undefined) atualizacao.tempo_preparo = Math.max(0, Number(tempoPreparo) || 0);
  if (peso !== undefined) atualizacao.peso = String(peso).trim().slice(0, 40);
  if (quantidade !== undefined) atualizacao.quantidade = String(quantidade).trim().slice(0, 40);
  if (observacao !== undefined) atualizacao.observacao = String(observacao).trim().slice(0, 200);

  const { error } = await supabaseAdmin().from('csf_pratos').update(atualizacao).eq('id', id);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: atual } = await db.from('csf_pratos').select('foto').eq('id', id).maybeSingle();
  if (atual?.foto) {
    const nomeArquivo = atual.foto.split('/').pop();
    await db.storage.from(UPLOADS_BUCKET).remove([nomeArquivo]);
  }

  const { error } = await db.from('csf_pratos').delete().eq('id', id);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
