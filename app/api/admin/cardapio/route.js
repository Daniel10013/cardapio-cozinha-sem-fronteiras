import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const db = supabaseAdmin();
  const { data: categorias, error: erroCat } = await db.from('csf_categorias').select('*').order('ordem').order('id');
  if (erroCat) return Response.json({ erro: erroCat.message }, { status: 500 });

  const { data: pratos, error: erroPratos } = await db.from('csf_pratos').select('*').order('ordem').order('id');
  if (erroPratos) return Response.json({ erro: erroPratos.message }, { status: 500 });

  const resultado = categorias.map((cat) => ({ ...cat, pratos: pratos.filter((p) => p.categoria_id === cat.id) }));
  return Response.json(resultado);
}
