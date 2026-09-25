import { requireAuth } from '@/lib/auth';
import { getConfig, setConfig } from '@/lib/config';

export async function GET() {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const valor = await getConfig('loja_aberta');
  return Response.json({ aberto: valor !== '0' });
}

export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  await setConfig('loja_aberta', body?.aberto ? '1' : '0');
  return Response.json({ ok: true });
}
