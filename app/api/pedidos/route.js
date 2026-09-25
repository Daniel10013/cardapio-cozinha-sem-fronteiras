import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getConfig } from '@/lib/config';

export async function POST(request) {
  const aberto = (await getConfig('loja_aberta')) !== '0';
  if (!aberto) {
    return Response.json({ erro: 'O restaurante não está aceitando pedidos no momento.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { mesa, observacao, itens } = body || {};

  if (!Array.isArray(itens) || itens.length === 0) {
    return Response.json({ erro: 'O pedido precisa ter pelo menos um item.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const idsPratos = itens.map((i) => i.pratoId);
  const { data: pratos, error: erroPratos } = await db
    .from('pratos')
    .select('id, nome, preco')
    .eq('ativo', true)
    .in('id', idsPratos);
  if (erroPratos) return Response.json({ erro: erroPratos.message }, { status: 500 });

  const itensValidos = [];
  let total = 0;

  for (const item of itens) {
    const qtd = Number(item.quantidade);
    if (!item.pratoId || !Number.isInteger(qtd) || qtd <= 0) {
      return Response.json({ erro: 'Item de pedido inválido.' }, { status: 400 });
    }
    const prato = pratos.find((p) => p.id === item.pratoId);
    if (!prato) {
      return Response.json({ erro: `Prato não encontrado ou indisponível (id ${item.pratoId}).` }, { status: 400 });
    }
    const subtotal = Number(prato.preco) * qtd;
    total += subtotal;
    itensValidos.push({
      prato_id: prato.id,
      nome_prato: prato.nome,
      preco_unitario: prato.preco,
      quantidade: qtd,
      subtotal,
    });
  }

  const criadoEm = new Date().toISOString();
  const { data: pedido, error: erroPedido } = await db
    .from('pedidos')
    .insert({
      mesa: String(mesa || '').slice(0, 80),
      observacao: String(observacao || '').slice(0, 500),
      status: 'recebido',
      total,
      criado_em: criadoEm,
    })
    .select('id')
    .single();
  if (erroPedido) return Response.json({ erro: erroPedido.message }, { status: 500 });

  const { error: erroItens } = await db
    .from('itens_pedido')
    .insert(itensValidos.map((item) => ({ ...item, pedido_id: pedido.id })));
  if (erroItens) return Response.json({ erro: erroItens.message }, { status: 500 });

  return Response.json({ pedidoId: pedido.id, total, criadoEm }, { status: 201 });
}
