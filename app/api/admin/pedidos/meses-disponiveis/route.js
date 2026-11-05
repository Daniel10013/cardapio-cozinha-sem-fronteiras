import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mesBR } from '@/lib/datas';

export async function GET() {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { data, error } = await supabaseAdmin().from('csf_pedidos').select('criado_em');
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  const meses = Array.from(new Set((data || []).map((p) => mesBR(p.criado_em)))).sort().reverse();
  return Response.json(meses);
}
