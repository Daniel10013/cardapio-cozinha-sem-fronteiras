import { subtotalDaMesa, calcularTaxaServico } from '@/lib/contas';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mesa = (searchParams.get('mesa') || '').trim();
  if (!mesa) return Response.json({ erro: 'Informe o número da mesa.' }, { status: 400 });

  const subtotal = await subtotalDaMesa(mesa);
  const taxaServico = calcularTaxaServico(subtotal);
  return Response.json({ mesa, subtotal, taxaServico });
}
