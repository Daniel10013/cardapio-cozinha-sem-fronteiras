// Datas no horário de Brasília (UTC-3, sem horário de verão desde 2019).
// O servidor da Vercel roda em UTC, então "dia" e "mês" precisam ser calculados aqui.
const BRT_MS = 3 * 3600000;

export function diaBR(iso) {
  return new Date(new Date(iso).getTime() - BRT_MS).toISOString().slice(0, 10);
}

export function mesBR(iso) {
  return diaBR(iso).slice(0, 7);
}

export function mesValido(mes) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '');
}

// Início do mês (00:00 em Brasília) e início do mês seguinte, em ISO/UTC.
export function limitesMesBR(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return {
    inicio: new Date(Date.UTC(ano, m - 1, 1) + BRT_MS).toISOString(),
    fim: new Date(Date.UTC(ano, m, 1) + BRT_MS).toISOString(),
  };
}
