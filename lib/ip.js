// Na Vercel, o IP real do visitante vem no cabeçalho x-forwarded-for
// (adicionado automaticamente pela borda da Vercel).
export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'desconhecido';
}
