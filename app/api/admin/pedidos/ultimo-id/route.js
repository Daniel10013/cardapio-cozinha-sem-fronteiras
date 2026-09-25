import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { data, error } = await supabaseAdmin()
    .from('pedidos')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ ultimoId: data?.id || 0 });
}
