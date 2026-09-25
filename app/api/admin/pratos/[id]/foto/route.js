import { requireAuth } from '@/lib/auth';
import { supabaseAdmin, UPLOADS_BUCKET } from '@/lib/supabaseAdmin';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5MB

export async function POST(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const formData = await request.formData();
  const arquivo = formData.get('foto');

  if (!arquivo || typeof arquivo === 'string') {
    return Response.json({ erro: 'Nenhuma imagem enviada.' }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    return Response.json({ erro: 'Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.' }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return Response.json({ erro: 'Imagem muito grande (máximo 5MB).' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: atual, error: erroAtual } = await db.from('pratos').select('foto').eq('id', id).maybeSingle();
  if (erroAtual) return Response.json({ erro: erroAtual.message }, { status: 500 });
  if (!atual) return Response.json({ erro: 'Prato não encontrado.' }, { status: 404 });

  const extensao = arquivo.name.split('.').pop() || 'jpg';
  const caminho = `prato-${id}-${Date.now()}.${extensao}`;
  const bytes = new Uint8Array(await arquivo.arrayBuffer());

  const { error: erroUpload } = await db.storage
    .from(UPLOADS_BUCKET)
    .upload(caminho, bytes, { contentType: arquivo.type, upsert: false });
  if (erroUpload) return Response.json({ erro: erroUpload.message }, { status: 500 });

  if (atual.foto) {
    const nomeAntigo = atual.foto.split('/').pop();
    await db.storage.from(UPLOADS_BUCKET).remove([nomeAntigo]);
  }

  const { data: publicUrlData } = db.storage.from(UPLOADS_BUCKET).getPublicUrl(caminho);
  await db.from('pratos').update({ foto: publicUrlData.publicUrl }).eq('id', id);

  return Response.json({ ok: true, foto: publicUrlData.publicUrl });
}

export async function DELETE(request, { params }) {
  const naoAutenticado = await requireAuth();
  if (naoAutenticado) return naoAutenticado;

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: atual, error: erroAtual } = await db.from('pratos').select('foto').eq('id', id).maybeSingle();
  if (erroAtual) return Response.json({ erro: erroAtual.message }, { status: 500 });
  if (!atual) return Response.json({ erro: 'Prato não encontrado.' }, { status: 404 });

  if (atual.foto) {
    const nomeArquivo = atual.foto.split('/').pop();
    await db.storage.from(UPLOADS_BUCKET).remove([nomeArquivo]);
  }

  await db.from('pratos').update({ foto: '' }).eq('id', id);
  return Response.json({ ok: true });
}
