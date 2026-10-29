// Avina Pro: planos, preços e o que a versão grátis permite.
// Os preços também ficam no servidor (servidor-avisos/src/asaas.js, PLANOS): mudou aqui, mude lá.

// Grátis: dá para usar de verdade, com limite em cada área.
// Loja grátis: caixa, gastos e lista sem limite, mas só a dona (sem ajudantes) e o resumo dos últimos 30 dias.
export const LIMITE_GRATIS = { pacientes: 3, lancMes: 30, lojaDias: 30 };

// Três pacotes: os dois juntos, só o consultório ou só a vida pessoal. O anual sai 10 mensalidades (2 meses grátis).
export const PLANOS = {
  completo_anual: { produto: "completo", nome: "Pro Completo", preco: 399, ciclo: "ano", meses: 12, selo: "2 meses grátis" },
  completo_mensal: { produto: "completo", nome: "Pro Completo", preco: 39.9, ciclo: "mês", meses: 1 },
  consultorio_anual: { produto: "consultorio", nome: "Pro Consultório", preco: 299, ciclo: "ano", meses: 12, selo: "2 meses grátis" },
  consultorio_mensal: { produto: "consultorio", nome: "Pro Consultório", preco: 29.9, ciclo: "mês", meses: 1 },
  pessoal_anual: { produto: "pessoal", nome: "Pro Pessoal", preco: 199, ciclo: "ano", meses: 12, selo: "2 meses grátis" },
  pessoal_mensal: { produto: "pessoal", nome: "Pro Pessoal", preco: 19.9, ciclo: "mês", meses: 1 },
  // Loja: pacotes à parte (não mudam nada nos três de cima)
  loja_anual: { produto: "loja", nome: "Pro Loja", preco: 299, ciclo: "ano", meses: 12, selo: "2 meses grátis" },
  loja_mensal: { produto: "loja", nome: "Pro Loja", preco: 29.9, ciclo: "mês", meses: 1 },
  lojapessoal_anual: { produto: "lojapessoal", nome: "Pro Loja + Pessoal", preco: 399, ciclo: "ano", meses: 12, selo: "2 meses grátis" },
  lojapessoal_mensal: { produto: "lojapessoal", nome: "Pro Loja + Pessoal", preco: 39.9, ciclo: "mês", meses: 1 },
};
// o que cada pacote libera sem limite
const LIBERA = { completo: { consultorio: true, pessoal: true }, consultorio: { consultorio: true }, pessoal: { pessoal: true },
  loja: { loja: true }, lojapessoal: { loja: true, pessoal: true }, tudo: { consultorio: true, pessoal: true, loja: true } };
// planos antigos (antes dos três pacotes) incluíam as duas áreas
const ALIAS = { anual: "completo_anual", mensal: "completo_mensal" };
export const idPlano = id => ALIAS[id] || id;
export const planoDe = id => PLANOS[idPlano(id)] || null;

export const PRODUTOS = {
  completo: { nome: "Os dois", texto: "Consultório e vida pessoal juntos, sem limite" },
  consultorio: { nome: "Consultório", texto: "Agenda, pacientes, cobranças, recibos e imposto" },
  pessoal: { nome: "Pessoal", texto: "Gastos, contas, caixinhas, transporte e a casa" },
  loja: { nome: "Loja", texto: "Caixa, gastos da loja, equipe e relatórios" },
  lojapessoal: { nome: "Loja + Pessoal", texto: "A loja e o seu dinheiro pessoal, cada um no seu lugar" },
};
// Os pacotes aparecem em dois grupos: quem tem loja vê os da loja; quem não tem, os do consultório e pessoal
export const GRUPOS = { loja: ["loja", "lojapessoal"], consultorio: ["completo", "consultorio", "pessoal"] };
export const grupoDe = produto => (GRUPOS.loja.includes(produto) ? "loja" : "consultorio");
const usaLoja = p => (p || {}).loja === true;
// pacote que combina com o jeito que a pessoa usa o app
export const produtoDoUso = perfil => usaLoja(perfil) ? ((perfil || {}).pessoal === false ? "loja" : "lojapessoal")
  : (perfil || {}).consultorio === false ? "pessoal" : (perfil || {}).pessoal === false ? "consultorio" : "completo";

// O que está liberado hoje: { consultorio, pessoal }. A cortesia (contas de antes da cobrança) libera tudo.
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
