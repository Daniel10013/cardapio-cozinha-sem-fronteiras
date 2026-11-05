import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { solicitarFechamento } from '@/lib/contas';

// Fecha a conta de uma comanda pelo painel (sem o cliente precisar pedir).
export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  const resultado = await solicitarFechamento(body?.mesa);
  if (resultado.erro) return Response.json({ erro: resultado.erro }, { status: resultado.status });

  const { fechamento, criado } = resultado;
  return Response.json({ ...fechamento, jaSolicitado: !criado }, { status: criado ? 201 : 200 });
}

export async function GET(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const db = supabaseAdmin();

  let query = db.from('csf_fechamentos').select('*').order('criado_em', { ascending: false });
  query = status ? query.eq('status', status) : query.limit(100);

  const { data, error } = await query;
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json(data);
}
