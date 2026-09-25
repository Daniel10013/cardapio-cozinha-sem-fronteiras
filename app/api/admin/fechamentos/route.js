import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const db = supabaseAdmin();

  let query = db.from('fechamentos').select('*').order('criado_em', { ascending: false });
  query = status ? query.eq('status', status) : query.limit(100);

  const { data, error } = await query;
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json(data);
}
