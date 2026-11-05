import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { JANELA_HORAS, normalizarMesa, escaparLike } from '@/lib/contas';

const HORA_MS = 3600000;

async function buscarPorMesa(tabela, colunas, mesa, aplicar) {
  const db = supabaseAdmin();
  const exato = aplicar(db.from(tabela).select(colunas).eq('mesa', mesa));
  const separadas = aplicar(db.from(tabela).select(colunas).like('mesa', `${escaparLike(mesa)} - %`));
  const [a, b] = await Promise.all([exato, separadas]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  return [...(a.data || []), ...(b.data || [])];
}

// Lista as comandas abertas de uma mesa (junta e separadas). Só devolve nomes
// e quantidade de pedidos — os valores só aparecem ao abrir a comanda.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mesa = normalizarMesa(searchParams.get('mesa'));
  if (!mesa) return Response.json({ erro: 'Informe o número da mesa.' }, { status: 400 });

  const agora = Date.now();
  const piso = agora - JANELA_HORAS * HORA_MS;

  const pedidos = await buscarPorMesa('csf_pedidos', 'mesa, criado_em', mesa, (q) =>
    q.neq('status', 'cancelado').gt('criado_em', new Date(piso).toISOString())
  );
  const fechamentos = await buscarPorMesa('csf_fechamentos', 'mesa, status, criado_em, concluido_em', mesa, (q) =>
    q.gt('criado_em', new Date(piso - 24 * HORA_MS).toISOString())
  );

  const comandas = new Map();
  for (const p of pedidos) {
    const c = comandas.get(p.mesa) || { id: p.mesa, pedidos: [], inicio: piso, pendente: false };
    c.pedidos.push(new Date(p.criado_em).getTime());
    comandas.set(p.mesa, c);
  }
  for (const f of fechamentos) {
    const c = comandas.get(f.mesa);
    if (!c) continue;
    if (f.status === 'pendente') c.pendente = true;
    if (f.status === 'concluido') {
      const t = new Date(f.concluido_em || f.criado_em).getTime();
      if (t > c.inicio) c.inicio = t;
    }
  }

  const abertas = [];
  for (const c of comandas.values()) {
    const qtd = c.pedidos.filter((t) => t > c.inicio).length;
    if (qtd === 0) continue;
    const tipo = c.id === mesa ? 'junta' : 'separada';
    abertas.push({
      id: c.id,
      tipo,
      nome: tipo === 'separada' ? c.id.slice(mesa.length + 3) : '',
      pedidos: qtd,
      pendente: c.pendente,
    });
  }
  abertas.sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : a.tipo === 'junta' ? -1 : 1));

  return Response.json({ mesa, comandas: abertas });
}
