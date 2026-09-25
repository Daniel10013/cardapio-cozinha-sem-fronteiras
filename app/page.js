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

function PaginaCliente() {
  const params = useSearchParams();
  const mesaUrl = params.get('mesa') || '';

  const [config, setConfig] = useState({ nomeLoja: 'Cozinha Sem Fronteiras', logoUrl: '' });
  const [tela, setTela] = useState('escolha'); // escolha | comanda | pedido
  const [modo, setModo] = useState(null); // local | levar
  const [mesaAtual, setMesaAtual] = useState(mesaUrl);
  const [nomeComanda, setNomeComanda] = useState('');
  const [mostrarFormComanda, setMostrarFormComanda] = useState(false);

  const [cardapio, setCardapio] = useState([]);
  const [carregandoCardapio, setCarregandoCardapio] = useState(true);
  const [lojaAberta, setLojaAberta] = useState(true);
  const [carrinho, setCarrinho] = useState({}); // { [pratoId]: { prato, quantidade } }

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

  function escolherLocal() {
    setTela('comanda');
  }

  function escolherLevar() {
    setModo('levar');
    setMesaAtual('');
    entrarNoPedido();
  }

  function escolherComandaJunta() {
    setModo('local');
    setMesaAtual(mesaUrl);
    entrarNoPedido();
  }

  function confirmarComandaSeparada() {
    const nome = nomeComanda.trim();
    if (!nome) return alert('Digite seu nome para identificar sua comanda.');
    setModo('local');
    setMesaAtual(mesaUrl ? `${mesaUrl} - ${nome}` : nome);
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

  function alterarQuantidade(prato, delta) {
    setCarrinho((atual) => {
      const item = atual[prato.id] || { prato, quantidade: 0 };
      const quantidade = Math.max(0, item.quantidade + delta);
      return { ...atual, [prato.id]: { prato, quantidade } };
    });
  }

  const itensCarrinho = Object.values(carrinho).filter((i) => i.quantidade > 0);
  const totalCarrinho = itensCarrinho.reduce((acc, i) => acc + i.prato.preco * i.quantidade, 0);

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
              setTela('escolha');
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
                <button className="btn-fechar-conta" onClick={() => setModalFecharConta(true)} type="button">
                  Fechar conta
                </button>
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
                      {prato.foto && <img className="prato-foto" src={prato.foto} alt={prato.nome} />}
                      <div className="prato-info">
                        <div className="nome">{prato.nome}</div>
                        {prato.descricao && <div className="descricao">{prato.descricao}</div>}
                        <div className="preco">{formatarMoeda(prato.preco)}</div>
                        {prato.tempo_preparo ? <div className="tempo-preparo">⏱ {prato.tempo_preparo} min</div> : null}
                      </div>
                      <div className="qtd-controle">
                        <button type="button" aria-label="Diminuir" onClick={() => alterarQuantidade(prato, -1)}>
                          −
                        </button>
                        <span>{carrinho[prato.id]?.quantidade || 0}</span>
                        <button type="button" aria-label="Aumentar" onClick={() => alterarQuantidade(prato, 1)}>
                          +
                        </button>
                      </div>
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

          {modalRevisao && (
            <ModalRevisarPedido
              itens={itensCarrinho}
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

function ModalRevisarPedido({ itens, total, modo, mesaAtual, onFechar, onSucesso }) {
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
          itens: itens.map((i) => ({ pratoId: i.prato.id, quantidade: i.quantidade })),
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
          <div className="linha-item" key={i.prato.id}>
            <span>
              {i.quantidade}x {i.prato.nome}
            </span>
            <span>{formatarMoeda(i.prato.preco * i.quantidade)}</span>
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
          <button className="btn-confirmar" type="button" disabled={enviando} onClick={enviarPedido}>
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
    fetch('/api/conta?mesa=' + encodeURIComponent(mesaAtual))
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
        <div className="linha-item">
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
          <button className="btn-confirmar" type="button" disabled={enviando} onClick={confirmar}>
            {enviando ? 'Enviando...' : 'Chamar para fechar'}
          </button>
        </div>
      </div>
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
