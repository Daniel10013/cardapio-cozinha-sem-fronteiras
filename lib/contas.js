import { supabaseAdmin } from './supabaseAdmin';

export function inicioDoDiaISO() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje.toISOString();
}

export async function subtotalDaMesa(mesa) {
  const { data, error } = await supabaseAdmin()
    .from('csf_pedidos')
    .select('total')
    .eq('mesa', mesa)
    .neq('status', 'cancelado')
    .gte('criado_em', inicioDoDiaISO());

  if (error) throw error;
  return (data || []).reduce((soma, p) => soma + Number(p.total), 0);
}

export function calcularTaxaServico(subtotal) {
  return Math.round(subtotal * 0.1 * 100) / 100;
}
