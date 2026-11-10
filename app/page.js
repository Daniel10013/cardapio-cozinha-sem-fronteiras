'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const SITE_RESTAURANTE = 'https://www.emporiosemfronteiras.com.br/';

function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function definirFavicon(url) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

const STATUS_ROTULO = {
  recebido: 'Recebido',
  'em preparo': 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

function lembrarComanda(mesa, id) {
  try {
    localStorage.setItem('csf_comanda_' + mesa, id);
  } catch (e) {
    /* navegador sem armazenamento */
  }
}

function comandaLembrada(mesa) {
  try {
    return localStorage.getItem('csf_comanda_' + mesa);
  } catch (e) {
    return null;
  }
}

function PaginaCliente() {
  const params = useSearchParams();
  const mesaUrl = params.get('mesa') || '';

  const [config, setConfig] = useState({ nomeLoja: 'Cozinha Sem Fronteiras', logoUrl: '' });
  const [tela, setTela] = useState(mesaUrl ? 'carregando' : 'escolha'); // carregando | escolha | mesa | detalhe | comanda | pedido
  const [comandas, setComandas] = useState([]);
  const [modo, setModo] = useState(null); // local | levar
  const [mesaAtual, setMesaAtual] = useState(mesaUrl);
  const [nomeComanda, setNomeComanda] = useState('');
  const [mostrarFormComanda, setMostrarFormComanda] = useState(false);

  const [cardapio, setCardapio] = useState([]);
  const [carregandoCardapio, setCarregandoCardapio] = useState(true);
  const [lojaAberta, setLojaAberta] = useState(true);
  const [carrinho, setCarrinho] = useState({}); // { [pratoId]: { prato, quantidade } }

  const [pratoEscolhendo, setPratoEscolhendo] = useState(null);
  const [pratoVendo, setPratoVendo] = useState(null); // foto ampliada
  const [modalRevisao, setModalRevisao] = useState(false);
  const [modalFecharConta, setModalFecharConta] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(({ nomeLoja, logoUrl }) => {
        setConfig({ nomeLoja, logoUrl });
        document.title = nomeLoja;
        if (logoUrl) definirFavicon(logoUrl);
      })
      .catch(() => {});
  }, []);

  // Ao abrir o QR da mesa: se já há comandas abertas nela, vai direto para elas.
  useEffect(() => {
    if (!mesaUrl) return;
    fetch('/api/mesa?mesa=' + encodeURIComponent(mesaUrl))
      .then((r) => r.json())
      .then((dados) => {
        const lista = dados.comandas || [];
        setComandas(lista);
        if (!lista.length) return setTela('escolha');
        const lembrada = comandaLembrada(mesaUrl);
        if (lembrada && lista.some((c) => c.id === lembrada)) {
          setModo('local');
          setMesaAtual(lembrada);
          setTela('detalhe');
        } else {
          setTela('mesa');
        }
      })
      .catch(() => setTela('escolha'));
  }, [mesaUrl]);

  function escolherLocal() {
    setTela(mesaUrl && comandas.length ? 'mesa' : 'comanda');
  }

  function escolherLevar() {
    setModo('levar');
    setMesaAtual('');
    entrarNoPedido();
  }

  function abrirComanda(id) {
    setModo('local');
    setMesaAtual(id);
    lembrarComanda(mesaUrl, id);
    setTela('detalhe');
  }

  function escolherComandaJunta() {
    setModo('local');
    setMesaAtual(mesaUrl);
    if (mesaUrl) lembrarComanda(mesaUrl, mesaUrl);
    entrarNoPedido();
  }

  function confirmarComandaSeparada() {
    const nome = nomeComanda.replace(/\s+/g, ' ').trim();
    if (!nome) return alert('Digite seu nome para identificar sua comanda.');
    const repetido = comandas.some((c) => c.tipo === 'separada' && c.nome.toLowerCase() === nome.toLowerCase());
    if (repetido) {
      return alert(
        `Já existe uma comanda "${nome}" nesta mesa. Se for a sua, volte e toque no seu nome na lista; se for outra pessoa, acrescente uma inicial ou sobrenome (ex: ${nome} S.).`
      );
    }
    const id = mesaUrl ? `${mesaUrl} - ${nome}` : nome;
    setModo('local');
    setMesaAtual(id);
    if (mesaUrl) lembrarComanda(mesaUrl, id);
    entrarNoPedido();
  }

  function entrarNoPedido() {
    setTela('pedido');
    fetch('/api/status')
      .then((r) => r.json())
      .then(({ aberto }) => setLojaAberta(aberto))
      .catch(() => {});
    setCarregandoCardapio(true);
    fetch('/api/cardapio')
      .then((r) => r.json())
      .then((data) => setCardapio(data))
      .catch(() => setCardapio(null))
      .finally(() => setCarregandoCardapio(false));
  }

  // Cada linha do carrinho é um prato + as opções escolhidas (mesmo prato com
  // opções diferentes vira linhas diferentes).
  function alterarPorChave(chave, delta) {
    setCarrinho((atual) => {
      const item = atual[chave];
      if (!item) return atual;
      return { ...atual, [chave]: { ...item, quantidade: Math.max(0, item.quantidade + delta) } };
    });
  }

  function alterarObservacao(chave, observacao) {
    setCarrinho((atual) => (atual[chave] ? { ...atual, [chave]: { ...atual[chave], observacao } } : atual));
  }

  function alterarQuantidade(prato, delta) {
    setCarrinho((atual) => {
      // prefixo "p": chaves só com números fariam o JavaScript reordenar o carrinho pelo id
      const chave = `p${prato.id}`;
      const item = atual[chave] || { chave, prato, opcoes: [], precoUnit: Number(prato.preco), quantidade: 0 };
      return { ...atual, [chave]: { ...item, quantidade: Math.max(0, item.quantidade + delta) } };
    });
  }

  function adicionarComOpcoes(prato, opcoes, quantidade) {
    const chave = `${prato.id}|${opcoes.map((o) => o.id).sort((a, b) => a - b).join(',')}`;
    const precoUnit = Number(prato.preco) + opcoes.reduce((soma, o) => soma + o.precoAdicional, 0);
    setCarrinho((atual) => {
      const item = atual[chave] || { chave, prato, opcoes, precoUnit, quantidade: 0 };
      return { ...atual, [chave]: { ...item, quantidade: item.quantidade + quantidade } };
    });
    setPratoEscolhendo(null);
  }

  const itensCarrinho = Object.values(carrinho).filter((i) => i.quantidade > 0);
  const totalCarrinho = itensCarrinho.reduce((acc, i) => acc + i.precoUnit * i.quantidade, 0);
  const quantidadeDoPrato = (pratoId) =>
    itensCarrinho.filter((i) => i.prato.id === pratoId).reduce((soma, i) => soma + i.quantidade, 0);

  function limparCarrinho() {
    setCarrinho({});
  }

  const mesaLabel =
    modo === 'local' ? (mesaAtual ? 'Mesa ' + mesaAtual : 'Comer no local') : modo === 'levar' ? 'Para levar' : '';

  return (
    <>
      {tela === 'escolha' && (
        <div className="tela-escolha">
          {config.logoUrl && <img src={config.logoUrl} className="logo-topo" alt="Logo" />}
          <h1>{config.nomeLoja}</h1>
          <p>Como você quer continuar?</p>
          <button className="opcao-escolha" onClick={escolherLocal} type="button">
            <span className="icone">🍽️</span>
            <span>Comer no local</span>
          </button>
          <button className="opcao-escolha" onClick={escolherLevar} type="button">
            <span className="icone">🥡</span>
            <span>Comida para levar</span>
          </button>
          <button className="opcao-escolha" onClick={() => window.open(SITE_RESTAURANTE, '_blank')} type="button">
            <span className="icone">🌐</span>
            <span>Nosso site</span>
          </button>
        </div>
      )}

      {tela === 'carregando' && <div className="vazio">Carregando...</div>}

      {tela === 'mesa' && (
        <div className="tela-escolha">
          <h1>Mesa {mesaUrl}</h1>
          <p>Comandas abertas — toque na sua</p>
          {comandas.map((c) => (
            <button className="opcao-escolha" key={c.id} onClick={() => abrirComanda(c.id)} type="button">
              <span className="icone">{c.tipo === 'junta' ? '🧾' : '🙋'}</span>
              <span>
                {c.tipo === 'junta' ? 'Conta da mesa (junta)' : c.nome}
                <small style={{ display: 'block', fontWeight: 400, color: '#777' }}>
                  {c.pedidos} {c.pedidos === 1 ? 'pedido' : 'pedidos'}
                  {c.pendente ? ' · conta solicitada' : ''}
                </small>
              </span>
            </button>
          ))}
          <button className="opcao-escolha" onClick={() => setTela('comanda')} type="button">
            <span className="icone">➕</span>
            <span>Nova comanda</span>
          </button>
          <button
            className="opcao-escolha"
            style={{ background: 'transparent', boxShadow: 'none', color: '#fff', fontWeight: 400 }}
            onClick={() => setTela('escolha')}
            type="button"
          >
            ← Voltar ao início
          </button>
        </div>
      )}

      {tela === 'detalhe' && (
        <DetalheComanda
          config={config}
          comandaId={mesaAtual}
          mesaUrl={mesaUrl}
          temOutras={comandas.some((c) => c.id !== mesaAtual)}
          onPedirMais={entrarNoPedido}
          onTrocar={() => setTela(comandas.length ? 'mesa' : 'escolha')}
        />
      )}

      {tela === 'comanda' && (
        <div className="tela-escolha">
          <h1>Comer no local</h1>
          <p>A conta da mesa vai ser junta ou separada?</p>
          <button className="opcao-escolha" onClick={escolherComandaJunta} type="button">
            <span className="icone">🧾</span>
            <span>Comanda junta (mesa toda)</span>
          </button>
          <button className="opcao-escolha" onClick={() => setMostrarFormComanda(true)} type="button">
            <span className="icone">🙋</span>
            <span>Comanda separada (só a minha)</span>
          </button>

          {mostrarFormComanda && (
            <div style={{ marginTop: 10, width: '100%', maxWidth: 320 }}>
              <input
                type="text"
                placeholder="Seu nome"
                value={nomeComanda}
                onChange={(e) => setNomeComanda(e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', fontSize: '1rem' }}
              />
              <button
                className="opcao-escolha"
                style={{ marginTop: 10, justifyContent: 'center' }}
                onClick={confirmarComandaSeparada}
                type="button"
              >
                Continuar
              </button>
            </div>
          )}

          <button
            className="opcao-escolha"
            style={{ background: 'transparent', boxShadow: 'none', color: '#fff', fontWeight: 400 }}
            onClick={() => {
              setMostrarFormComanda(false);
              setNomeComanda('');
              setTela(comandas.length ? 'mesa' : 'escolha');
            }}
            type="button"
          >
            ← Voltar
          </button>
        </div>
      )}

      {tela === 'pedido' && (
        <div>
          <header className="topo">
            <div className="topo-linha">
              <div className="topo-marca">
                {config.logoUrl && <img src={config.logoUrl} className="logo-topo" alt="Logo" />}
                <h1>{config.nomeLoja}</h1>
              </div>
              {modo === 'local' && mesaAtual && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-fechar-conta" onClick={() => setTela('detalhe')} type="button">
                    Minha conta
                  </button>
                  <button className="btn-fechar-conta" onClick={() => setModalFecharConta(true)} type="button">
                    Fechar conta
                  </button>
                </div>
              )}
            </div>
            <div className="mesa">{mesaLabel}</div>
          </header>

          {!lojaAberta && (
            <div className="aviso-fechado">O restaurante não está aceitando pedidos no momento. Fale com a equipe.</div>
          )}

          <main>
            {carregandoCardapio && <div className="vazio">Carregando cardápio...</div>}
            {!carregandoCardapio && cardapio === null && (
              <div className="vazio">Não foi possível carregar o cardápio. Verifique sua conexão.</div>
            )}
            {!carregandoCardapio && cardapio && cardapio.length === 0 && (
              <div className="vazio">Cardápio ainda não disponível. Fale com a equipe.</div>
            )}
            {!carregandoCardapio &&
              cardapio &&
              cardapio.map((cat) => (
                <section className="categoria" key={cat.id}>
                  <h2>{cat.nome}</h2>
                  {cat.pratos.map((prato) => (
                    <div className="prato" key={prato.id}>
                      {prato.foto && (
                        <img
                          className="prato-foto prato-foto-clicavel"
                          src={prato.foto}
                          alt={prato.nome}
                          onClick={() => setPratoVendo(prato)}
                        />
                      )}
                      <div className="prato-info">
                        <div className="nome">{prato.nome}</div>
                        {prato.descricao && <div className="descricao">{prato.descricao}</div>}
                        {prato.observacao && <div className="aviso-prato">⚠ {prato.observacao}</div>}
                        <div className="preco">{formatarMoeda(prato.preco)}</div>
                        {prato.peso || prato.quantidade ? (
                          <div className="tempo-preparo">{[prato.peso && `⚖ ${prato.peso}`, prato.quantidade && `🍽 ${prato.quantidade}`].filter(Boolean).join(' · ')}</div>
                        ) : null}
                        {prato.tempo_preparo ? <div className="tempo-preparo">⏱ {prato.tempo_preparo} min</div> : null}
                      </div>
                      {prato.grupos && prato.grupos.length > 0 ? (
                        <div style={{ textAlign: 'center' }}>
                          <button className="btn-escolher" type="button" onClick={() => setPratoEscolhendo(prato)}>
                            Escolher
                          </button>
                          {quantidadeDoPrato(prato.id) > 0 && (
                            <div style={{ fontSize: '0.8rem', color: '#a3352b', marginTop: 4 }}>
                              {quantidadeDoPrato(prato.id)} no pedido
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="qtd-controle">
                          <button type="button" aria-label="Diminuir" onClick={() => alterarQuantidade(prato, -1)}>
                            −
                          </button>
                          <span>{carrinho[`p${prato.id}`]?.quantidade || 0}</span>
                          <button type="button" aria-label="Aumentar" onClick={() => alterarQuantidade(prato, 1)}>
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              ))}
          </main>

          {itensCarrinho.length > 0 && (
            <div className="rodape-carrinho">
              <div className="total">Total: {formatarMoeda(totalCarrinho)}</div>
              <button onClick={() => setModalRevisao(true)} type="button">
                Ver pedido
              </button>
            </div>
          )}

          {pratoVendo && (
            <div className="overlay" onClick={() => setPratoVendo(null)}>
              <div className="modal modal-foto" onClick={(e) => e.stopPropagation()}>
                <img className="foto-grande" src={pratoVendo.foto} alt={pratoVendo.nome} />
                <h3>{pratoVendo.nome}</h3>
                <div className="preco-grande">
                  {formatarMoeda(pratoVendo.preco)}
                  {pratoVendo.grupos && pratoVendo.grupos.length > 0 ? ' (a partir de)' : ''}
                </div>
                {pratoVendo.descricao && <p className="descricao-grande">{pratoVendo.descricao}</p>}
                {pratoVendo.observacao && <p className="aviso-prato aviso-grande">⚠ {pratoVendo.observacao}</p>}
                {pratoVendo.peso || pratoVendo.quantidade || pratoVendo.tempo_preparo ? (
                  <p className="detalhes-grande">
                    {[
                      pratoVendo.peso && `⚖ ${pratoVendo.peso}`,
                      pratoVendo.quantidade && `🍽 ${pratoVendo.quantidade}`,
                      pratoVendo.tempo_preparo ? `⏱ ${pratoVendo.tempo_preparo} min` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                <div className="acoes">
                  <button className="btn-cancelar" type="button" onClick={() => setPratoVendo(null)}>
                    Fechar
                  </button>
                  <button
                    className="btn-confirmar"
                    type="button"
                    onClick={() => {
                      const prato = pratoVendo;
                      setPratoVendo(null);
                      if (prato.grupos && prato.grupos.length > 0) setPratoEscolhendo(prato);
                      else alterarQuantidade(prato, 1);
                    }}
                  >
                    {pratoVendo.grupos && pratoVendo.grupos.length > 0 ? 'Escolher opções' : 'Adicionar ao pedido'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {pratoEscolhendo && (
            <ModalOpcoes
              prato={pratoEscolhendo}
              onFechar={() => setPratoEscolhendo(null)}
              onAdicionar={adicionarComOpcoes}
            />
          )}

          {modalRevisao && (
            <ModalRevisarPedido
              itens={itensCarrinho}
              onAlterar={alterarPorChave}
              onObservacao={alterarObservacao}
              total={totalCarrinho}
              modo={modo}
              mesaAtual={mesaAtual}
              onFechar={() => setModalRevisao(false)}
              onSucesso={() => {
                setModalRevisao(false);
                limparCarrinho();
              }}
            />
          )}

          {modalFecharConta && <ModalFecharConta mesaAtual={mesaAtual} onFechar={() => setModalFecharConta(false)} />}
        </div>
      )}
    </>
  );
}

function ModalOpcoes({ prato, onFechar, onAdicionar }) {
  const [escolhas, setEscolhas] = useState({}); // { [grupoId]: [opcaoId, ...] }
  const [quantidade, setQuantidade] = useState(1);
  const [erro, setErro] = useState('');

  function marcar(grupo, opcao) {
    setErro('');
    setEscolhas((atual) => {
      const marcadas = atual[grupo.id] || [];
      if (grupo.tipo === 'unica') return { ...atual, [grupo.id]: [opcao.id] };
      return {
        ...atual,
        [grupo.id]: marcadas.includes(opcao.id) ? marcadas.filter((id) => id !== opcao.id) : [...marcadas, opcao.id],
      };
    });
  }

  const selecionadas = prato.grupos.flatMap((g) => g.opcoes.filter((o) => (escolhas[g.id] || []).includes(o.id)).map((o) => ({ ...o, grupo: g.nome })));
  const precoUnit = Number(prato.preco) + selecionadas.reduce((soma, o) => soma + o.precoAdicional, 0);

  function confirmar() {
    const faltando = prato.grupos.find((g) => g.tipo === 'unica' && !(escolhas[g.id] || []).length);
    if (faltando) {
      setErro(`Escolha uma opção de "${faltando.nome}".`);
      return;
    }
    onAdicionar(prato, selecionadas, quantidade);
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{prato.nome}</h3>
        {prato.grupos.map((g) => (
          <div className="grupo-opcoes" key={g.id}>
            <h4>{g.nome}</h4>
            <div className="dica">{g.tipo === 'unica' ? 'Escolha 1 (obrigatório)' : 'Opcional — marque quantos quiser (valor à parte)'}</div>
            {g.opcoes.map((o) => {
              const marcada = (escolhas[g.id] || []).includes(o.id);
              return (
                <label className={'opcao-linha' + (marcada ? ' marcada' : '')} key={o.id}>
                  <input
                    type={g.tipo === 'unica' ? 'radio' : 'checkbox'}
                    name={'grupo-' + g.id}
                    checked={marcada}
                    onChange={() => marcar(g, o)}
                  />
                  <span className="opcao-nome">{o.nome}</span>
                  {o.precoAdicional > 0 && <span className="opcao-preco">+ {formatarMoeda(o.precoAdicional)}</span>}
                </label>
              );
            })}
          </div>
        ))}
        <div className="linha-item" style={{ marginTop: 16, alignItems: 'center' }}>
          <span>Quantidade</span>
          <div className="qtd-controle">
            <button type="button" aria-label="Diminuir" onClick={() => setQuantidade((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span>{quantidade}</span>
            <button type="button" aria-label="Aumentar" onClick={() => setQuantidade((q) => Math.min(99, q + 1))}>
              +
            </button>
          </div>
        </div>
        {erro && <div className="erro">{erro}</div>}
        <div className="acoes">
          <button className="btn-cancelar" type="button" onClick={onFechar}>
            Voltar
          </button>
          <button className="btn-confirmar" type="button" onClick={confirmar}>
            Adicionar — {formatarMoeda(precoUnit * quantidade)}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalRevisarPedido({ itens, total, modo, mesaAtual, onFechar, onSucesso, onAlterar, onObservacao }) {
  const paraLevar = modo === 'levar';
  const [valorCampo, setValorCampo] = useState(paraLevar ? '' : mesaAtual);
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(null);

  async function enviarPedido() {
    if (paraLevar && !valorCampo.trim()) {
      setErro('Informe seu nome para identificar o pedido.');
      return;
    }
    setEnviando(true);
    setErro('');
    const mesaValor = paraLevar ? `Para levar: ${valorCampo.trim()}` : valorCampo;

    try {
      const resp = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesa: mesaValor,
          observacao,
          itens: itens.map((i) => ({
            pratoId: i.prato.id,
            quantidade: i.quantidade,
            opcoes: i.opcoes.map((o) => o.id),
            observacao: i.observacao || '',
          })),
        }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || 'Erro ao enviar pedido');
      setSucesso(dados);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="overlay">
        <div className="modal">
          <div className="sucesso">
            <div className="check">✅</div>
            <h3>Pedido enviado!</h3>
            <p>
              Pedido nº {sucesso.pedidoId} — Total {formatarMoeda(sucesso.total)}
            </p>
            <p>Aguarde, a equipe já foi avisada.</p>
            <div className="acoes">
              <button className="btn-confirmar" type="button" onClick={onSucesso}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>Confirmar pedido</h3>
        {itens.map((i) => (
          <div key={i.chave} style={{ marginBottom: 10 }}>
            <div className="linha-item" style={{ alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ flex: 1 }}>
                {i.prato.nome}
                {i.opcoes.length > 0 && (
                  <small style={{ display: 'block', color: '#888' }}>
                    {i.opcoes.map((o) => o.nome).join(' · ')}
                  </small>
                )}
              </span>
              <div className="qtd-controle">
                <button type="button" aria-label="Diminuir" onClick={() => onAlterar(i.chave, -1)}>
                  −
                </button>
                <span>{i.quantidade}</span>
                <button type="button" aria-label="Aumentar" onClick={() => onAlterar(i.chave, 1)}>
                  +
                </button>
              </div>
              <span style={{ minWidth: 70, textAlign: 'right' }}>{formatarMoeda(i.precoUnit * i.quantidade)}</span>
            </div>
            <input
              type="text"
              className="obs-item"
              placeholder="Observação deste prato (ex: sem cebola)"
              maxLength={200}
              value={i.observacao || ''}
              onChange={(e) => onObservacao(i.chave, e.target.value)}
            />
          </div>
        ))}
        <div
          className="linha-item"
          style={{ fontWeight: 700, borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}
        >
          <span>Total</span>
          <span>{formatarMoeda(total)}</span>
        </div>
        <input
          type="text"
          placeholder={paraLevar ? 'Seu nome' : 'Número da mesa'}
          value={valorCampo}
          onChange={(e) => setValorCampo(e.target.value)}
        />
        <textarea
          placeholder="Observações (ex: sem cebola)"
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        {erro && <div className="erro">{erro}</div>}
        <div className="acoes">
          <button className="btn-cancelar" type="button" onClick={onFechar}>
            Voltar
          </button>
          <button className="btn-confirmar" type="button" disabled={enviando || itens.length === 0} onClick={enviarPedido}>
            {enviando ? 'Enviando...' : 'Enviar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalFecharConta({ mesaAtual, onFechar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(null);

  useEffect(() => {
    fetch('/api/comanda?id=' + encodeURIComponent(mesaAtual))
      .then((r) => r.json())
      .then((d) => {
        if (d.erro) throw new Error(d.erro);
        setDados(d);
      })
      .catch((err) => setErro(err.message));
  }, [mesaAtual]);

  async function confirmar() {
    setEnviando(true);
    try {
      const resp = await fetch('/api/conta/fechar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesa: mesaAtual }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.erro || 'Erro ao chamar para fechar a conta.');
      setSucesso(d);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !dados) {
    return (
      <div className="overlay">
        <div className="modal">
          <p className="erro">{erro}</p>
          <div className="acoes">
            <button className="btn-cancelar" type="button" onClick={onFechar}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="overlay">
        <div className="modal">
          <div className="sucesso">
            <div className="check">✅</div>
            <h3>Equipe avisada!</h3>
            <p>
              Subtotal: {formatarMoeda(sucesso.subtotal)}
              <br />
              Taxa de serviço (10%): {formatarMoeda(sucesso.taxaServico)}
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>Total: {formatarMoeda(sucesso.total)}</p>
            <p>Alguém vai até sua mesa para fechar a conta.</p>
            <div className="acoes">
              <button className="btn-confirmar" type="button" onClick={onFechar}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dados) return null;

  const total = dados.subtotal + dados.taxaServico;

  return (
    <div className="overlay">
      <div className="modal">
        <h3>Fechar conta — Mesa {mesaAtual}</h3>
        {dados.pedidos
          .filter((p) => p.status !== 'cancelado')
          .flatMap((p) => p.itens)
          .map((i, idx) => (
            <div className="linha-item" key={idx}>
              <span>
                {i.quantidade}x {i.nome}
                {i.opcoes && <small style={{ display: 'block', color: '#888' }}>{i.opcoes}</small>}
              </span>
              <span>{formatarMoeda(i.subtotal)}</span>
            </div>
          ))}
        {dados.subtotal <= 0 && <p className="erro">Ainda não há pedidos nesta comanda.</p>}
        {dados.fechamentoPendente && (
          <p style={{ color: '#7a5a12' }}>A conta já foi solicitada — a equipe está a caminho.</p>
        )}
        <div className="linha-item" style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
          <span>Subtotal dos pedidos</span>
          <span>{formatarMoeda(dados.subtotal)}</span>
        </div>
        <div className="linha-item">
          <span>Taxa de serviço (10%)</span>
          <span>{formatarMoeda(dados.taxaServico)}</span>
        </div>
        <div className="linha-item destaque-total">
          <span>Total a pagar</span>
          <span>{formatarMoeda(total)}</span>
        </div>
        {erro && <div className="erro">{erro}</div>}
        <div className="acoes">
          <button className="btn-cancelar" type="button" onClick={onFechar}>
            Voltar
          </button>
          <button
            className="btn-confirmar"
            type="button"
            disabled={enviando || dados.subtotal <= 0}
            onClick={confirmar}
          >
            {enviando ? 'Enviando...' : 'Chamar para fechar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalheComanda({ config, comandaId, mesaUrl, temOutras, onPedirMais, onTrocar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    let ativo = true;
    function carregar() {
      fetch('/api/comanda?id=' + encodeURIComponent(comandaId))
        .then((r) => r.json())
        .then((d) => {
          if (!ativo) return;
          if (d.erro) throw new Error(d.erro);
          setDados(d);
          setErro('');
        })
        .catch((err) => ativo && setErro(err.message));
    }
    carregar();
    const intervalo = setInterval(carregar, 10000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [comandaId, fechando]);

  const nome = mesaUrl && comandaId.startsWith(mesaUrl + ' - ') ? comandaId.slice(mesaUrl.length + 3) : '';
  const titulo = mesaUrl ? (nome ? `Mesa ${mesaUrl} — ${nome}` : `Mesa ${mesaUrl} (conta junta)`) : comandaId;

  return (
    <div>
      <header className="topo">
        <div className="topo-linha">
          <div className="topo-marca">
            {config.logoUrl && <img src={config.logoUrl} className="logo-topo" alt="Logo" />}
            <h1>{config.nomeLoja}</h1>
          </div>
        </div>
        <div className="mesa">{titulo}</div>
      </header>

      <main>
        {erro && <p className="erro">{erro}</p>}
        {!dados && !erro && <div className="vazio">Carregando...</div>}
        {dados && dados.pedidos.length === 0 && <div className="vazio">Nenhum pedido nesta comanda ainda.</div>}
        {dados &&
          dados.pedidos.map((p) => (
            <div className="prato" key={p.id} style={{ display: 'block', opacity: p.status === 'cancelado' ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>
                  Pedido {new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </strong>
                <span style={{ color: '#a3352b', fontWeight: 600 }}>{STATUS_ROTULO[p.status] || p.status}</span>
              </div>
              {p.itens.map((i, idx) => (
                <div className="linha-item" key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {i.quantidade}x {i.nome}
                    {i.opcoes && <small style={{ display: 'block', color: '#888' }}>{i.opcoes}</small>}
                    {i.observacao && <small style={{ display: 'block', color: '#7a5a12' }}>Obs: {i.observacao}</small>}
                  </span>
                  <span>{formatarMoeda(i.subtotal)}</span>
                </div>
              ))}
              {p.observacao && <div style={{ color: '#7a5a12', fontSize: '0.85rem' }}>Obs: {p.observacao}</div>}
            </div>
          ))}

        {dados && dados.subtotal > 0 && (
          <div className="prato" style={{ display: 'block' }}>
            <div className="linha-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span>{formatarMoeda(dados.subtotal)}</span>
            </div>
            <div className="linha-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Taxa de serviço (10%)</span>
              <span>{formatarMoeda(dados.taxaServico)}</span>
            </div>
            <div className="destaque-total" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total</span>
              <span>{formatarMoeda(dados.subtotal + dados.taxaServico)}</span>
            </div>
          </div>
        )}

        {dados && dados.fechamentoPendente && (
          <div className="aviso-fechado" style={{ borderRadius: 8, marginBottom: 10 }}>
            Conta solicitada — a equipe está a caminho.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <button className="btn-confirmar" style={{ padding: 14, borderRadius: 8, border: 'none', background: '#a3352b', color: '#fff', fontSize: '1rem' }} type="button" onClick={onPedirMais}>
            Pedir mais
          </button>
          <button
            className="btn-cancelar"
            style={{ padding: 14, borderRadius: 8, border: 'none', background: '#eee', fontSize: '1rem' }}
            type="button"
            disabled={!dados || dados.subtotal <= 0}
            onClick={() => setFechando(true)}
          >
            Fechar conta
          </button>
          {temOutras && (
            <button
              type="button"
              onClick={onTrocar}
              style={{ background: 'none', border: 'none', color: '#a3352b', fontSize: '0.95rem', padding: 8 }}
            >
              ← Ver outras comandas da mesa
            </button>
          )}
        </div>
      </main>

      {fechando && <ModalFecharConta mesaAtual={comandaId} onFechar={() => setFechando(false)} />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="vazio">Carregando...</div>}>
      <PaginaCliente />
    </Suspense>
  );
}
