import { destruirSessao } from '@/lib/auth';

export async function POST() {
  await destruirSessao();
  return Response.json({ ok: true });
}
