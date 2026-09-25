-- ---------------------------------------------------------------------------
-- Cozinha Sem Fronteiras — esquema do banco de dados (Supabase / Postgres)
--
-- Como usar: no painel do Supabase, vá em "SQL Editor" > "New query", cole
-- este arquivo inteiro e clique em "Run". Cria todas as tabelas do zero.
--
-- SEGURO PARA UM BANCO COMPARTILHADO: todas as tabelas usam o prefixo
-- "csf_" (Cozinha Sem Fronteiras) para nunca colidir com tabelas de outros
-- projetos que já existam no mesmo banco. Todo comando abaixo é aditivo
-- ("create table if not exists", "create index if not exists") — nunca
-- apaga, altera ou sobrescreve nada que já exista. Se alguma tabela "csf_*"
-- já existir (rodou este script antes), o comando correspondente é
-- simplesmente ignorado, sem erro.
--
-- Todo acesso ao banco passa pelas rotas de servidor do Next.js
-- (app/api/**), que usam a chave "service_role" (acesso total, só no
-- servidor) — o navegador do cliente nunca fala direto com o Supabase.
-- Mesmo assim, o RLS (Row Level Security) é ligado em todas as tabelas
-- abaixo, sem nenhuma política de acesso — isso bloqueia qualquer tentativa
-- de acessar essas tabelas com a chave "anon" (pública), enquanto o
-- service_role continua funcionando normalmente (ele sempre ignora RLS).
-- ---------------------------------------------------------------------------

create table if not exists csf_categorias (
  id bigint generated always as identity primary key,
  nome text not null,
  ordem integer not null default 0
);

create table if not exists csf_pratos (
  id bigint generated always as identity primary key,
  categoria_id bigint not null references csf_categorias(id) on delete cascade,
  nome text not null,
  descricao text default '',
  preco numeric(10,2) not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  foto text default '',
  tempo_preparo integer default 0
);

create table if not exists csf_pedidos (
  id bigint generated always as identity primary key,
  mesa text default '',
  observacao text default '',
  status text not null default 'recebido',
  total numeric(10,2) not null,
  criado_em timestamptz not null default now()
);

create table if not exists csf_itens_pedido (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references csf_pedidos(id) on delete cascade,
  prato_id bigint,
  nome_prato text not null,
  preco_unitario numeric(10,2) not null,
  quantidade integer not null,
  subtotal numeric(10,2) not null
);

create table if not exists csf_fechamentos (
  id bigint generated always as identity primary key,
  mesa text not null,
  subtotal numeric(10,2) not null,
  taxa_servico numeric(10,2) not null,
  incluiu_servico boolean not null default true,
  total numeric(10,2) not null,
  status text not null default 'pendente',
  criado_em timestamptz not null default now()
);

create table if not exists csf_config (
  chave text primary key,
  valor text not null
);

create table if not exists csf_acessos_admin (
  id bigint generated always as identity primary key,
  ip text not null,
  criado_em timestamptz not null default now()
);

create table if not exists csf_tentativas_login (
  ip text primary key,
  falhas integer not null default 0,
  bloqueado_ate timestamptz
);

-- RLS ligado, sem políticas: bloqueia todo acesso via chave "anon" (pública),
-- mas não afeta em nada o service_role usado pelo servidor (ele sempre
-- ignora RLS). Sem isso, qualquer pessoa com a chave anon conseguiria ler
-- ou alterar essas tabelas direto pela API do Supabase, sem passar pelo
-- login do painel.
alter table csf_categorias enable row level security;
alter table csf_pratos enable row level security;
alter table csf_pedidos enable row level security;
alter table csf_itens_pedido enable row level security;
alter table csf_fechamentos enable row level security;
alter table csf_config enable row level security;
alter table csf_acessos_admin enable row level security;
alter table csf_tentativas_login enable row level security;

-- Índices usados pelas consultas mais comuns (mês do pedido, mesa do dia)
create index if not exists idx_csf_pedidos_criado_em on csf_pedidos (criado_em);
create index if not exists idx_csf_pedidos_mesa on csf_pedidos (mesa);
create index if not exists idx_csf_itens_pedido_pedido_id on csf_itens_pedido (pedido_id);
create index if not exists idx_csf_fechamentos_status on csf_fechamentos (status);

-- Cardápio inicial de exemplo (só roda se csf_categorias estiver vazia)
do $$
declare
  cat_entradas bigint;
  cat_principais bigint;
  cat_bebidas bigint;
begin
  if (select count(*) from csf_categorias) = 0 then
    insert into csf_categorias (nome, ordem) values ('Entradas', 1) returning id into cat_entradas;
    insert into csf_categorias (nome, ordem) values ('Pratos Principais', 2) returning id into cat_principais;
    insert into csf_categorias (nome, ordem) values ('Bebidas', 3) returning id into cat_bebidas;

    insert into csf_pratos (categoria_id, nome, descricao, preco, ordem) values
      (cat_entradas, 'Pão de Alho', 'Porção com 6 unidades', 18.0, 1),
      (cat_entradas, 'Batata Frita', 'Porção grande', 22.0, 2),
      (cat_principais, 'Filé à Parmegiana', 'Acompanha arroz e fritas', 48.0, 1),
      (cat_principais, 'Frango Grelhado', 'Acompanha salada e arroz', 38.0, 2),
      (cat_bebidas, 'Refrigerante Lata', '350ml', 7.0, 1),
      (cat_bebidas, 'Suco Natural', '500ml', 10.0, 2);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage (fotos dos pratos e logo do restaurante)
--
-- O SQL Editor não cria buckets de Storage. Faça manualmente uma vez:
--   1. No painel do Supabase, vá em "Storage" > "New bucket"
--   2. Nome: csf-uploads  (nome específico deste projeto, para não colidir
--      com um bucket "uploads" genérico que já exista no seu banco)
--   3. Marque "Public bucket" (as fotos do cardápio precisam ser públicas
--      para aparecer no site do cliente)
--   4. Criar
-- O código já está pronto para usar esse bucket (ver lib/supabaseAdmin.js).
-- ---------------------------------------------------------------------------
