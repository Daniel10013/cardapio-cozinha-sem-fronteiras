import { supabaseAdmin } from './supabaseAdmin';

// Devolve { [pratoId]: "3 un" } com o texto de quantidade cadastrado em cada prato
// (usado nas impressões, ex: "2x Esfiha — 3 un").
export async function porcoesDosPratos(idsPratos) {
  const ids = [...new Set(idsPratos.filter(Boolean))];
  const resultado = {};
  if (!ids.length) return resultado;
  const { data, error } = await supabaseAdmin().from('csf_pratos').select('id, quantidade').in('id', ids);
  if (error) throw error;
  // "1" sozinho não informa nada na impressão ("prato completo (1)"), então fica de fora
  for (const p of data) if (p.quantidade && p.quantidade.trim() !== '1') resultado[p.id] = p.quantidade;
  return resultado;
}

// Devolve { [pratoId]: "texto" } com a observação cadastrada em cada prato (vai na comanda da cozinha).
export async function notasDosPratos(idsPratos) {
  const ids = [...new Set(idsPratos.filter(Boolean))];
  const resultado = {};
  if (!ids.length) return resultado;
  const { data, error } = await supabaseAdmin().from('csf_pratos').select('id, observacao').in('id', ids);
  if (error) throw error;
  for (const p of data) if (p.observacao && p.observacao.trim()) resultado[p.id] = p.observacao.trim();
  return resultado;
}

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
