import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { subtotalDaMesa, calcularTaxaServico, normalizarMesa } from '@/lib/contas';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const mesa = normalizarMesa(body?.mesa);
  if (!mesa) return Response.json({ erro: 'Informe o número da mesa.' }, { status: 400 });

  const db = supabaseAdmin();

  // Se a conta já foi pedida e ainda não foi atendida, não cria outro aviso.
  const { data: pendente, error: erroPend } = await db
    .from('csf_fechamentos')
    .select('id, subtotal, taxa_servico, total')
    .eq('mesa', mesa)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (erroPend) return Response.json({ erro: erroPend.message }, { status: 500 });
  if (pendente) {
    return Response.json({
      id: pendente.id,
      subtotal: Number(pendente.subtotal),
      taxaServico: Number(pendente.taxa_servico),
      total: Number(pendente.total),
      jaSolicitado: true,
    });
  }

  const subtotal = await subtotalDaMesa(mesa);
  if (subtotal <= 0) {
    return Response.json({ erro: 'Não há pedidos nesta comanda para fechar.' }, { status: 400 });
  }
  const taxaServico = calcularTaxaServico(subtotal);
  const total = subtotal + taxaServico;

  const { data, error } = await db
    .from('csf_fechamentos')
    .insert({
      mesa,
      subtotal,
      taxa_servico: taxaServico,
      incluiu_servico: true,
      total,
      status: 'pendente',
      criado_em: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ id: data.id, subtotal, taxaServico, total }, { status: 201 });
}
