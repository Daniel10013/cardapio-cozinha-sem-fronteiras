import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes');
  const db = supabaseAdmin();

  let query = db.from('pedidos').select('total, criado_em');
  if (mes) {
    const inicio = `${mes}-01T00:00:00.000Z`;
    const [ano, mesNum] = mes.split('-').map(Number);
    const proximoMes = new Date(Date.UTC(ano, mesNum, 1)).toISOString();
    query = query.gte('criado_em', inicio).lt('criado_em', proximoMes);
  }

  const { data: pedidos, error } = await query;
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  const totalPedidos = pedidos.length;
  const faturamento = pedidos.reduce((soma, p) => soma + Number(p.total), 0);

  const porDiaMap = new Map();
  for (const p of pedidos) {
    const dia = p.criado_em.slice(0, 10);
    const atual = porDiaMap.get(dia) || { dia, pedidos: 0, faturamento: 0 };
    atual.pedidos += 1;
    atual.faturamento += Number(p.total);
    porDiaMap.set(dia, atual);
  }
  const porDia = Array.from(porDiaMap.values()).sort((a, b) => a.dia.localeCompare(b.dia));

  return Response.json({ totalPedidos, faturamento, porDia });
}
