'use client';

import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Largura do papel da impressora térmica deste computador (50, 58 ou 80 mm).
const CHAVE_PAPEL = 'csf_papel_mm';
function larguraPapelMm() {
  try {
    const n = Number(localStorage.getItem(CHAVE_PAPEL));
    return n >= 40 && n <= 110 ? n : 58;
  } catch {
    return 58;
  }
}

function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function api(caminho, opcoes) {
  const resp = await fetch('/api/admin' + caminho, {
    headers: opcoes?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...opcoes,
  });
  let dados = null;
  try {
    dados = await resp.json();
  } catch (e) {
    /* sem corpo */
  }
  if (!resp.ok) throw new Error((dados && dados.erro) || 'Erro na requisição');
  return dados;
}

export default function PainelAdmin() {
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [config, setConfig] = useState({ nomeLoja: 'Cozinha Sem Fronteiras', logoUrl: '' });

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => {
        setConfig(c);
        document.title = c.nomeLoja + ' — Painel';
      })
      .catch(() => {});

    api('/sessao')
      .then(({ autenticado }) => setAutenticado(autenticado))
      .finally(() => setVerificandoSessao(false));
  }, []);

  if (verificandoSessao) return null;

  if (!autenticado) {
    return <TelaLogin config={config} onLogin={() => setAutenticado(true)} />;
  }

  return <Painel config={config} onLogout={() => setAutenticado(false)} onConfigAtualizado={setConfig} />;
}

function TelaLogin({ config, onLogin }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    setErro('');
    setEntrando(true);
    try {
      await api('/login', { method: 'POST', body: JSON.stringify({ senha }) });
      onLogin();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        {config.logoUrl && <img src={config.logoUrl} className="logo-login" alt="Logo" />}
        <h1>{config.nomeLoja}</h1>
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && entrar()}
        />
        <div className="erro">{erro}</div>
        <button onClick={entrar} disabled={entrando} type="button">
          Entrar
        </button>
      </div>
    </div>
  );
}

function tocarTom(frequencias, { tipo = 'sine', volume = 0.4, duracao = 0.3 } = {}) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    frequencias.forEach(([freq, atraso]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tipo;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + atraso);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + atraso + 0.02);
      gain.gain.setValueAtTime(volume, ctx.currentTime + atraso + duracao - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atraso + duracao);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + atraso);
      osc.stop(ctx.currentTime + atraso + duracao + 0.02);
    });
  } catch (e) {
    /* navegador sem suporte a áudio */
  }
}

// Alarme de pedido novo: sirene alternando dois tons, ~6 segundos, volume máximo.
function tocarAlarmePedido() {
  const notas = [];
  for (let i = 0; i < 16; i++) notas.push([i % 2 === 0 ? 880 : 1175, i * 0.38]);
  tocarTom(notas, { tipo: 'square', volume: 1, duracao: 0.36 });
}

function Painel({ config, onLogout, onConfigAtualizado }) {
  const [aba, setAba] = useState('pedidos');
  const [lojaAberta, setLojaAberta] = useState(true);
  const [fechamentosPendentes, setFechamentosPendentes] = useState([]);
  const [reciboHtml, setReciboHtml] = useState(null);

  const ultimoIdPedido = useRef(null);
  const ultimoIdFechamento = useRef(null);
  const [gatilhoAtualizacao, setGatilhoAtualizacao] = useState(0);

  const carregarStatusLoja = useCallback(() => {
    api('/loja').then(({ aberto }) => setLojaAberta(aberto));
  }, []);

  const carregarFechamentos = useCallback(() => {
    api('/fechamentos?status=pendente').then(setFechamentosPendentes);
  }, []);

  useEffect(() => {
    carregarStatusLoja();
    carregarFechamentos();

    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const intervalo = setInterval(async () => {
      try {
        const { ultimoId } = await api('/pedidos/ultimo-id');
        if (ultimoIdPedido.current === null) {
          ultimoIdPedido.current = ultimoId;
        } else if (ultimoId > ultimoIdPedido.current) {
          tocarAlarmePedido();
          if (window.Notification && Notification.permission === 'granted') {
            const qtd = ultimoId - ultimoIdPedido.current;
            new Notification('Novo pedido recebido!', {
              body: qtd > 1 ? `${qtd} novos pedidos chegaram.` : 'Um novo pedido acabou de chegar.',
            });
          }
          ultimoIdPedido.current = ultimoId;
          setGatilhoAtualizacao((n) => n + 1);
        }
      } catch (e) {
        /* tenta de novo no próximo ciclo */
      }

      try {
        const { ultimoId } = await api('/fechamentos/ultimo-id');
        if (ultimoIdFechamento.current === null) {
          ultimoIdFechamento.current = ultimoId;
        } else if (ultimoId > ultimoIdFechamento.current) {
          const pendentes = await api('/fechamentos?status=pendente');
          const recentes = pendentes.filter((f) => f.id > ultimoIdFechamento.current);
          recentes.forEach((f) => {
            tocarTom([[520, 0], [520, 0.22], [520, 0.44]]);
            if (window.Notification && Notification.permission === 'granted') {
              new Notification('Pedido para fechar conta!', {
                body: `Mesa ${f.mesa} quer fechar a conta — ${formatarMoeda(f.total)}`,
              });
            }
          });
          ultimoIdFechamento.current = ultimoId;
          carregarFechamentos();
        }
      } catch (e) {
        /* tenta de novo no próximo ciclo */
      }
    }, 6000);

    return () => clearInterval(intervalo);
  }, [carregarFechamentos]);

  async function sair() {
    await api('/logout', { method: 'POST' });
    onLogout();
  }

  async function alternarLoja(aberto) {
    setLojaAberta(aberto);
    await api('/loja', { method: 'POST', body: JSON.stringify({ aberto }) });
  }

  async function imprimirConta(id) {
    const detalhe = await api(`/fechamentos/${id}/detalhe`);
    const hora = new Date(detalhe.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    setReciboHtml({ ...detalhe, hora, nomeLoja: config.nomeLoja });
  }

  function imprimirCozinha(pedido) {
    const hora = new Date(pedido.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    setReciboHtml({
      cozinha: true,
      pedidoId: pedido.id,
      mesa: pedido.mesa || '-',
      hora,
      observacao: pedido.observacao,
      itens: [...pedido.itens]
        .sort((a, b) => a.id - b.id)
        .map((i) => ({
        quantidade: i.quantidade,
        nome: i.nome_prato,
        porcao: i.porcao,
        opcoes: i.opcoes,
      })),
    });
  }

  useEffect(() => {
    if (!reciboHtml) return;
    document.body.classList.add('imprimindo-recibo');
    // Papel da impressora térmica: 50mm de largura. O comprimento é medido do próprio
    // conteúdo, porque "auto" não é respeitado e o cupom era cortado no meio.
    // Margem da página = 0 (assim o navegador também não imprime data/endereço do site);
    // a folga lateral fica dentro do próprio cupom.
    const papelMm = larguraPapelMm();
    const conteudoMm = papelMm - 10;
    let alturaMm = 120;
    const recibo = document.getElementById('recibo-impressao');
    if (recibo) {
      const anterior = recibo.getAttribute('style');
      recibo.style.cssText = `display:block;position:absolute;visibility:hidden;width:${conteudoMm}mm;padding:0;margin:0;`;
      alturaMm = Math.ceil((recibo.getBoundingClientRect().height * 25.4) / 96) + 14;
      if (anterior === null) recibo.removeAttribute('style');
      else recibo.setAttribute('style', anterior);
    }
    document.body.style.setProperty('--papel', `${papelMm}mm`);
    document.body.style.setProperty('--recibo-largura', `${conteudoMm}mm`);
    const estilo = document.createElement('style');
    estilo.textContent = `@page { size: ${papelMm}mm ${alturaMm}mm; margin: 0; }`;
    document.head.appendChild(estilo);
    window.print();
    const limpar = () => {
      document.body.classList.remove('imprimindo-recibo');
      document.body.style.removeProperty('--papel');
      document.body.style.removeProperty('--recibo-largura');
      estilo.remove();
    };
    window.addEventListener('afterprint', limpar, { once: true });
    return () => {
      window.removeEventListener('afterprint', limpar);
      limpar();
    };
  }, [reciboHtml]);

  async function fecharContaManual(mesa) {
    try {
      const r = await api('/fechamentos', { method: 'POST', body: JSON.stringify({ mesa }) });
      carregarFechamentos();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (r.jaSolicitado) {
        alert(`A conta de "${mesa}" já está em "Contas para fechar" (${formatarMoeda(r.total)}).`);
      } else if (confirm(`Conta de "${mesa}" criada: ${formatarMoeda(r.total)} (com 10% de serviço).\n\nImprimir agora?`)) {
        imprimirConta(r.id);
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function concluirFechamento(id) {
    await api(`/fechamentos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'concluido' }) });
    carregarFechamentos();
  }

  return (
    <div className="painel">
      <header className="topo">
        <div className="topo-marca">
          {config.logoUrl && <img src={config.logoUrl} className="logo-topo-admin" alt="Logo" />}
          <h1>{config.nomeLoja}</h1>
        </div>
        <div className="topo-acoes">
          <label className="switch-loja">
            <input type="checkbox" checked={lojaAberta} onChange={(e) => alternarLoja(e.target.checked)} />
            <span>{lojaAberta ? 'Loja aberta' : 'Loja fechada'}</span>
          </label>
          <button onClick={sair} type="button">
            Sair
          </button>
        </div>
      </header>

      <nav className="abas">
        {[
          ['pedidos', 'Pedidos'],
          ['relatorio', 'Relatório'],
          ['cardapio', 'Cardápio'],
          ['qrcodes', 'QR Codes'],
          ['config', 'Configurações'],
        ].map(([id, rotulo]) => (
          <button key={id} className={aba === id ? 'ativa' : ''} onClick={() => setAba(id)} type="button">
            {rotulo}
          </button>
        ))}
      </nav>

      <main>
        {aba === 'pedidos' && (
          <AbaPedidos
            fechamentosPendentes={fechamentosPendentes}
            onImprimirConta={imprimirConta}
            onConcluirFechamento={concluirFechamento}
            onFecharConta={fecharContaManual}
            onImprimirCozinha={imprimirCozinha}
            gatilhoAtualizacao={gatilhoAtualizacao}
          />
        )}
        {aba === 'relatorio' && <AbaRelatorio gatilhoAtualizacao={gatilhoAtualizacao} />}
        {aba === 'cardapio' && <AbaCardapio />}
        {aba === 'qrcodes' && <AbaQrCodes />}
        {aba === 'config' && <AbaConfig config={config} onConfigAtualizado={onConfigAtualizado} />}
      </main>

      {reciboHtml && reciboHtml.cozinha && createPortal(
        <div id="recibo-impressao" className="recibo-cozinha">
          <h2>COZINHA — PEDIDO Nº {reciboHtml.pedidoId}</h2>
          <div className="recibo-mesa">
            {/^\d+$/.test(String(reciboHtml.mesa)) ? `MESA ${reciboHtml.mesa}` : String(reciboHtml.mesa).toUpperCase()}
          </div>
          <div className="recibo-subtitulo">{reciboHtml.hora}</div>
          <div className="recibo-linha-sep" />
          {reciboHtml.itens.map((i, idx) => (
            <div className="recibo-cozinha-item" key={idx}>
              <strong>
                {i.quantidade}x {i.nome}
                {i.porcao ? ` (${i.porcao})` : ''}
              </strong>
              {i.opcoes && <div className="recibo-cozinha-opcoes">{i.opcoes.split(' · ').map((o, k) => <div key={k}>• {o}</div>)}</div>}
            </div>
          ))}
          {reciboHtml.observacao && (
            <>
              <div className="recibo-linha-sep" />
              <div className="recibo-cozinha-obs">OBS: {reciboHtml.observacao}</div>
            </>
          )}
        </div>,
        document.body
      )}

      {reciboHtml && !reciboHtml.cozinha && createPortal(
        <div id="recibo-impressao">
          <h2>{reciboHtml.nomeLoja.toUpperCase()}</h2>
          <div className="recibo-subtitulo">
            Mesa {reciboHtml.mesa} — {reciboHtml.hora}
          </div>
          <div className="recibo-linha-sep" />
          {reciboHtml.itens.map((i, idx) => (
            <div className="recibo-item" key={idx}>
              <span>
                {i.quantidade}x {i.nome}
                {i.porcao ? ` (${i.porcao})` : ''}
                {i.opcoes && <small style={{ display: 'block', fontSize: '0.85em' }}>{i.opcoes}</small>}
              </span>
              <span>{formatarMoeda(i.subtotal)}</span>
            </div>
          ))}
          <div className="recibo-linha-sep" />
          <div className="recibo-total-linha">
            <span>Subtotal</span>
            <span>{formatarMoeda(reciboHtml.totalSemServico)}</span>
          </div>
          <div className="recibo-total-linha">
            <span>Serviço (10%)</span>
            <span>{formatarMoeda(reciboHtml.taxaServico)}</span>
          </div>
          <div className="recibo-total-linha destaque">
            <span>TOTAL A PAGAR</span>
            <span>{formatarMoeda(reciboHtml.totalComServico)}</span>
          </div>
          <div className="recibo-subtitulo" style={{ marginTop: 10 }}>
            Obrigado pela preferência!
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function formatarMesLabel(m) {
  const [ano, mes] = m.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[Number(mes) - 1]}/${ano}`;
}

function AbaPedidos({
  fechamentosPendentes,
  onImprimirConta,
  onConcluirFechamento,
  onFecharConta,
  onImprimirCozinha,
  gatilhoAtualizacao,
}) {
  const [meses, setMeses] = useState([]);
  const [mes, setMes] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [resumo, setResumo] = useState({ totalPedidos: 0, faturamento: 0 });
  const [expandidoId, setExpandidoId] = useState(null);

  const carregarPedidos = useCallback((mesAtual) => {
    if (!mesAtual) return;
    api('/pedidos?mes=' + mesAtual).then(setPedidos);
    api('/resumo?mes=' + mesAtual).then(setResumo);
  }, []);

  useEffect(() => {
    api('/pedidos/meses-disponiveis').then((disponiveis) => {
      const mesAtual = diaBR(new Date().toISOString()).slice(0, 7);
      const lista = disponiveis.includes(mesAtual) ? disponiveis : [mesAtual, ...disponiveis];
      setMeses(lista);
      setMes(mesAtual);
    });
  }, []);

  useEffect(() => {
    carregarPedidos(mes);
  }, [mes, carregarPedidos, gatilhoAtualizacao]);

  // Contas já concluídas: o pedido feito antes do fechamento (na mesma comanda) aparece como "Fechado".
  const [concluidos, setConcluidos] = useState([]);
  useEffect(() => {
    api('/fechamentos?status=concluido').then(setConcluidos).catch(() => {});
  }, [fechamentosPendentes, gatilhoAtualizacao]);

  function contaFechada(p) {
    const criado = new Date(p.criado_em).getTime();
    return concluidos.some((f) => {
      const t = new Date(f.criado_em).getTime();
      return f.mesa === p.mesa && t >= criado && t - criado < 18 * 3600000;
    });
  }

  async function alterarStatus(id, status) {
    await api(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    setPedidos((atual) => atual.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  return (
    <>
      {fechamentosPendentes.length > 0 && (
        <div className="cartao" id="cartao-fechamentos">
          <h3>Contas para fechar</h3>
          <div>
            {fechamentosPendentes.map((f) => {
              const hora = new Date(f.criado_em).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div className="fechamento-linha" key={f.id}>
                  <div className="info">
                    <strong>Mesa {f.mesa}</strong> às {hora} —{' '}
                    <span className="valor-destaque">{formatarMoeda(f.total)}</span> (já com 10% de serviço)
                  </div>
                  <div>
                    <button className="btn-secundario" onClick={() => onImprimirConta(f.id)} type="button">
                      Imprimir conta
                    </button>
                    <button className="btn" onClick={() => onConcluirFechamento(f.id)} type="button">
                      Concluído
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="linha-form">
        <select value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => (
            <option key={m} value={m}>
              {formatarMesLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="resumo-grid">
        <div className="cartao">
          <div className="valor">{formatarMoeda(resumo.faturamento)}</div>
          <div className="rotulo">Faturamento do mês</div>
        </div>
        <div className="cartao">
          <div className="valor">{resumo.totalPedidos}</div>
          <div className="rotulo">Pedidos no mês</div>
        </div>
      </div>

      <div className="cartao">
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Mesa</th>
              <th>Itens</th>
              <th>Total</th>
              <th>Status</th>
              <th>Cozinha</th>
              <th>Conta</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>
                  Nenhum pedido neste mês.
                </td>
              </tr>
            )}
            {pedidos.map((p) => {
              const hora = new Date(p.criado_em).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              const aberto = expandidoId === p.id;
              const totalItens = p.itens.reduce((soma, i) => soma + i.quantidade, 0);
              const fechado = p.status !== 'cancelado' && contaFechada(p);
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => setExpandidoId(aberto ? null : p.id)}
                    style={{ cursor: 'pointer', background: aberto ? '#faf7f2' : undefined }}
                  >
                    <td>{hora}</td>
                    <td>{p.mesa || '-'}</td>
                    <td>
                      {aberto ? '▾' : '▸'} {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                      <span style={{ color: '#888' }}> — clique para ver</span>
                    </td>
                    <td>{formatarMoeda(p.total)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {fechado ? (
                        <strong style={{ color: '#2e7d32' }}>✔ Fechado</strong>
                      ) : (
                        <select value={p.status} onChange={(e) => alterarStatus(p.id, e.target.value)}>
                          {['recebido', 'em preparo', 'pronto', 'entregue', 'cancelado'].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {p.status !== 'cancelado' && (
                        <button className="btn-secundario" onClick={() => onImprimirCozinha(p)} type="button">
                          Imprimir
                        </button>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {!fechado && p.status !== 'cancelado' && p.mesa && (
                        <button className="btn-secundario" onClick={() => onFecharConta(p.mesa)} type="button">
                          Fechar conta
                        </button>
                      )}
                    </td>
                  </tr>
                  {aberto && (
                    <tr style={{ background: '#faf7f2' }}>
                      <td colSpan={7}>
                        {p.itens.map((i) => (
                          <div
                            key={i.id}
                            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}
                          >
                            <span>
                              <strong>{i.quantidade}x</strong> {i.nome_prato}
                              {i.porcao ? ` (${i.porcao})` : ''}
                              {i.opcoes && <div style={{ color: '#7a5a12', fontSize: '0.85rem' }}>{i.opcoes}</div>}
                            </span>
                            <span style={{ color: '#555' }}>
                              {formatarMoeda(i.preco_unitario)} cada — <strong>{formatarMoeda(i.subtotal)}</strong>
                            </span>
                          </div>
                        ))}
                        {p.observacao && (
                          <div style={{ marginTop: 6, color: '#7a5a12' }}>
                            <strong>Observação:</strong> {p.observacao}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function formatarDiaLabel(diaIso) {
  const [, mes, dia] = diaIso.split('-');
  const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dataObj = new Date(diaIso + 'T12:00:00');
  return `${dia}/${mes} (${nomesDias[dataObj.getDay()]})`;
}

// Dia (YYYY-MM-DD) no horário de Brasília — igual ao usado no servidor (lib/datas.js).
function diaBR(iso) {
  return new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10);
}

function AbaRelatorio({ gatilhoAtualizacao }) {
  const [meses, setMeses] = useState([]);
  const [mes, setMes] = useState('');
  const [resumo, setResumo] = useState({ totalPedidos: 0, faturamento: 0, porDia: [] });
  const [pedidosDoMes, setPedidosDoMes] = useState([]);
  const [diaAberto, setDiaAberto] = useState(null);

  useEffect(() => {
    api('/pedidos/meses-disponiveis').then((disponiveis) => {
      const mesAtual = diaBR(new Date().toISOString()).slice(0, 7);
      const lista = disponiveis.includes(mesAtual) ? disponiveis : [mesAtual, ...disponiveis];
      setMeses(lista);
      setMes(mesAtual);
    });
  }, []);

  useEffect(() => {
    if (!mes) return;
    api('/resumo?mes=' + mes).then(setResumo);
    api('/pedidos?mes=' + mes).then(setPedidosDoMes);
  }, [mes, gatilhoAtualizacao]);

  useEffect(() => {
    setDiaAberto(null);
  }, [mes]);

  const ticketMedio = resumo.totalPedidos > 0 ? resumo.faturamento / resumo.totalPedidos : 0;
  const maiorFaturamento = Math.max(0, ...resumo.porDia.map((d) => d.faturamento));

  return (
    <>
      <div className="linha-form">
        <select value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => (
            <option key={m} value={m}>
              {formatarMesLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="resumo-grid">
        <div className="cartao">
          <div className="valor">{formatarMoeda(resumo.faturamento)}</div>
          <div className="rotulo">Faturamento do mês</div>
        </div>
        <div className="cartao">
          <div className="valor">{resumo.totalPedidos}</div>
          <div className="rotulo">Pedidos no mês</div>
        </div>
        <div className="cartao">
          <div className="valor">{formatarMoeda(ticketMedio)}</div>
          <div className="rotulo">Ticket médio</div>
        </div>
      </div>

      <div className="cartao">
        <h3>Vendas por dia</h3>
        {resumo.porDia.length === 0 && <p style={{ color: '#888' }}>Nenhuma venda neste mês.</p>}
        {resumo.porDia
          .slice()
          .reverse()
          .map((d) => {
            const largura = maiorFaturamento > 0 ? Math.round((d.faturamento / maiorFaturamento) * 100) : 0;
            const aberto = diaAberto === d.dia;
            const pedidosDoDia = pedidosDoMes
              .filter((p) => p.status !== 'cancelado' && diaBR(p.criado_em) === d.dia)
              .sort((a, b) => a.criado_em.localeCompare(b.criado_em));
            return (
              <Fragment key={d.dia}>
                <div
                  className="dia-linha"
                  onClick={() => setDiaAberto(aberto ? null : d.dia)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="dia-data">
                    {aberto ? '▾' : '▸'} {formatarDiaLabel(d.dia)}
                  </div>
                  <div className="dia-barra-fundo">
                    <div className="dia-barra" style={{ width: largura + '%' }} />
                  </div>
                  <div className="dia-valores">
                    {formatarMoeda(d.faturamento)} · {d.pedidos} pedido{d.pedidos === 1 ? '' : 's'}
                  </div>
                </div>
                {aberto && (
                  <div style={{ background: '#faf7f2', borderRadius: 8, padding: '6px 12px', margin: '4px 0 10px' }}>
                    {pedidosDoDia.length === 0 && <p style={{ color: '#888' }}>Carregando pedidos...</p>}
                    {pedidosDoDia.map((p) => (
                      <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span>
                            <strong>
                              {new Date(p.criado_em).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </strong>{' '}
                            — {p.mesa || 'sem mesa'}
                          </span>
                          <span>
                            <strong>{formatarMoeda(p.total)}</strong>{' '}
                            <span style={{ color: '#888', fontSize: '0.8rem' }}>({p.status})</span>
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#555' }}>
                          {p.itens
                            .map((i) => `${i.quantidade}x ${i.nome_prato}${i.opcoes ? ` (${i.opcoes})` : ''}`)
                            .join(', ')}
                        </div>
                        {p.observacao && (
                          <div style={{ fontSize: '0.85rem', color: '#7a5a12' }}>Obs: {p.observacao}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
      </div>
    </>
  );
}

function AbaCardapio() {
  const [categorias, setCategorias] = useState([]);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');

  const carregar = useCallback(() => {
    api('/cardapio').then(setCategorias);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionarCategoria() {
    if (!novaCategoriaNome.trim()) return;
    await api('/categorias', { method: 'POST', body: JSON.stringify({ nome: novaCategoriaNome.trim() }) });
    setNovaCategoriaNome('');
    carregar();
  }

  async function excluirCategoria(id) {
    try {
      await api('/categorias/' + id, { method: 'DELETE' });
      carregar();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <div className="cartao">
        <h3>Nova categoria</h3>
        <div className="linha-form">
          <input
            type="text"
            placeholder="Nome da categoria"
            value={novaCategoriaNome}
            onChange={(e) => setNovaCategoriaNome(e.target.value)}
          />
          <button className="btn" onClick={adicionarCategoria} type="button">
            Adicionar
          </button>
        </div>
      </div>

      {categorias.map((cat) => (
        <CategoriaBloco key={cat.id} categoria={cat} onExcluir={excluirCategoria} onAtualizar={carregar} />
      ))}
    </>
  );
}

function CategoriaBloco({ categoria, onExcluir, onAtualizar }) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [tempoPreparo, setTempoPreparo] = useState('');
  const [peso, setPeso] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [novoPratoId, setNovoPratoId] = useState(null);

  async function adicionarPrato() {
    if (!nome || !preco) return alert('Preencha nome e preço do prato.');
    const criado = await api('/pratos', {
      method: 'POST',
      body: JSON.stringify({ categoriaId: categoria.id, nome, descricao, preco, tempoPreparo, peso, quantidade }),
    });
    setNovoPratoId(criado.id);
    setNome('');
    setDescricao('');
    setPreco('');
    setTempoPreparo('');
    setPeso('');
    setQuantidade('');
    onAtualizar();
  }

  async function renomear() {
    const novoNome = prompt('Novo nome da categoria:', categoria.nome);
    if (novoNome === null) return;
    if (!novoNome.trim()) return alert('O nome não pode ficar vazio.');
    try {
      await api('/categorias/' + categoria.id, { method: 'PATCH', body: JSON.stringify({ nome: novoNome.trim() }) });
      onAtualizar();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="cartao categoria-bloco">
      <h3>
        {categoria.nome}
        <span>
          <button className="btn-secundario" onClick={renomear} type="button" style={{ marginRight: 8 }}>
            Renomear
          </button>
          <button className="btn-perigo" onClick={() => onExcluir(categoria.id)} type="button">
            Excluir categoria
          </button>
        </span>
      </h3>
      <div>
        {categoria.pratos.length === 0 && <p style={{ color: '#888', fontSize: '0.9rem' }}>Nenhum prato ainda.</p>}
        {categoria.pratos.map((p) => (
          <PratoLinha
            key={p.id}
            prato={p}
            irmaos={categoria.pratos}
            abrirOpcoes={p.id === novoPratoId}
            onAtualizar={onAtualizar}
          />
        ))}
      </div>
      <div className="linha-form" style={{ marginTop: 10 }}>
        <input type="text" placeholder="Nome do prato" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input
          type="text"
          placeholder="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <input
          type="number"
          placeholder="Preço"
          step="0.01"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          style={{ maxWidth: 100 }}
        />
        <input
          type="number"
          placeholder="Preparo (min)"
          min="0"
          value={tempoPreparo}
          onChange={(e) => setTempoPreparo(e.target.value)}
          style={{ maxWidth: 120 }}
        />
        <input
          type="text"
          placeholder="Peso (ex: 300g)"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          style={{ maxWidth: 130 }}
        />
        <input
          type="text"
          placeholder="Qtd (ex: 6 unid.)"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          style={{ maxWidth: 130 }}
        />
        <button className="btn" onClick={adicionarPrato} type="button">
          Adicionar prato
        </button>
      </div>
      <p style={{ fontSize: '0.85rem', color: '#666', margin: '6px 0 0' }}>
        Dica: arroz, proteína, pastas, salada e adicionais são cadastrados depois de criar o prato, no botão{' '}
        <b>Opções</b> que aparece na linha dele (abre sozinho ao criar).
      </p>
    </div>
  );
}

const SUGESTOES_GRUPO = [
  { nome: 'Arroz', tipo: 'unica' },
  { nome: 'Proteína', tipo: 'unica' },
  { nome: 'Pastas', tipo: 'unica' },
  { nome: 'Salada', tipo: 'unica' },
  { nome: 'Adicionais', tipo: 'extra' },
  {
    nome: 'Gelo e limão',
    tipo: 'unica',
    opcoes: [
      { nome: 'Com gelo e limão', precoAdicional: '' },
      { nome: 'Só o copo', precoAdicional: '' },
    ],
  },
];

function EditorOpcoes({ prato, irmaos, onFechar }) {
  const [grupos, setGrupos] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [copiarDe, setCopiarDe] = useState('');

  useEffect(() => {
    api('/pratos/' + prato.id + '/opcoes')
      .then((lista) =>
        setGrupos(
          lista.map((g) => ({
            nome: g.nome,
            tipo: g.tipo,
            opcoes: g.opcoes.map((o) => ({ nome: o.nome, precoAdicional: String(o.precoAdicional || '') })),
          })),
        ),
      )
      .catch((err) => {
        alert(err.message);
        onFechar();
      });
  }, [prato.id]);

  function mudarGrupo(gi, mudanca) {
    setGrupos((atual) => atual.map((g, i) => (i === gi ? { ...g, ...mudanca } : g)));
  }
  function mudarOpcao(gi, oi, mudanca) {
    setGrupos((atual) =>
      atual.map((g, i) =>
        i === gi ? { ...g, opcoes: g.opcoes.map((o, j) => (j === oi ? { ...o, ...mudanca } : o)) } : g,
      ),
    );
  }
  function novaOpcao() {
    return { nome: '', precoAdicional: '' };
  }

  async function copiar() {
    if (!copiarDe) return;
    if (grupos.length && !confirm('Isso troca as opções que estão na tela pelas do outro prato. Continuar?')) return;
    try {
      const lista = await api('/pratos/' + copiarDe + '/opcoes');
      setGrupos(
        lista.map((g) => ({
          nome: g.nome,
          tipo: g.tipo,
          opcoes: g.opcoes.map((o) => ({ nome: o.nome, precoAdicional: String(o.precoAdicional || '') })),
        })),
      );
    } catch (err) {
      alert(err.message);
    }
  }

  async function salvar(paraTodos = false) {
    if (
      paraTodos &&
      !confirm(
        `Isso salva estas opções em "${prato.nome}" e também em TODOS os outros pratos desta categoria (${outros.length}), trocando as opções que eles já têm. Continuar?`,
      )
    ) {
      return;
    }
    setSalvando(true);
    try {
      const corpo = JSON.stringify({ grupos });
      await api('/pratos/' + prato.id + '/opcoes', { method: 'PUT', body: corpo });
      if (paraTodos) {
        for (const p of outros) await api('/pratos/' + p.id + '/opcoes', { method: 'PUT', body: corpo });
      }
      onFechar(paraTodos ? 'todos' : true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvando(false);
    }
  }

  if (!grupos) return <div style={{ padding: 10, color: '#888' }}>Carregando opções...</div>;

  const outros = (irmaos || []).filter((p) => p.id !== prato.id);

  return (
    <div style={{ background: '#faf7f2', padding: 12, borderRadius: 8, margin: '4px 0 10px' }}>
      <strong>Opções de “{prato.nome}”</strong>
      <p style={{ fontSize: '0.85rem', color: '#666', margin: '4px 0 10px' }}>
        <b>Escolher 1</b>: o cliente é obrigado a escolher uma opção do grupo (ex: Arroz). <b>Adicional</b>: o cliente
        marca quantos quiser e paga o valor extra de cada um.
      </p>

      {grupos.map((g, gi) => (
        <div key={gi} style={{ background: '#fff', border: '1px solid #e5ddd0', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div className="linha-form" style={{ marginBottom: 6 }}>
            <input
              type="text"
              placeholder="Nome do grupo (ex: Arroz)"
              value={g.nome}
              onChange={(e) => mudarGrupo(gi, { nome: e.target.value })}
            />
            <select value={g.tipo} onChange={(e) => mudarGrupo(gi, { tipo: e.target.value })}>
              <option value="unica">Escolher 1 (obrigatório)</option>
              <option value="extra">Adicional (cobrado à parte)</option>
            </select>
            <button
              className="btn-perigo"
              type="button"
              onClick={() => setGrupos((atual) => atual.filter((_, i) => i !== gi))}
            >
              Remover grupo
            </button>
          </div>
          {g.opcoes.map((o, oi) => (
            <div className="linha-form" key={oi} style={{ marginBottom: 4 }}>
              <input
                type="text"
                placeholder="Opção (ex: Arroz branco)"
                value={o.nome}
                onChange={(e) => mudarOpcao(gi, oi, { nome: e.target.value })}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={g.tipo === 'extra' ? 'Valor a mais (R$)' : 'Valor a mais (opcional)'}
                value={o.precoAdicional}
                onChange={(e) => mudarOpcao(gi, oi, { precoAdicional: e.target.value })}
                style={{ maxWidth: 160 }}
              />
              <button
                className="btn-secundario"
                type="button"
                onClick={() =>
                  mudarGrupo(gi, { opcoes: g.opcoes.filter((_, j) => j !== oi) })
                }
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn-secundario"
            type="button"
            onClick={() => mudarGrupo(gi, { opcoes: [...g.opcoes, novaOpcao()] })}
          >
            + Adicionar opção
          </button>
        </div>
      ))}

      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>Adicionar grupo: </span>
        {SUGESTOES_GRUPO.map((s) => (
          <button
            key={s.nome}
            className="btn-secundario"
            type="button"
            style={{ marginRight: 6, marginBottom: 4 }}
            onClick={() =>
              setGrupos((atual) => [...atual, { ...s, opcoes: s.opcoes ? s.opcoes.map((o) => ({ ...o })) : [novaOpcao()] }])
            }
          >
            + {s.nome}
          </button>
        ))}
        <button
          className="btn-secundario"
          type="button"
          style={{ marginBottom: 4 }}
          onClick={() => setGrupos((atual) => [...atual, { nome: '', tipo: 'unica', opcoes: [novaOpcao()] }])}
        >
          + Outro
        </button>
      </div>

      {outros.length > 0 && (
        <div className="linha-form">
          <select value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)}>
            <option value="">Copiar opções de outro prato...</option>
            {outros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <button className="btn-secundario" type="button" onClick={copiar} disabled={!copiarDe}>
            Copiar
          </button>
        </div>
      )}

      <div className="linha-form" style={{ marginBottom: 0 }}>
        <button className="btn" type="button" onClick={() => salvar(false)} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar opções'}
        </button>
        {outros.length > 0 && (
          <button className="btn-secundario" type="button" onClick={() => salvar(true)} disabled={salvando}>
            Salvar e aplicar a todos desta categoria
          </button>
        )}
        <button className="btn-secundario" type="button" onClick={() => onFechar()}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function PratoLinha({ prato, irmaos, abrirOpcoes, onAtualizar }) {
  const inputFotoRef = useRef(null);

  const [editandoOpcoes, setEditandoOpcoes] = useState(!!abrirOpcoes);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});

  function abrirEdicao() {
    setForm({
      nome: prato.nome,
      descricao: prato.descricao || '',
      preco: String(prato.preco),
      tempoPreparo: String(prato.tempo_preparo || 0),
      peso: prato.peso || '',
      quantidade: prato.quantidade || '',
    });
    setEditando(true);
  }

  async function salvarEdicao() {
    if (!form.nome.trim() || form.preco === '') return alert('Preencha nome e preço do prato.');
    try {
      await api('/pratos/' + prato.id, { method: 'PATCH', body: JSON.stringify(form) });
      setEditando(false);
      onAtualizar();
    } catch (err) {
      alert(err.message);
    }
  }

  async function alternarAtivo() {
    await api('/pratos/' + prato.id, { method: 'PATCH', body: JSON.stringify({ ativo: !prato.ativo }) });
    onAtualizar();
  }

  async function excluir() {
    if (!confirm('Excluir este prato?')) return;
    await api('/pratos/' + prato.id, { method: 'DELETE' });
    onAtualizar();
  }

  async function enviarFoto(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const formData = new FormData();
    formData.append('foto', arquivo);
    try {
      const resp = await fetch('/api/admin/pratos/' + prato.id + '/foto', { method: 'POST', body: formData });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || 'Erro ao enviar imagem.');
      onAtualizar();
    } catch (err) {
      alert(err.message);
    }
    e.target.value = '';
  }

  async function removerFoto() {
    if (!confirm('Remover a foto deste prato?')) return;
    await api('/pratos/' + prato.id + '/foto', { method: 'DELETE' });
    onAtualizar();
  }

  if (editando) {
    const campo = (chave, placeholder, extra = {}) => (
      <input
        type="text"
        placeholder={placeholder}
        value={form[chave]}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
        {...extra}
      />
    );
    return (
      <div className="prato-linha" style={{ background: '#faf7f2', padding: 10, borderRadius: 8 }}>
        <div className="linha-form" style={{ width: '100%', marginBottom: 0 }}>
          {campo('nome', 'Nome do prato')}
          {campo('descricao', 'Descrição (opcional)')}
          {campo('preco', 'Preço', { type: 'number', step: '0.01', style: { maxWidth: 100 } })}
          {campo('tempoPreparo', 'Preparo (min)', { type: 'number', min: '0', style: { maxWidth: 120 } })}
          {campo('peso', 'Peso (ex: 300g)', { style: { maxWidth: 130 } })}
          {campo('quantidade', 'Qtd (ex: 6 unid.)', { style: { maxWidth: 130 } })}
          <button className="btn" onClick={salvarEdicao} type="button">
            Salvar
          </button>
          <button className="btn-secundario" onClick={() => setEditando(false)} type="button">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={'prato-linha' + (prato.ativo ? '' : ' inativo')}>
      {prato.foto ? (
        <img className="prato-thumb" src={prato.foto} alt="" />
      ) : (
        <div className="prato-thumb prato-thumb-vazia">sem foto</div>
      )}
      <div className="info">
        <strong>{prato.nome}</strong> — {formatarMoeda(prato.preco)}
        {prato.tempo_preparo ? <span className="badge-tempo">⏱ {prato.tempo_preparo} min</span> : null}
        {prato.peso ? <span className="badge-tempo">⚖ {prato.peso}</span> : null}
        {prato.quantidade ? <span className="badge-tempo">🍽 {prato.quantidade}</span> : null}
        {prato.descricao && <div style={{ fontSize: '0.85rem', color: '#777' }}>{prato.descricao}</div>}
      </div>
      <button className="btn-secundario" onClick={() => inputFotoRef.current.click()} type="button">
        {prato.foto ? 'Trocar foto' : 'Adicionar foto'}
      </button>
      <input type="file" accept="image/*" ref={inputFotoRef} style={{ display: 'none' }} onChange={enviarFoto} />
      {prato.foto && (
        <button className="btn-secundario" onClick={removerFoto} type="button">
          Remover foto
        </button>
      )}
      <button className="btn-secundario" onClick={abrirEdicao} type="button">
        Editar
      </button>
      <button className="btn-secundario" onClick={() => setEditandoOpcoes((v) => !v)} type="button">
        Opções
      </button>
      <button className="btn-secundario" onClick={alternarAtivo} type="button">
        {prato.ativo ? 'Desativar' : 'Ativar'}
      </button>
      <button className="btn-perigo" onClick={excluir} type="button">
        Excluir
      </button>
    </div>
    {editandoOpcoes && (
      <EditorOpcoes
        prato={prato}
        irmaos={irmaos}
        onFechar={(salvou) => {
          setEditandoOpcoes(false);
          if (salvou === 'todos') alert('Opções salvas neste prato e em todos da categoria!');
          else if (salvou) alert('Opções salvas!');
        }}
      />
    )}
    </>
  );
}

function QrItem({ mesa, url, selecionado }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 300, 300);
      ctx.fillStyle = '#2b2b2b';
      ctx.font = 'bold 28px -apple-system, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Mesa ' + mesa, canvas.width / 2, 332);
    };
    img.src = '/api/admin/qrcode?url=' + encodeURIComponent(url);
  }, [mesa, url]);

  return (
    <div className={'qr-item' + (selecionado ? ' selecionado-impressao' : '')} id={'qr-item-' + mesa}>
      <canvas ref={canvasRef} width={300} height={340} />
    </div>
  );
}

function AbaQrCodes() {
  const [de, setDe] = useState(1);
  const [ate, setAte] = useState(10);
  const [gerados, setGerados] = useState([]);
  const [endereco, setEndereco] = useState('');
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
  const gridRef = useRef(null);

  function gerar() {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    setEndereco(base);
    const lista = [];
    for (let mesa = de; mesa <= ate; mesa++) lista.push(mesa);
    setGerados(lista);
  }

  useEffect(() => {
    if (mesaSelecionada === null) return;
    window.print();
    const limpar = () => setMesaSelecionada(null);
    window.addEventListener('afterprint', limpar, { once: true });
    return () => window.removeEventListener('afterprint', limpar);
  }, [mesaSelecionada]);

  return (
    <>
      <div className="cartao">
        <h3>Gerar QR Codes por mesa</h3>
        <div className="linha-form">
          <input type="number" placeholder="Da mesa nº" value={de} min={1} onChange={(e) => setDe(Number(e.target.value) || 1)} />
          <input
            type="number"
            placeholder="Até a mesa nº"
            value={ate}
            min={1}
            onChange={(e) => setAte(Number(e.target.value) || 1)}
          />
          <button className="btn" onClick={gerar} type="button">
            Gerar
          </button>
        </div>
        {endereco && <p style={{ fontSize: '0.85rem', color: '#666' }}>Endereço usado nos QR Codes: {endereco}/</p>}
      </div>

      <div className={'qr-grid' + (mesaSelecionada !== null ? ' imprimindo-um' : '')} ref={gridRef}>
        {gerados.map((mesa) => (
          <div key={mesa}>
            <QrItem mesa={mesa} url={`${endereco}/?mesa=${mesa}`} selecionado={mesaSelecionada === mesa} />
            <button
              className="btn-secundario btn-imprimir-um"
              type="button"
              onClick={() => setMesaSelecionada(mesa)}
            >
              Imprimir
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function AbaConfig({ config, onConfigAtualizado }) {
  const [nomeLoja, setNomeLoja] = useState(config.nomeLoja);
  const [msgNome, setMsgNome] = useState({ texto: '', cor: '' });
  const [novaSenha, setNovaSenha] = useState('');
  const [msgSenha, setMsgSenha] = useState('');
  const [acessos, setAcessos] = useState([]);
  const inputLogoRef = useRef(null);
  const [papel, setPapel] = useState(58);

  useEffect(() => {
    api('/acessos').then(setAcessos);
    setPapel(larguraPapelMm());
  }, []);

  function mudarPapel(valor) {
    setPapel(valor);
    try {
      localStorage.setItem(CHAVE_PAPEL, String(valor));
    } catch {}
  }

  async function salvarNome() {
    try {
      await api('/config', { method: 'POST', body: JSON.stringify({ nomeLoja }) });
      setMsgNome({ texto: 'Nome salvo com sucesso.', cor: '#1a7a3d' });
      onConfigAtualizado((atual) => ({ ...atual, nomeLoja }));
    } catch (err) {
      setMsgNome({ texto: err.message, cor: '#a3352b' });
    }
  }

  async function enviarLogo(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const formData = new FormData();
    formData.append('logo', arquivo);
    try {
      const resp = await fetch('/api/admin/logo', { method: 'POST', body: formData });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || 'Erro ao enviar logo.');
      onConfigAtualizado((atual) => ({ ...atual, logoUrl: dados.logoUrl }));
    } catch (err) {
      alert(err.message);
    }
    e.target.value = '';
  }

  async function trocarSenha() {
    try {
      await api('/senha', { method: 'POST', body: JSON.stringify({ novaSenha }) });
      setMsgSenha('Senha alterada com sucesso.');
      setNovaSenha('');
    } catch (err) {
      setMsgSenha(err.message);
    }
  }

  return (
    <>
      <div className="cartao">
        <h3>Personalização</h3>
        <div className="linha-form">
          <input type="text" placeholder="Nome do restaurante" value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} />
          <button className="btn" onClick={salvarNome} type="button">
            Salvar nome
          </button>
        </div>
        <div className="erro" style={{ color: msgNome.cor }}>
          {msgNome.texto}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          {config.logoUrl && <img src={config.logoUrl} className="logo-preview" alt="Logo atual" />}
          <div>
            <button className="btn-secundario" onClick={() => inputLogoRef.current.click()} type="button">
              Enviar logo
            </button>
            <input type="file" accept="image/*" ref={inputLogoRef} style={{ display: 'none' }} onChange={enviarLogo} />
          </div>
        </div>
      </div>

      <div className="cartao">
        <h3>Impressora de cupom (este computador)</h3>
        <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 8px' }}>
          Largura do papel da bobina. Se o cupom sair cortado ou deslocado, troque aqui e imprima de novo.
        </p>
        <div className="linha-form">
          <select value={papel} onChange={(e) => mudarPapel(Number(e.target.value))}>
            <option value={50}>50 mm</option>
            <option value={58}>58 mm</option>
            <option value={80}>80 mm</option>
          </select>
        </div>
      </div>

      <div className="cartao">
        <h3>Trocar senha do painel</h3>
        <div className="linha-form">
          <input
            type="password"
            placeholder="Nova senha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />
          <button className="btn" onClick={trocarSenha} type="button">
            Salvar
          </button>
        </div>
        <div className="erro">{msgSenha}</div>
      </div>

      <div className="cartao">
        <h3>Histórico de acessos ao painel</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: 0 }}>
          Como a senha é única e compartilhada, isso mostra apenas quando e de qual aparelho (endereço na rede)
          alguém entrou — não o nome da pessoa.
        </p>
        <table>
          <thead>
            <tr>
              <th>Data e hora</th>
              <th>Aparelho (IP)</th>
            </tr>
          </thead>
          <tbody>
            {acessos.length === 0 && (
              <tr>
                <td colSpan={2} style={{ textAlign: 'center', color: '#888' }}>
                  Nenhum acesso registrado ainda.
                </td>
              </tr>
            )}
            {acessos.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
