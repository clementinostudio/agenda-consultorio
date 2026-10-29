// Dados inventados para ver o painel no computador (npm run dev → /admin/?exemplo). Não entra no app publicado.
const nomes = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Fábio Nunes", "Gabi Torres", "Heitor Melo", "Íris Campos", "João Pedro",
  "Karen Alves", "Lucas Freitas", "Marina Costa", "Nina Barros", "Otávio Reis", "Paula Mendes", "Rafael Pinto", "Sofia Ramos", "Tiago Moura", "Vera Lopes"];
const cidades = [["São Paulo", "São Paulo"], ["Curitiba", "Paraná"], ["Recife", "Pernambuco"], ["Belo Horizonte", "Minas Gerais"], ["Porto Alegre", "Rio Grande do Sul"], ["Salvador", "Bahia"]];
const uas = ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15"];
let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const pega = a => a[Math.floor(rnd() * a.length)];
const atras = d => new Date(Date.now() - d * 864e5).toISOString();
const dia = d => new Date(Date.now() - 3 * 3600e3 - d * 864e5).toISOString().slice(0, 10);

const usuarios = nomes.map((nome, i) => {
  const [cidade, regiao] = pega(cidades), criado = rnd() * 58, uso = Math.min(criado, rnd() < .7 ? rnd() * 3 : rnd() * 40);
  const consult = rnd() < .6, loja = rnd() < .15, feito = rnd() < .9;
  const contagem = !feito ? {} : Object.fromEntries([
    consult && ["patients", Math.round(rnd() * 40)], consult && ["sessions", Math.round(rnd() * 300)], consult && ["charges", Math.round(rnd() * 120)],
    ["pessoal.lanc", Math.round(rnd() * 200)], ["pessoal.contas", Math.round(rnd() * 12)]].filter(Boolean));
  return {
    id: `0000000${i}-aaaa-4bbb-8ccc-${String(i).padStart(12, "0")}`, email: nome.toLowerCase().split(" ")[0].normalize("NFD").replace(/\p{M}/gu, "") + "@exemplo.com", nome,
    criado_em: atras(criado), ultimo_login: atras(uso + rnd() * 5), email_ok: true, bloqueado_ate: null, provedor: "email", dois_passos: i === 0, admin: i === 0,
    perfil_feito: feito, profissao: consult ? "Psicóloga" : null, m_consultorio: consult ? "true" : "false", m_pessoal: "true", m_loja: loja ? "true" : null,
    ultimo_acesso: atras(uso), ip: `200.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}`, cidade, regiao, pais: "BR", aparelho: pega(uas),
    ultima_mudanca: atras(uso + .01), contagem, casa: rnd() < .2 ? "Nossa casa" : null, loja: loja ? { nome: "Doces da Vera", papel: "dono" } : null,
  };
});

const planos = ["completo_mensal", "consultorio_anual", "pessoal_mensal", "tudo_anual"];
const valor = { completo_mensal: 39.9, consultorio_anual: 299 / 12, pessoal_mensal: 19.9, tudo_anual: 599 / 12 };
const nomePlano = { completo_mensal: "Pro Consultório + Pessoal mensal", consultorio_anual: "Pro Consultório anual", pessoal_mensal: "Pro Pessoal mensal", tudo_anual: "Pro Completo anual" };
const contas = {};
usuarios.forEach((u, i) => {
  if (i % 3 === 0) { const p = pega(planos); contas[u.id] = { plano: p, nomePlano: nomePlano[p], forma: rnd() < .5 ? "pix" : "cartao", desde: dia(20), assinando: i !== 9, nivel: "pro", mensal: Math.round(valor[p] * 100) / 100, ambiente: "producao", pagamentos: 1, totalPago: 39.9, devolvidos: 0, ate: i === 9 ? dia(-12) : null }; }
  else contas[u.id] = { nivel: "gratis" };
});

export const tudo = async () => ({
  usuarios,
  kv: { contas, ia: { voz: { pessoas: 6, usos: 41 }, ia: { pessoas: 3, usos: 9 } }, aparelhosComAviso: 11, cobrancaInicio: "2026-10-28", asaasLigado: true },
  resumo: {
    contas: { total: usuarios.length, hoje: 1, d7: 5, d30: 14, sem_perfil: usuarios.filter(u => !u.perfil_feito).length, com_2etapas: 1 },
    ativos: { d1: 9, d7: 15, d30: 18 },
    cadastros_dia: Array.from({ length: 60 }, (_, i) => ({ dia: dia(59 - i), n: rnd() < .55 ? 0 : Math.ceil(rnd() * 3) })),
    ativos_dia: Array.from({ length: 30 }, (_, i) => ({ dia: dia(29 - i), n: 4 + Math.round(rnd() * 8 + i / 5) })),
    modos: { consultorio: 12, pessoal: 17, loja: 3 },
    colecoes: [["sessions", 3120, 11], ["pessoal.lanc", 2140, 17], ["charges", 980, 11], ["patients", 310, 12], ["pessoal.contas", 96, 14], ["notas", 41, 5]].map(([colecao, itens, c]) => ({ colecao, itens, contas: c })),
    casas: { casas: 3, pessoas: 6 }, lojas: { lojas: 2, ajudantes: 1, itens: 230 },
    acessos: { registros: 412, d1: 23, cidades: cidades.map(([cidade, regiao], i) => ({ cidade, regiao, contas: 6 - i })) },
    gerado_em: new Date().toISOString(),
  },
});
export const acessos = async () => Array.from({ length: 8 }, (_, i) => ({ quando: atras(i * 1.3), ultimo: atras(i * 1.3 - .02), ip: "200.150.10." + (20 + (i % 3)), cidade: "Recife", regiao: "Pernambuco", pais: "BR", aparelho: uas[i % 2] }));
export const asaas = async () => ({ status: "ativa", proxima: dia(-10), forma: "pix", historico: [{ id: "pay_1", data: dia(20), valor: 39.9, forma: "pix" }], garantia: null });
