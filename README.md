# Cardápio Cozinha Sem Fronteiras

Sistema de pedidos via QR Code para restaurante — cardápio do cliente, pedidos
por mesa (comanda junta ou separada), fechamento de conta com taxa de
serviço, e painel administrativo completo (pedidos, relatório mensal,
cardápio, QR Codes por mesa, personalização de marca).

Construído em **Next.js** (React) com banco de dados **Supabase** (Postgres),
pronto para deploy na **Vercel**.

## Deploy

Veja o passo a passo completo em **[DEPLOY.md](DEPLOY.md)** — criação do
projeto Supabase, esquema do banco, variáveis de ambiente e deploy na Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com suas credenciais do Supabase
npm run dev
```
