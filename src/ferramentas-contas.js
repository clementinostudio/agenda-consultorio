// Contas das ferramentas grátis do site (sem dependências, para testar fora do navegador)

// O número do jeito brasileiro: "1.250,50", "6.000", "150" ou "R$ 150,00"
export function lerNumero(s) {
  let t = String(s || "").replace(/[R$\s]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  return Number(t) || 0;
}

// Quanto cada sessão precisa valer para sobrar a renda que a pessoa quer.
// renda e custos por mês; faltas e imposto em %. Devolve null enquanto faltar dado.
export function valorDaSessao({ renda, custos = 0, sessoesSemana, semanasFolga = 0, faltas = 0, imposto = 0 }) {
  const semanas = 52 - Math.min(Math.max(semanasFolga, 0), 51);
  const sessoesMes = sessoesSemana * semanas / 12 * (1 - Math.min(Math.max(faltas, 0), 90) / 100);
  if (!(renda > 0) || !(sessoesMes > 0)) return null;
  const bruto = (renda + Math.max(custos, 0)) / (1 - Math.min(Math.max(imposto, 0), 60) / 100);
  return { valor: Math.ceil(bruto / sessoesMes / 5) * 5, sessoesMes, bruto };
}
