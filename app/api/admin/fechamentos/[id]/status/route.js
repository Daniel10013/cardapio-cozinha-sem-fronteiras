import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status } = body || {};
  if (!['pendente', 'concluido'].includes(status)) {
    return Response.json({ erro: 'Status inválido.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from('fechamentos').update({ status }).eq('id', id);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
