# Deploy — Cozinha Sem Fronteiras (Next.js + Supabase + Vercel)

Este projeto foi reescrito em **Next.js** (React) com banco de dados no **Supabase**
(Postgres), pronto para hospedar na **Vercel**. Este guia mostra o passo a passo
completo, do zero até o site no ar.

## Como o projeto está organizado agora

- **Frontend:** React dentro do Next.js (`app/page.js` = cardápio do cliente,
  `app/admin/page.js` = painel administrativo). Não usa mais HTML/JS "puro".
- **Backend:** rotas de API do Next.js em `app/api/**/route.js` — cada uma é uma
  função que roda no servidor da Vercel (substituem o antigo `server/` do
  Express).
- **Banco de dados:** Supabase (Postgres), em vez do SQLite local. O esquema
  está em `supabase/schema.sql`. Todas as tabelas usam o prefixo **`csf_`**
  (ex: `csf_pedidos`, `csf_pratos`) de propósito — se você conectar este
  projeto a um banco Supabase que **já tem outras coisas** (de outro
  projeto), o prefixo garante que nada colide com o que já existe. O script
  só cria (`create table if not exists`), nunca apaga ou altera nada que já
  esteja lá.
- **Arquivos (fotos dos pratos, logo):** Supabase Storage, num bucket próprio
  chamado `csf-uploads` (também prefixado, pelo mesmo motivo acima) — em vez
  da pasta `public/uploads/` local (que só existia no seu computador).
- **Login do painel:** continua com senha única, mas agora usa um cookie
  assinado (JWT) em vez de sessão guardada na memória do servidor — necessário
  porque a Vercel roda cada requisição numa função "sem estado" (serverless),
  que não mantém nada guardado entre uma chamada e outra.

## Sobre "migration" — você precisa rodar alguma?

Não tem um sistema de migration (tipo Prisma/Knex) aqui — é só **um arquivo
SQL** (`supabase/schema.sql`) que você roda **uma vez** no SQL Editor do
Supabase (Passo 1.5 abaixo) para criar as tabelas. Se um dia eu mudar o
esquema (adicionar uma coluna nova, por exemplo), eu te aviso e te dou um
segundo arquivo SQL só com o `alter table` necessário — nunca vou pedir pra
rodar o `schema.sql` inteiro de novo por cima de um banco que já tem dados,
pra não arriscar nada.

## Passo 1 — Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) (pode entrar com GitHub).
2. Clique em **"New project"**. Escolha um nome, uma senha de banco (guarde
   essa senha — é diferente da senha do painel do restaurante) e a região mais
   próxima (ex: South America).
3. Espere o projeto ser criado (leva ~2 minutos).
4. Vá em **SQL Editor** (menu lateral) > **New query**.
5. Abra o arquivo `supabase/schema.sql` deste projeto, copie todo o conteúdo,
   cole no editor e clique em **Run**. Isso cria as tabelas `csf_*` e já
   deixa um cardápio de exemplo cadastrado — **se você já tem outras tabelas
   nesse banco, elas não são tocadas**, o script só adiciona as suas.
6. Vá em **Storage** (menu lateral) > **New bucket**. Nome: `csf-uploads`.
   Marque **"Public bucket"** (precisa ser público para as fotos aparecerem
   no cardápio). Clique em **Create bucket**.
7. Vá em **Project Settings** (ícone de engrenagem) > **API**. Você vai
   precisar de três valores nessa tela para o próximo passo:
   - **Project URL**
   - **anon / public key**
   - **service_role key** (clique em "Reveal" para ver) — **essa é secreta,
     nunca compartilhe ou coloque em código público**.

## Passo 2 — Criar o projeto na Vercel

1. Crie uma conta em [vercel.com](https://vercel.com) (pode entrar com GitHub).
2. Suba este projeto para um repositório no **GitHub** (a Vercel importa
   direto de lá). Se você ainda não sabe usar Git, me avise que eu te ajudo
   com os comandos.
3. Na Vercel, clique em **"Add New..." > "Project"** e escolha o repositório.
4. A Vercel detecta automaticamente que é um projeto Next.js — não precisa
   mudar nada nas configurações de build.
5. **Antes de clicar em Deploy**, abra a seção **"Environment Variables"** e
   cadastre cada uma destas (veja `.env.example` para a lista completa e
   comentada):

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | o "Project URL" do Supabase (passo 1.7) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a "anon / public key" |
   | `SUPABASE_SERVICE_ROLE_KEY` | a "service_role key" (secreta) |
   | `SESSION_SECRET` | uma string longa e aleatória (veja abaixo como gerar) |
   | `ADMIN_INITIAL_PASSWORD` | a senha inicial do painel (troque depois) |
   | `NEXT_PUBLIC_SITE_URL` | deixe em branco por enquanto — volte aqui no Passo 4 |

   Para gerar o `SESSION_SECRET`, rode isso no seu computador (com Node
   instalado) e cole o resultado:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

6. Clique em **Deploy**. Em 1-2 minutos o site estará no ar, com uma URL tipo
   `https://cozinha-sem-fronteiras.vercel.app`.

## Passo 3 — Testar

1. Abra a URL que a Vercel te deu. Deve aparecer a tela de boas-vindas do
   cardápio.
2. Acesse `/admin` (ex: `https://cozinha-sem-fronteiras.vercel.app/admin`) e
   entre com a senha que você colocou em `ADMIN_INITIAL_PASSWORD`.
3. **Troque a senha imediatamente** na aba Configurações.
4. Cadastre o nome do restaurante e a logo (aba Configurações).
5. Teste um pedido de ponta a ponta: cardápio > fazer pedido > ver no painel.

## Passo 4 — Ajustar o endereço público (importante para os QR Codes)

Depois do primeiro deploy, você já tem a URL definitiva. Volte em **Project
Settings > Environment Variables** na Vercel e edite `NEXT_PUBLIC_SITE_URL`
para a URL real do site (ex: `https://cozinha-sem-fronteiras.vercel.app`, sem
barra no final). Depois disso, vá em **Deployments** e clique em **Redeploy**
para aplicar.

Isso faz os QR Codes gerados na aba "QR Codes" do painel apontarem para o
endereço certo. Se você comprar um domínio próprio (ex:
`cardapio.emporiosemfronteiras.com.br`) e configurá-lo na Vercel, atualize
essa variável para o domínio próprio.

## Diferença importante: antes era só na sua rede, agora é público na internet

Como isso agora fica hospedado na internet (não mais só no Wi-Fi do
restaurante), **qualquer pessoa com o link consegue acessar o cardápio**, de
qualquer lugar — isso é bom para pedidos remotos, mas significa que a
segurança da senha do painel importa ainda mais. Pontos já cobertos:

- ✅ Sem sessão em memória — funciona corretamente mesmo com várias funções
  serverless da Vercel rodando ao mesmo tempo.
- ✅ Bloqueio de 10 minutos após 5 tentativas erradas de senha, guardado no
  Supabase (funciona entre diferentes execuções da função, diferente da
  versão local que usava memória).
- ✅ A `service_role key` do Supabase (acesso total ao banco) só é usada nas
  rotas de servidor — nunca é enviada ao navegador do cliente.
- ✅ Cookie de sessão do painel é `httpOnly` (JavaScript não consegue lê-lo,
  protege contra roubo via XSS) e `secure` em produção (só trafega por
  HTTPS, que a Vercel já fornece automaticamente).
- ✅ Upload de fotos valida tipo de arquivo e tamanho máximo (5MB) antes de
  aceitar.

**Recomendações que ficam por sua conta:**
- Troque a senha padrão assim que o site for ao ar (não deixe
  `ADMIN_INITIAL_PASSWORD` valendo por muito tempo).
- Nunca compartilhe a `SUPABASE_SERVICE_ROLE_KEY` nem cole ela em nenhum
  lugar público (chat, repositório, print de tela).
- Se quiser, mais pra frente dá pra evoluir para contas individuais por
  funcionário (em vez de uma senha só compartilhada) — é um passo a mais que
  não fizemos agora para manter simples.

## Rodando localmente para testar antes de subir

1. Copie `.env.example` para `.env.local` e preencha com os valores do seu
   Supabase (mesmos do Passo 1).
2. `npm install`
3. `npm run dev`
4. Abra `http://localhost:3000`

## O que aconteceu com a versão antiga (Node + Express + SQLite)

Ela foi guardada como backup em
`C:\Users\User\Desktop\Aplicativo-backup-node-express`, no seu computador, e
também está preservada nos arquivos deste projeto até você confirmar que a
versão nova está tudo funcionando (o `data/restaurante.db` antigo continua
aí, mas não é mais usado). Depois que o Supabase estiver com os dados reais,
pode apagar esse backup se não precisar mais dele.
