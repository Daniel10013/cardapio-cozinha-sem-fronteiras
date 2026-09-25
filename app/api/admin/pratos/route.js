import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  const { categoriaId, nome, descricao, preco, ordem, tempoPreparo } = body || {};
  if (!categoriaId || !nome || preco === undefined) {
    return Response.json({ erro: 'Categoria, nome e preço são obrigatórios.' }, { status: 400 });
  }
  const precoNum = Number(preco);
  if (Number.isNaN(precoNum) || precoNum < 0) {
    return Response.json({ erro: 'Preço inválido.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('pratos')
    .insert({
      categoria_id: categoriaId,
      nome,
      descricao: descricao || '',
      preco: precoNum,
      ativo: true,
      ordem: Number(ordem) || 0,
      tempo_preparo: tempoPreparo !== undefined ? Math.max(0, Number(tempoPreparo) || 0) : 0,
    })
    .select('id')
    .single();
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ id: data.id }, { status: 201 });
}
