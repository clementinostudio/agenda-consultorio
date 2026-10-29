// Avina Pro: planos, preços e o que a versão grátis permite.
// Os preços também ficam no servidor (servidor-avisos/src/asaas.js, PLANOS): mudou aqui, mude lá.

// Grátis: dá para usar de verdade, com limite em cada área.
// Loja grátis: caixa, gastos e lista sem limite, mas sem ajudantes e com o resumo dos últimos 30 dias.
export const LIMITE_GRATIS = { pacientes: 3, lancMes: 30, lojaDias: 30 };

// O Pro é montado pelas áreas que a pessoa usa: Consultório, Pessoal e Loja. Cada combinação é um plano
// (assim cada um paga só o que usa). Regra de preço: cada área de trabalho (consultório ou loja) R$ 29,90;
// o Pessoal sozinho R$ 19,90 e, junto com uma área de trabalho, + R$ 10. O anual sai 10 mensalidades (2 meses grátis).
// Os ids antigos (completo, consultorio, pessoal) continuam valendo para quem já assina.
const plano = (produto, nome, mensal) => ({
  [`${produto}_anual`]: { produto, nome, preco: Math.round(mensal * 10), ciclo: "ano", meses: 12, selo: "2 meses grátis" },
  [`${produto}_mensal`]: { produto, nome, preco: mensal, ciclo: "mês", meses: 1 },
});
export const PLANOS = {
  ...plano("pessoal", "Pro Pessoal", 19.9),
  ...plano("consultorio", "Pro Consultório", 29.9),
  ...plano("loja", "Pro Loja", 29.9),
  ...plano("completo", "Pro Consultório + Pessoal", 39.9),
  ...plano("lojapessoal", "Pro Loja + Pessoal", 39.9),
  ...plano("consultorioloja", "Pro Consultório + Loja", 49.9),
  ...plano("tudo", "Pro Completo", 59.9),
};
// o que cada plano libera sem limite
const LIBERA = { completo: { consultorio: true, pessoal: true }, consultorio: { consultorio: true }, pessoal: { pessoal: true },
  loja: { loja: true }, lojapessoal: { loja: true, pessoal: true }, consultorioloja: { consultorio: true, loja: true }, tudo: { consultorio: true, pessoal: true, loja: true } };
// planos antigos (antes dos pacotes) incluíam o consultório e o pessoal
const ALIAS = { anual: "completo_anual", mensal: "completo_mensal" };
export const idPlano = id => ALIAS[id] || id;
export const planoDe = id => PLANOS[idPlano(id)] || null;

// As três áreas do app (as mesmas do seletor de modo e do Perfil)
export const AREAS = [
  { id: "consultorio", nome: "Consultório", texto: "Agenda, pacientes, cobranças, recibos e imposto" },
  { id: "loja", nome: "Loja", texto: "Caixa do dia, gastos da loja, equipe e resumo" },
  { id: "pessoal", nome: "Pessoal", texto: "Gastos, contas, caixinhas, transporte e a casa" },
];
const ORDEM = ["consultorio", "loja", "pessoal"];
const COMBO = { consultorio: "consultorio", loja: "loja", pessoal: "pessoal", "consultorio+pessoal": "completo", "loja+pessoal": "lojapessoal", "consultorio+loja": "consultorioloja", "consultorio+loja+pessoal": "tudo" };
// { consultorio, pessoal, loja } -> id do plano, e o contrário
export const produtoDasAreas = a => COMBO[ORDEM.filter(k => a && a[k]).join("+")] || "pessoal";
export const areasDoProduto = produto => LIBERA[produto] || {};
// as áreas que a pessoa usa (do jeito que o app decide os modos: pelo menos uma)
export const areasDoPerfil = p => { p = p || {}; const consultorio = p.consultorio !== false, loja = p.loja === true; return { consultorio, loja, pessoal: p.pessoal !== false || (!consultorio && !loja) }; };
// plano que combina com o jeito que a pessoa usa o app
export const produtoDoUso = perfil => produtoDasAreas(areasDoPerfil(perfil));
// quanto sairia cada área num plano separado (para mostrar a economia de juntar)
export const separadoMensal = produto => { const a = areasDoProduto(produto); return Math.round(ORDEM.filter(k => a[k]).reduce((s, k) => s + PLANOS[`${k}_mensal`].preco, 0) * 100) / 100; };

// O que está liberado hoje: { consultorio, pessoal, loja }. A cortesia (contas de antes da cobrança) libera tudo.
export function liberadoDe(estado, cortesiaAte, hoje) {
  if (cortesiaAte && hoje < cortesiaAte) return LIBERA.tudo;
  if (!estado) return {};
  const vale = estado.status === "ativa" || (estado.status === "cancelada" && estado.ate && hoje < estado.ate);
  const p = vale && planoDe(estado.plano);
  return p ? LIBERA[p.produto] : {};
}
// Selo PRO: só para quem está pagando (a cortesia libera tudo, mas não ganha selo)
export const ehPro = (estado, hoje) => Object.keys(liberadoDe(estado, null, hoje)).length > 0;

// Atendimento: "Fale com a gente" abre o WhatsApp direto (mude só aqui; nas páginas legais fica em public/legal/dados.js)
export const WHATSAPP_SUPORTE = "5543988208714";
export const linkSuporte = (texto = "Oi! Vim pelo app Avina e queria uma ajuda.") => `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(texto)}`;

// Preço de lançamento: quem assina até esta data mantém o valor enquanto a assinatura continuar ativa.
// É uma promessa de verdade: num reajuste futuro, essas assinaturas não mudam de valor. Depois da data, a faixa some sozinha.
export const LANCAMENTO_ATE = "2026-11-30";
export const emLancamento = hoje => hoje <= LANCAMENTO_ATE;
