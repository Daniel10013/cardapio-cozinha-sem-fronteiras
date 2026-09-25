import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { data, error } = await supabaseAdmin()
    .from('acessos_admin')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(50);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json(data);
}
