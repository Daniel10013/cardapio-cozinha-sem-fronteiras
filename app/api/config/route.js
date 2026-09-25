import { getConfig } from '@/lib/config';

export async function GET() {
  const nomeLoja = (await getConfig('nome_loja')) || 'Cozinha Sem Fronteiras';
  const logoUrl = (await getConfig('logo_url')) || '';
  return Response.json({ nomeLoja, logoUrl });
}
