import { solicitarFechamento } from '@/lib/contas';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const resultado = await solicitarFechamento(body?.mesa);
  if (resultado.erro) return Response.json({ erro: resultado.erro }, { status: resultado.status });

  const { fechamento, criado } = resultado;
  return Response.json(criado ? fechamento : { ...fechamento, jaSolicitado: true }, { status: criado ? 201 : 200 });
}
