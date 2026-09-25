import { verifyPassword, criarSessao, statusBloqueio, registrarTentativaFalha, limparTentativas } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClientIp } from '@/lib/ip';

export async function POST(request) {
  const ip = getClientIp(request);

  const bloqueio = await statusBloqueio(ip);
  if (bloqueio.bloqueado) {
    return Response.json(
      { erro: `Muitas tentativas erradas. Tente novamente em ${bloqueio.minutosRestantes} minuto(s).` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { senha } = body || {};

  if (!senha || !(await verifyPassword(senha))) {
    await registrarTentativaFalha(ip);
    return Response.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  await limparTentativas(ip);
  await criarSessao();
  await supabaseAdmin()
    .from('acessos_admin')
    .insert({ ip, criado_em: new Date().toISOString() });

  return Response.json({ ok: true });
}
