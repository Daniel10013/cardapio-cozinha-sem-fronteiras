import { supabaseAdmin } from './supabaseAdmin';

// Uma "comanda aberta" são os pedidos de um identificador (ex: "5" ou "5 - Ana")
// feitos depois do último fechamento concluído dele, dentro desta janela.
// (Não usa "início do dia" porque o servidor roda em UTC e dividiria o jantar.)
export const JANELA_HORAS = 18;
const HORA_MS = 3600000;

export function calcularTaxaServico(subtotal) {
  return Math.round(subtotal * 0.1 * 100) / 100;
}

export function normalizarMesa(valor) {
  return String(valor || '').trim().slice(0, 80);
}

export function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => '\\' + c);
}

export async function inicioDaComanda(mesa, ate = new Date()) {
  const ateMs = new Date(ate).getTime();
  const piso = ateMs - JANELA_HORAS * HORA_MS;

  const { data, error } = await supabaseAdmin()
    .from('csf_fechamentos')
    .select('criado_em, concluido_em')
    .eq('mesa', mesa)
    .eq('status', 'concluido')
    .gte('criado_em', new Date(piso - 24 * HORA_MS).toISOString());
  if (error) throw error;

  let inicio = piso;
  for (const f of data || []) {
    const t = new Date(f.concluido_em || f.criado_em).getTime();
    if (t < ateMs && t > inicio) inicio = t;
  }
  return new Date(inicio).toISOString();
}

export async function pedidosDaComanda(mesa, ate = new Date(), { incluirCancelados = false } = {}) {
  const inicio = await inicioDaComanda(mesa, ate);
  let query = supabaseAdmin()
    .from('csf_pedidos')
    .select('*')
    .eq('mesa', mesa)
    .gt('criado_em', inicio)
    .lte('criado_em', new Date(ate).toISOString())
    .order('criado_em');
  if (!incluirCancelados) query = query.neq('status', 'cancelado');

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function subtotalDaMesa(mesa) {
  const pedidos = await pedidosDaComanda(mesa);
  return pedidos.reduce((soma, p) => soma + Number(p.total), 0);
}

// Cria o pedido de fechamento de uma comanda (usado pelo cliente e pelo painel).
// Devolve { erro, status } em caso de falha, ou { fechamento, criado } em caso de sucesso.
// Se já existe um fechamento pendente, devolve ele (criado: false) em vez de duplicar.
export async function solicitarFechamento(mesaBruta) {
  const mesa = normalizarMesa(mesaBruta);
  if (!mesa) return { erro: 'Informe o número da mesa.', status: 400 };

  const db = supabaseAdmin();
  const { data: pendente, error: erroPend } = await db
    .from('csf_fechamentos')
    .select('id, subtotal, taxa_servico, total')
    .eq('mesa', mesa)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (erroPend) return { erro: erroPend.message, status: 500 };
  if (pendente) {
    return {
      criado: false,
      fechamento: {
        id: pendente.id,
        subtotal: Number(pendente.subtotal),
        taxaServico: Number(pendente.taxa_servico),
        total: Number(pendente.total),
      },
    };
  }

  const subtotal = await subtotalDaMesa(mesa);
  if (subtotal <= 0) return { erro: 'Não há pedidos nesta comanda para fechar.', status: 400 };

  const taxaServico = calcularTaxaServico(subtotal);
  const total = subtotal + taxaServico;
  const { data, error } = await db
    .from('csf_fechamentos')
    .insert({
      mesa,
      subtotal,
      taxa_servico: taxaServico,
      incluiu_servico: true,
      total,
      status: 'pendente',
      criado_em: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) return { erro: error.message, status: 500 };

  return { criado: true, fechamento: { id: data.id, subtotal, taxaServico, total } };
}
