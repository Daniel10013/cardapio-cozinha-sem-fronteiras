import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calcularTaxaServico } from '@/lib/contas';

export async function GET(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: fechamento, error: erroFechamento } = await db
    .from('csf_fechamentos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (erroFechamento) return Response.json({ erro: erroFechamento.message }, { status: 500 });
  if (!fechamento) return Response.json({ erro: 'Fechamento não encontrado.' }, { status: 404 });

  const inicioDoDia = new Date(fechamento.criado_em);
  inicioDoDia.setHours(0, 0, 0, 0);

  const { data: pedidos, error: erroPedidos } = await db
    .from('csf_pedidos')
    .select('id')
    .eq('mesa', fechamento.mesa)
    .neq('status', 'cancelado')
    .gte('criado_em', inicioDoDia.toISOString())
    .lte('criado_em', fechamento.criado_em);
  if (erroPedidos) return Response.json({ erro: erroPedidos.message }, { status: 500 });

  const idsPedidos = pedidos.map((p) => p.id);
  const { data: itens, error: erroItens } = await db
    .from('csf_itens_pedido')
    .select('nome_prato, preco_unitario, quantidade, subtotal')
    .in('pedido_id', idsPedidos.length ? idsPedidos : [0]);
  if (erroItens) return Response.json({ erro: erroItens.message }, { status: 500 });

  const mapaItens = new Map();
  for (const item of itens) {
    const chave = `${item.nome_prato}|${item.preco_unitario}`;
    if (!mapaItens.has(chave)) {
      mapaItens.set(chave, { nome: item.nome_prato, precoUnitario: item.preco_unitario, quantidade: 0, subtotal: 0 });
    }
    const acumulado = mapaItens.get(chave);
    acumulado.quantidade += item.quantidade;
    acumulado.subtotal += Number(item.subtotal);
  }

  const taxaServico = calcularTaxaServico(Number(fechamento.subtotal));
  return Response.json({
    mesa: fechamento.mesa,
    criadoEm: fechamento.criado_em,
    incluiuServico: !!fechamento.incluiu_servico,
    itens: Array.from(mapaItens.values()),
    subtotal: Number(fechamento.subtotal),
    taxaServico,
    totalSemServico: Number(fechamento.subtotal),
    totalComServico: Number(fechamento.subtotal) + taxaServico,
  });
}
