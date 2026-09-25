import { requireAuth, changePassword } from '@/lib/auth';

export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const body = await request.json().catch(() => ({}));
  const { novaSenha } = body || {};
  if (!novaSenha || novaSenha.length < 4) {
    return Response.json({ erro: 'A nova senha precisa ter pelo menos 4 caracteres.' }, { status: 400 });
  }

  await changePassword(novaSenha);
  return Response.json({ ok: true });
}
