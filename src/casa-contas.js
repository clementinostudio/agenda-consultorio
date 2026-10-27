// Contas da casa compartilhada (sem dependências: dá para testar fora do app)
// A parte de cada um num gasto: igual, ou pelos pesos guardados no gasto (divisão proporcional)
export function partes(l, membros) {
  const ids = new Set(membros.map(m => m.id));
  const parts = (l.participantes && l.participantes.length ? l.participantes : membros.map(m => m.id)).filter(id => ids.has(id));
  if (!parts.length) return {};
  const pesos = parts.map(p => (l.pesos && l.pesos[p] > 0 ? l.pesos[p] : l.pesos ? 0 : 1));
  const tot = pesos.reduce((s, p) => s + p, 0) || parts.length;
  return Object.fromEntries(parts.map((p, i) => [p, l.valor * ((tot === parts.length && !l.pesos) ? 1 / parts.length : pesos[i] / tot)]));
}
// Pesos da divisão para um gasto novo, a partir do jeito que a casa divide (igual = sem pesos)
export function pesosDe(config, participantes) {
  if (!config || config.modo !== "proporcional" || !config.pcts) return undefined;
  const p = Object.fromEntries(participantes.map(id => [id, Number(config.pcts[id]) || 0]));
  return Object.values(p).some(v => v > 0) ? p : undefined;
}

// Quem deve quanto. Gasto: quem pagou "adianta" o valor; cada participante deve a sua parte.
// Acerto: quem pagou a dívida (de) para quem recebeu (para).
export function saldos(lanc, acertos, membros) {
  const s = Object.fromEntries(membros.map(m => [m.id, 0]));
  lanc.forEach(l => {
    if (!(l.pagou in s)) return;
    const ps = partes(l, membros); if (!Object.keys(ps).length) return;
    s[l.pagou] += l.valor;
    Object.entries(ps).forEach(([p, v]) => { s[p] -= v; });
  });
  acertos.forEach(a => { if (a.de in s && a.para in s) { s[a.de] += a.valor; s[a.para] -= a.valor; } });
  // quem deve paga para quem tem a receber, do maior para o menor (o menor número de transferências)
  const dev = Object.entries(s).filter(([, v]) => v < -0.01).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const cred = Object.entries(s).filter(([, v]) => v > 0.01).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const dividas = [];
  for (const d of dev) for (const c of cred) {
    if (d.v < 0.01) break; if (c.v < 0.01) continue;
    const x = Math.min(d.v, c.v); dividas.push({ de: d.id, para: c.id, valor: Math.round(x * 100) / 100 }); d.v -= x; c.v -= x;
  }
  return { saldo: s, dividas };
}
