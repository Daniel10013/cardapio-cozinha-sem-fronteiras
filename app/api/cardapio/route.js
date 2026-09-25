import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const db = supabaseAdmin();

  const { data: categorias, error: erroCat } = await db
    .from('csf_categorias')
    .select('id, nome')
    .order('ordem')
    .order('id');
  if (erroCat) return Response.json({ erro: erroCat.message }, { status: 500 });

  const { data: pratos, error: erroPratos } = await db
    .from('csf_pratos')
    .select('id, categoria_id, nome, descricao, preco, foto, tempo_preparo')
    .eq('ativo', true)
    .order('ordem')
    .order('id');
  if (erroPratos) return Response.json({ erro: erroPratos.message }, { status: 500 });

  const resultado = categorias
    .map((cat) => ({
      id: cat.id,
      nome: cat.nome,
      pratos: pratos.filter((p) => p.categoria_id === cat.id),
    }))
    .filter((cat) => cat.pratos.length > 0);

  return Response.json(resultado);
}
