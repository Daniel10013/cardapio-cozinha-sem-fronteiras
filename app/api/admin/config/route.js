import { requireAuth } from '@/lib/auth';
import { setConfig } from '@/lib/config';

export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  const nomeLoja = (body?.nomeLoja || '').trim();
  if (!nomeLoja) return Response.json({ erro: 'Nome da loja é obrigatório.' }, { status: 400 });

  await setConfig('nome_loja', nomeLoja);
  return Response.json({ ok: true });
}
