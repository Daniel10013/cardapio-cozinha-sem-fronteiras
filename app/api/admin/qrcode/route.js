import QRCode from 'qrcode';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) return Response.json({ erro: 'Parâmetro url é obrigatório.' }, { status: 400 });

  try {
    const png = await QRCode.toBuffer(url, { width: 300, margin: 1 });
    return new Response(png, { headers: { 'Content-Type': 'image/png' } });
  } catch (err) {
    return Response.json({ erro: 'Falha ao gerar QR Code.' }, { status: 500 });
  }
}
