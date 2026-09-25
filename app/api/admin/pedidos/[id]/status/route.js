import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const STATUS_VALIDOS = ['recebido', 'em preparo', 'pronto', 'entregue', 'cancelado'];

export async function PATCH(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status } = body || {};
  if (!STATUS_VALIDOS.includes(status)) {
    return Response.json({ erro: 'Status inválido.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from('csf_pedidos').update({ status }).eq('id', id);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
