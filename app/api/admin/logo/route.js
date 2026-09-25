import { requireAuth } from '@/lib/auth';
import { getConfig, setConfig } from '@/lib/config';
import { supabaseAdmin, UPLOADS_BUCKET } from '@/lib/supabaseAdmin';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5MB

export async function POST(request) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const formData = await request.formData();
  const arquivo = formData.get('logo');

  if (!arquivo || typeof arquivo === 'string') {
    return Response.json({ erro: 'Nenhuma imagem enviada.' }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    return Response.json({ erro: 'Formato de imagem não suportado. Use JPG, PNG, WEBP, GIF ou SVG.' }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return Response.json({ erro: 'Imagem muito grande (máximo 5MB).' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const extensao = arquivo.name.split('.').pop() || 'jpg';
  const caminho = `logo-${Date.now()}.${extensao}`;
  const bytes = new Uint8Array(await arquivo.arrayBuffer());

  const { error: erroUpload } = await db.storage
    .from(UPLOADS_BUCKET)
    .upload(caminho, bytes, { contentType: arquivo.type, upsert: false });
  if (erroUpload) return Response.json({ erro: erroUpload.message }, { status: 500 });

  const logoAntiga = await getConfig('logo_url');
  if (logoAntiga) {
    const nomeAntigo = logoAntiga.split('/').pop();
    await db.storage.from(UPLOADS_BUCKET).remove([nomeAntigo]);
  }

  const { data: publicUrlData } = db.storage.from(UPLOADS_BUCKET).getPublicUrl(caminho);
  await setConfig('logo_url', publicUrlData.publicUrl);

  return Response.json({ ok: true, logoUrl: publicUrlData.publicUrl });
}
