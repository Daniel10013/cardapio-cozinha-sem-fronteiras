import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  const { categoriaId, nome, descricao, preco, ordem, tempoPreparo, peso, quantidade } = body || {};
  if (!categoriaId || !nome || preco === undefined) {
    return Response.json({ erro: 'Categoria, nome e preço são obrigatórios.' }, { status: 400 });
  }
  const precoNum = Number(preco);
  if (Number.isNaN(precoNum) || precoNum < 0) {
    return Response.json({ erro: 'Preço inválido.' }, { status: 400 });
  }

  // Prato novo entra no fim da categoria (a menos que a ordem seja informada)
  let ordemFinal = Number(ordem) || 0;
  if (!ordemFinal) {
    const { data: ultimo } = await supabaseAdmin()
      .from('csf_pratos')
      .select('ordem')
      .eq('categoria_id', categoriaId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();
    ordemFinal = (ultimo?.ordem || 0) + 1;
  }

  const { data, error } = await supabaseAdmin()
    .from('csf_pratos')
    .insert({
      categoria_id: categoriaId,
      nome,
      descricao: descricao || '',
      preco: precoNum,
      ativo: true,
      ordem: ordemFinal,
      tempo_preparo: tempoPreparo !== undefined ? Math.max(0, Number(tempoPreparo) || 0) : 0,
      peso: String(peso || '').trim().slice(0, 40),
      quantidade: String(quantidade || '').trim().slice(0, 40),
    })
    .select('id')
    .single();
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ id: data.id }, { status: 201 });
}
