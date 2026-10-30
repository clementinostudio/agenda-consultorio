// Como o Avina escreve dinheiro, distância e datas
export const preco = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const km = (d?: number | null) => (d == null ? '' : d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace('.', ',')} km`);
export const dm = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const hojeLongo = (d = new Date()) => `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
export const saudacao = (d = new Date()) => (d.getHours() < 5 ? 'Boa noite' : d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite');

// lê e grava uma escolha no aparelho (o mesmo localStorage que a lógica do site usa)
export function lerGuardado<T>(chave: string, padrao: T): T {
  try { const v = localStorage.getItem(chave); return v ? { ...padrao, ...JSON.parse(v) } : padrao; } catch { return padrao; }
}
export function guardar(chave: string, v: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(v)); } catch {}
}
