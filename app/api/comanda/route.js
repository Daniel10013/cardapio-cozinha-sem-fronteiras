import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { pedidosDaComanda, calcularTaxaServico, normalizarMesa } from '@/lib/contas';

// Detalhe de uma comanda aberta: pedidos, itens, status e totais.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = normalizarMesa(searchParams.get('id'));
  if (!id) return Response.json({ erro: 'Informe a comanda.' }, { status: 400 });

  const db = supabaseAdmin();
  const pedidos = await pedidosDaComanda(id, new Date(), { incluirCancelados: true });

  const ids = pedidos.map((p) => p.id);
  let itens = [];
  if (ids.length) {
    const { data, error } = await db
      .from('csf_itens_pedido')
      .select('pedido_id, nome_prato, opcoes, quantidade, preco_unitario, subtotal')
      .in('pedido_id', ids)
      .order('id');
    if (error) return Response.json({ erro: error.message }, { status: 500 });
    itens = data;
  }

  const { data: pendentes, error: erroPend } = await db
    .from('csf_fechamentos')
    .select('id')
    .eq('mesa', id)
    .eq('status', 'pendente')
    .limit(1);
  if (erroPend) return Response.json({ erro: erroPend.message }, { status: 500 });

  const lista = pedidos.map((p) => ({
    id: p.id,
    status: p.status,
    criado_em: p.criado_em,
    observacao: p.observacao,
    total: Number(p.total),
    itens: itens
      .filter((i) => i.pedido_id === p.id)
      .map((i) => ({
        nome: i.nome_prato,
        opcoes: i.opcoes || '',
        quantidade: i.quantidade,
        precoUnitario: Number(i.preco_unitario),
        subtotal: Number(i.subtotal),
      })),
  }));

  const subtotal = lista.filter((p) => p.status !== 'cancelado').reduce((soma, p) => soma + p.total, 0);
  return Response.json({
    id,
    pedidos: lista,
    subtotal,
    taxaServico: calcularTaxaServico(subtotal),
    fechamentoPendente: (pendentes || []).length > 0,
  });
}
