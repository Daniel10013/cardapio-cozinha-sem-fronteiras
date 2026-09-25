import { estaAutenticado } from '@/lib/auth';

export async function GET() {
  const autenticado = await estaAutenticado();
  return Response.json({ autenticado });
}
