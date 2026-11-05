import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { diaBR, limitesMesBR, mesValido } from '@/lib/datas';

export async function GET(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes');
  if (mes && !mesValido(mes)) return Response.json({ erro: 'Mês inválido.' }, { status: 400 });
  const db = supabaseAdmin();

  // Pedidos cancelados não entram no faturamento nem na contagem.
  let query = db.from('csf_pedidos').select('total, criado_em').neq('status', 'cancelado');
  if (mes) {
    const { inicio, fim } = limitesMesBR(mes);
    query = query.gte('criado_em', inicio).lt('criado_em', fim);
  }

  const { data: pedidos, error } = await query;
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  const totalPedidos = pedidos.length;
  const faturamento = pedidos.reduce((soma, p) => soma + Number(p.total), 0);

  const porDiaMap = new Map();
  for (const p of pedidos) {
    const dia = diaBR(p.criado_em);
    const atual = porDiaMap.get(dia) || { dia, pedidos: 0, faturamento: 0 };
    atual.pedidos += 1;
    atual.faturamento += Number(p.total);
    porDiaMap.set(dia, atual);
  }
  const porDia = Array.from(porDiaMap.values()).sort((a, b) => a.dia.localeCompare(b.dia));

  return Response.json({ totalPedidos, faturamento, porDia });
}
