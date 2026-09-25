import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes'); // formato: YYYY-MM
  const db = supabaseAdmin();

  let query = db.from('csf_pedidos').select('*').order('criado_em', { ascending: false });
  if (mes) {
    const inicio = `${mes}-01T00:00:00.000Z`;
    const [ano, mesNum] = mes.split('-').map(Number);
    const proximoMes = new Date(Date.UTC(ano, mesNum, 1)).toISOString();
    query = query.gte('criado_em', inicio).lt('criado_em', proximoMes);
  } else {
    query = query.limit(200);
  }

  const { data: pedidos, error } = await query;
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  const idsPedidos = pedidos.map((p) => p.id);
  const { data: itens, error: erroItens } = await db
    .from('csf_itens_pedido')
    .select('*')
    .in('pedido_id', idsPedidos.length ? idsPedidos : [0]);
  if (erroItens) return Response.json({ erro: erroItens.message }, { status: 500 });

  const comItens = pedidos.map((p) => ({ ...p, itens: itens.filter((i) => i.pedido_id === p.id) }));
  return Response.json(comItens);
}
