import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { subtotalDaMesa, calcularTaxaServico } from '@/lib/contas';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const mesa = String(body?.mesa || '').trim();
  if (!mesa) return Response.json({ erro: 'Informe o número da mesa.' }, { status: 400 });

  const subtotal = await subtotalDaMesa(mesa);
  const taxaServico = calcularTaxaServico(subtotal);
  const total = subtotal + taxaServico;

  const { data, error } = await supabaseAdmin()
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
