import { getConfig } from '@/lib/config';

export async function GET() {
  const valor = await getConfig('loja_aberta');
  return Response.json({ aberto: valor !== '0' });
}
