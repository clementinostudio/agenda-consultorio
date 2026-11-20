// Datas e horas: tudo no horário do aparelho, com as datas em texto "AAAA-MM-DD" (como o app guarda).
// Sem dependências: dá para usar em qualquer parte do app e nos testes.
export const DIA_CURTO = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
export const DIA_LONGO = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
export const SEMANA = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
export const MES_CURTO = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export const MES_LONGO = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

export const pad = n => String(n).padStart(2, "0");
export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
export const todayISO = () => toISO(new Date());
export const segunda = iso => addDays(iso, -((fromISO(iso).getDay() + 6) % 7));
export const diasNoMes = chave => { const [y, m] = chave.split("-").map(Number); return new Date(y, m, 0).getDate(); };
export const dm = iso => { const d = fromISO(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const diaCurto = iso => { const d = fromISO(iso); return `${DIA_CURTO[d.getDay()].toLowerCase()}, ${d.getDate()} ${MES_CURTO[d.getMonth()]}`; };
export const relativo = iso => {
  const t = todayISO();
  if (iso === t) return "Hoje";
  if (iso === addDays(t, 1)) return "Amanhã";
  if (iso === addDays(t, -1)) return "Ontem";
  return diaCurto(iso);
};
export const mins = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
export const hhmm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
export const duracao = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ""}`;
export const agoraMin = d => d.getHours() * 60 + d.getMinutes();
export const diffDias = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);
