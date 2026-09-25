-- ---------------------------------------------------------------------------
-- Cozinha Sem Fronteiras — esquema do banco de dados (Supabase / Postgres)
--
-- Como usar: no painel do Supabase, vá em "SQL Editor" > "New query", cole
-- este arquivo inteiro e clique em "Run". Cria todas as tabelas do zero.
--
-- Este projeto NÃO usa Row Level Security (RLS) porque todo acesso ao banco
-- passa pelas rotas de servidor do Next.js (app/api/**), que usam a chave
-- "service_role" (acesso total, só no servidor). O navegador do cliente
-- nunca fala direto com o Supabase. Por isso as tabelas ficam com RLS
-- desligado por padrão — é seguro NESTE desenho, porque a service_role key
-- nunca é exposta ao navegador (ver .env.example).
-- ---------------------------------------------------------------------------

create table if not exists categorias (
  id bigint generated always as identity primary key,
  nome text not null,
  ordem integer not null default 0
);

create table if not exists pratos (
  id bigint generated always as identity primary key,
  categoria_id bigint not null references categorias(id) on delete cascade,
  nome text not null,
  descricao text default '',
  preco numeric(10,2) not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  foto text default '',
  tempo_preparo integer default 0
);

create table if not exists pedidos (
  id bigint generated always as identity primary key,
  mesa text default '',
  observacao text default '',
  status text not null default 'recebido',
  total numeric(10,2) not null,
  criado_em timestamptz not null default now()
);

create table if not exists itens_pedido (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references pedidos(id) on delete cascade,
  prato_id bigint,
  nome_prato text not null,
  preco_unitario numeric(10,2) not null,
  quantidade integer not null,
  subtotal numeric(10,2) not null
);

create table if not exists fechamentos (
  id bigint generated always as identity primary key,
  mesa text not null,
  subtotal numeric(10,2) not null,
  taxa_servico numeric(10,2) not null,
  incluiu_servico boolean not null default true,
  total numeric(10,2) not null,
  status text not null default 'pendente',
  criado_em timestamptz not null default now()
);

create table if not exists config (
  chave text primary key,
  valor text not null
);

create table if not exists acessos_admin (
  id bigint generated always as identity primary key,
  ip text not null,
  criado_em timestamptz not null default now()
);

create table if not exists tentativas_login (
  ip text primary key,
  falhas integer not null default 0,
  bloqueado_ate timestamptz
);

-- Índices usados pelas consultas mais comuns (mês do pedido, mesa do dia)
create index if not exists idx_pedidos_criado_em on pedidos (criado_em);
create index if not exists idx_pedidos_mesa on pedidos (mesa);
create index if not exists idx_itens_pedido_pedido_id on itens_pedido (pedido_id);
create index if not exists idx_fechamentos_status on fechamentos (status);

-- Cardápio inicial de exemplo (só roda se as tabelas estiverem vazias)
do $$
declare
  cat_entradas bigint;
  cat_principais bigint;
  cat_bebidas bigint;
begin
  if (select count(*) from categorias) = 0 then
    insert into categorias (nome, ordem) values ('Entradas', 1) returning id into cat_entradas;
    insert into categorias (nome, ordem) values ('Pratos Principais', 2) returning id into cat_principais;
    insert into categorias (nome, ordem) values ('Bebidas', 3) returning id into cat_bebidas;

    insert into pratos (categoria_id, nome, descricao, preco, ordem) values
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
--   2. Nome: uploads
--   3. Marque "Public bucket" (as fotos do cardápio precisam ser públicas
--      para aparecer no site do cliente)
--   4. Criar
-- O código já está pronto para usar esse bucket (ver lib/supabaseAdmin.js).
-- ---------------------------------------------------------------------------
