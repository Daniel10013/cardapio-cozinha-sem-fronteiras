import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { data, error } = await supabaseAdmin().from('pedidos').select('criado_em');
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  const meses = Array.from(new Set((data || []).map((p) => p.criado_em.slice(0, 7)))).sort().reverse();
  return Response.json(meses);
}
