import { supabaseAdmin } from './supabaseAdmin';

// Devolve { [pratoId]: [{ id, nome, tipo, opcoes: [{ id, nome, precoAdicional }] }] }
export async function gruposDosPratos(idsPratos) {
  const resultado = {};
  if (!idsPratos.length) return resultado;
  const db = supabaseAdmin();

  const { data: grupos, error } = await db
    .from('csf_grupos_opcao')
    .select('id, prato_id, nome, tipo')
    .in('prato_id', idsPratos)
    .order('ordem')
    .order('id');
  if (error) throw error;
  if (!grupos.length) return resultado;

  const { data: opcoes, error: erroOpcoes } = await db
    .from('csf_opcoes')
    .select('id, grupo_id, nome, preco_adicional')
    .in('grupo_id', grupos.map((g) => g.id))
    .order('ordem')
    .order('id');
  if (erroOpcoes) throw erroOpcoes;

  for (const g of grupos) {
    (resultado[g.prato_id] ||= []).push({
      id: g.id,
      nome: g.nome,
      tipo: g.tipo,
      opcoes: opcoes
        .filter((o) => o.grupo_id === g.id)
        .map((o) => ({ id: o.id, nome: o.nome, precoAdicional: Number(o.preco_adicional) })),
    });
  }
  return resultado;
}
