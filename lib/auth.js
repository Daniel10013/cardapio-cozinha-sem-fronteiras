import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';
import { getConfig, setConfig } from './config';

const COOKIE_NAME = 'admin_session';
const SESSION_DURATION_SEG = 60 * 60 * 12; // 12 horas

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET não configurado (ou curto demais). Defina uma string longa e aleatória nas variáveis de ambiente.'
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------- Senha do painel ----------

export async function ensureAdminPassword() {
  let hash = await getConfig('admin_password_hash');
  if (!hash) {
    const senhaInicial = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
    hash = bcrypt.hashSync(senhaInicial, 10);
    await setConfig('admin_password_hash', hash);
  }
  return hash;
}

export async function verifyPassword(senha) {
  const hash = await ensureAdminPassword();
  return bcrypt.compareSync(senha, hash);
}

export async function changePassword(novaSenha) {
  const hash = bcrypt.hashSync(novaSenha, 10);
  await setConfig('admin_password_hash', hash);
}

// ---------- Cookie de sessão (sem estado em memória — funciona em serverless) ----------

export async function criarSessao() {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SEG}s`)
    .sign(getSecretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_SEG,
    path: '/',
  });
}

export async function destruirSessao() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function estaAutenticado() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

// Uso nas rotas de API: retorna null se autenticado, ou uma Response 401 pronta para devolver.
export async function requireAuth() {
  const ok = await estaAutenticado();
  if (!ok) {
    return Response.json({ erro: 'Não autenticado' }, { status: 401 });
  }
  return null;
}

// ---------- Bloqueio por tentativas erradas de senha ----------
// Guardado no Supabase (não em memória) porque funções serverless na Vercel
// não compartilham memória entre invocações.

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 10;

export async function statusBloqueio(ip) {
  const { data } = await supabaseAdmin().from('tentativas_login').select('*').eq('ip', ip).maybeSingle();
  if (!data || !data.bloqueado_ate) return { bloqueado: false };

  const bloqueadoAte = new Date(data.bloqueado_ate);
  if (Date.now() >= bloqueadoAte.getTime()) {
    await supabaseAdmin().from('tentativas_login').delete().eq('ip', ip);
    return { bloqueado: false };
  }
  const minutosRestantes = Math.ceil((bloqueadoAte.getTime() - Date.now()) / 60000);
  return { bloqueado: true, minutosRestantes };
}

export async function registrarTentativaFalha(ip) {
  const { data } = await supabaseAdmin().from('tentativas_login').select('*').eq('ip', ip).maybeSingle();
  const falhas = (data?.falhas || 0) + 1;

  if (falhas >= MAX_TENTATIVAS) {
    const bloqueadoAte = new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString();
    await supabaseAdmin().from('tentativas_login').upsert({ ip, falhas: 0, bloqueado_ate: bloqueadoAte });
  } else {
    await supabaseAdmin().from('tentativas_login').upsert({ ip, falhas, bloqueado_ate: null });
  }
}

export async function limparTentativas(ip) {
  await supabaseAdmin().from('tentativas_login').delete().eq('ip', ip);
}
