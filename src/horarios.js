// Horários de atendimento em períodos: cada dia da semana marca manhã, tarde e/ou noite.
// Assim a pessoa monta a semana com poucos toques, sem digitar hora por hora.
// Perfis antigos (só "das 8h às 20h, de seg a sex") continuam valendo do mesmo jeito.

export const PERIODOS = ["manha", "tarde", "noite"];
export const NOME_PERIODO = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
export const PERIODOS_PADRAO = { manha: [8, 12], tarde: [13, 18], noite: [18, 21] };

// Atalhos para montar a semana de uma vez
export const MODELOS = [
  { id: "comercial", nome: "Seg a sex, manhã e tarde", grade: { 1: ["manha", "tarde"], 2: ["manha", "tarde"], 3: ["manha", "tarde"], 4: ["manha", "tarde"], 5: ["manha", "tarde"] } },
  { id: "tardes", nome: "Seg a sex, tarde e noite", grade: { 1: ["tarde", "noite"], 2: ["tarde", "noite"], 3: ["tarde", "noite"], 4: ["tarde", "noite"], 5: ["tarde", "noite"] } },
  { id: "limpar", nome: "Limpar", grade: {} },
];

export const periodosDo = pf => ({ ...PERIODOS_PADRAO, ...((pf && pf.periodos) || {}) });

// Períodos para quem ainda tem o horário antigo: as pontas seguem o início e o fim de antes (8h às 20h: a noite vai até as 20h)
export function periodosIniciais(pf) {
  if (!pf || pf.periodos || pf.grade) return (pf && pf.periodos) || {};
  const hi = pf.horaIni ?? 8, hf = pf.horaFim ?? 20, out = {};
  PERIODOS.forEach(k => { const [a, b] = PERIODOS_PADRAO[k]; if (a < hf && hi < b && (hi > a || hf < b)) out[k] = [Math.max(a, hi), Math.min(b, hf)]; });
  return out;
}

// A grade do perfil; quem ainda não tem ganha a equivalente ao horário antigo
export function gradeDo(pf) {
  if (pf && pf.grade) return pf.grade;
  const hi = (pf && pf.horaIni) ?? 8, hf = (pf && pf.horaFim) ?? 20, dias = (pf && pf.diasTrab) || [1, 2, 3, 4, 5];
  const per = PERIODOS.filter(k => { const [a, b] = PERIODOS_PADRAO[k]; return a < hf && hi < b; });
  const g = {}; dias.forEach(d => { g[d] = per; });
  return g;
}

// Janelas do dia em minutos ([[início, fim], ...]); períodos encostados viram uma janela só
export function janelasDoDia(pf, dow) {
  if (!pf || !pf.grade) {
    const dias = (pf && pf.diasTrab) || [1, 2, 3, 4, 5];
    return dias.includes(dow) ? [[((pf && pf.horaIni) ?? 8) * 60, ((pf && pf.horaFim) ?? 20) * 60]] : [];
  }
  const P = periodosDo(pf);
  const js = (pf.grade[dow] || []).filter(k => P[k]).map(k => [P[k][0] * 60, P[k][1] * 60]).sort((a, b) => a[0] - b[0]);
  const out = [];
  js.forEach(j => { const u = out[out.length - 1]; if (u && j[0] <= u[1]) u[1] = Math.max(u[1], j[1]); else out.push([...j]); });
  return out;
}

// Os campos antigos (horaIni, horaFim, diasTrab), para as partes do app que ainda os leem
export function resumoGrade(grade, periodos) {
  const P = { ...PERIODOS_PADRAO, ...(periodos || {}) };
  const dias = [0, 1, 2, 3, 4, 5, 6].filter(d => (grade[d] || []).length);
  const usados = dias.flatMap(d => grade[d]).filter(k => P[k]);
  if (!usados.length) return { horaIni: 8, horaFim: 20, diasTrab: [] };
  return { horaIni: Math.min(...usados.map(k => P[k][0])), horaFim: Math.max(...usados.map(k => P[k][1])), diasTrab: dias };
}
