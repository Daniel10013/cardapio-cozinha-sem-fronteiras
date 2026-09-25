'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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

function tocarTom(frequencias) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    frequencias.forEach(([freq, atraso]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + atraso);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + atraso + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atraso + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + atraso);
      osc.stop(ctx.currentTime + atraso + 0.32);
    });
  } catch (e) {
    /* navegador sem suporte a áudio */
  }
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
          tocarTom([[880, 0], [880, 0.18]]);
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

  useEffect(() => {
    if (!reciboHtml) return;
    document.body.classList.add('imprimindo-recibo');
    window.print();
    const limpar = () => document.body.classList.remove('imprimindo-recibo');
    window.addEventListener('afterprint', limpar, { once: true });
    return () => window.removeEventListener('afterprint', limpar);
  }, [reciboHtml]);

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
            gatilhoAtualizacao={gatilhoAtualizacao}
          />
        )}
        {aba === 'relatorio' && <AbaRelatorio gatilhoAtualizacao={gatilhoAtualizacao} />}
        {aba === 'cardapio' && <AbaCardapio />}
        {aba === 'qrcodes' && <AbaQrCodes />}
        {aba === 'config' && <AbaConfig config={config} onConfigAtualizado={onConfigAtualizado} />}
      </main>

      {reciboHtml && (
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
        </div>
      )}
    </div>
  );
}

function formatarMesLabel(m) {
  const [ano, mes] = m.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[Number(mes) - 1]}/${ano}`;
}

function AbaPedidos({ fechamentosPendentes, onImprimirConta, onConcluirFechamento, gatilhoAtualizacao }) {
  const [meses, setMeses] = useState([]);
  const [mes, setMes] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [resumo, setResumo] = useState({ totalPedidos: 0, faturamento: 0 });

  const carregarPedidos = useCallback((mesAtual) => {
    if (!mesAtual) return;
    api('/pedidos?mes=' + mesAtual).then(setPedidos);
    api('/resumo?mes=' + mesAtual).then(setResumo);
  }, []);

  useEffect(() => {
    api('/pedidos/meses-disponiveis').then((disponiveis) => {
      const mesAtual = new Date().toISOString().slice(0, 7);
      const lista = disponiveis.includes(mesAtual) ? disponiveis : [mesAtual, ...disponiveis];
      setMeses(lista);
      setMes(mesAtual);
    });
  }, []);

  useEffect(() => {
    carregarPedidos(mes);
  }, [mes, carregarPedidos, gatilhoAtualizacao]);

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
            </tr>
          </thead>
          <tbody>
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>
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
              const itensTxt = p.itens.map((i) => `${i.quantidade}x ${i.nome_prato}`).join(', ');
              return (
                <tr key={p.id}>
                  <td>{hora}</td>
                  <td>{p.mesa || '-'}</td>
                  <td>{itensTxt}</td>
                  <td>{formatarMoeda(p.total)}</td>
                  <td>
                    <select value={p.status} onChange={(e) => alterarStatus(p.id, e.target.value)}>
                      {['recebido', 'em preparo', 'pronto', 'entregue', 'cancelado'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
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

function AbaRelatorio({ gatilhoAtualizacao }) {
  const [meses, setMeses] = useState([]);
  const [mes, setMes] = useState('');
  const [resumo, setResumo] = useState({ totalPedidos: 0, faturamento: 0, porDia: [] });

  useEffect(() => {
    api('/pedidos/meses-disponiveis').then((disponiveis) => {
      const mesAtual = new Date().toISOString().slice(0, 7);
      const lista = disponiveis.includes(mesAtual) ? disponiveis : [mesAtual, ...disponiveis];
      setMeses(lista);
      setMes(mesAtual);
    });
  }, []);

  useEffect(() => {
    if (!mes) return;
    api('/resumo?mes=' + mes).then(setResumo);
  }, [mes, gatilhoAtualizacao]);

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
            return (
              <div className="dia-linha" key={d.dia}>
                <div className="dia-data">{formatarDiaLabel(d.dia)}</div>
                <div className="dia-barra-fundo">
                  <div className="dia-barra" style={{ width: largura + '%' }} />
                </div>
                <div className="dia-valores">
                  {formatarMoeda(d.faturamento)} · {d.pedidos} pedido{d.pedidos === 1 ? '' : 's'}
                </div>
              </div>
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

  async function adicionarPrato() {
    if (!nome || !preco) return alert('Preencha nome e preço do prato.');
    await api('/pratos', {
      method: 'POST',
      body: JSON.stringify({ categoriaId: categoria.id, nome, descricao, preco, tempoPreparo }),
    });
    setNome('');
    setDescricao('');
    setPreco('');
    setTempoPreparo('');
    onAtualizar();
  }

  return (
    <div className="cartao categoria-bloco">
      <h3>
        {categoria.nome}
        <button className="btn-perigo" onClick={() => onExcluir(categoria.id)} type="button">
          Excluir categoria
        </button>
      </h3>
      <div>
        {categoria.pratos.length === 0 && <p style={{ color: '#888', fontSize: '0.9rem' }}>Nenhum prato ainda.</p>}
        {categoria.pratos.map((p) => (
          <PratoLinha key={p.id} prato={p} onAtualizar={onAtualizar} />
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
        <button className="btn" onClick={adicionarPrato} type="button">
          Adicionar prato
        </button>
      </div>
    </div>
  );
}

function PratoLinha({ prato, onAtualizar }) {
  const inputFotoRef = useRef(null);

  async function editarPreco() {
    const novoPreco = prompt('Novo preço:', prato.preco);
    if (novoPreco === null) return;
    await api('/pratos/' + prato.id, { method: 'PATCH', body: JSON.stringify({ preco: novoPreco }) });
    onAtualizar();
  }

  async function editarTempo() {
    const novoTempo = prompt('Tempo de preparo (em minutos):', prato.tempo_preparo || 0);
    if (novoTempo === null) return;
    await api('/pratos/' + prato.id, { method: 'PATCH', body: JSON.stringify({ tempoPreparo: novoTempo }) });
    onAtualizar();
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

  return (
    <div className={'prato-linha' + (prato.ativo ? '' : ' inativo')}>
      {prato.foto ? (
        <img className="prato-thumb" src={prato.foto} alt="" />
      ) : (
        <div className="prato-thumb prato-thumb-vazia">sem foto</div>
      )}
      <div className="info">
        <strong>{prato.nome}</strong> — {formatarMoeda(prato.preco)}
        {prato.tempo_preparo ? <span className="badge-tempo">⏱ {prato.tempo_preparo} min</span> : null}
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
      <button className="btn-secundario" onClick={editarPreco} type="button">
        Preço
      </button>
      <button className="btn-secundario" onClick={editarTempo} type="button">
        Tempo
      </button>
      <button className="btn-secundario" onClick={alternarAtivo} type="button">
        {prato.ativo ? 'Desativar' : 'Ativar'}
      </button>
      <button className="btn-perigo" onClick={excluir} type="button">
        Excluir
      </button>
    </div>
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

  useEffect(() => {
    api('/acessos').then(setAcessos);
  }, []);

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
