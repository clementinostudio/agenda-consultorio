// Dados inventados para ver o painel no computador (npm run dev → /admin/?exemplo). Não entra no app publicado.
// As ações não mudam nada: só respondem "ok" depois de um instante.
const nomes = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Fábio Nunes", "Gabi Torres", "Heitor Melo", "Íris Campos", "João Pedro",
  "Karen Alves", "Lucas Freitas", "Marina Costa", "Nina Barros", "Otávio Reis", "Paula Mendes", "Rafael Pinto", "Sofia Ramos", "Tiago Moura", "Vera Lopes"];
const cidades = [["São Paulo", "São Paulo"], ["Curitiba", "Paraná"], ["Recife", "Pernambuco"], ["Belo Horizonte", "Minas Gerais"], ["Porto Alegre", "Rio Grande do Sul"], ["Salvador", "Bahia"]];
const redes = ["Claro S.A.", "TELEFÔNICA BRASIL S.A", "TIM S/A", "Brisanet Servicos de Telecomunicacoes S.A.", "Copel Telecom S.A."];
const uas = ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15"];
let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const pega = a => a[Math.floor(rnd() * a.length)];
const atras = d => new Date(Date.now() - d * 864e5).toISOString();
const dia = d => new Date(Date.now() - 3 * 3600e3 - d * 864e5).toISOString().slice(0, 10);
const diaUTC = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const espera = (v, ms = 400) => new Promise(r => setTimeout(() => r(v), ms));

const usuarios = nomes.map((nome, i) => {
  const [cidade, regiao] = pega(cidades), criado = i === 0 ? 40 : rnd() * 58, uso = Math.min(criado, rnd() < .7 ? rnd() * 3 : rnd() * 40);
  const consult = rnd() < .6, loja = rnd() < .15, feito = rnd() < .9;
  const contagem = !feito ? {} : Object.fromEntries([
    consult && ["patients", Math.round(rnd() * 40)], consult && ["sessions", Math.round(rnd() * 300)], consult && ["charges", Math.round(rnd() * 120)],
    ["pessoal.lanc", Math.round(rnd() * 200)], ["pessoal.contas", Math.round(rnd() * 12)]].filter(Boolean));
  return {
    id: `${String(i).padStart(8, "0")}-aaaa-4bbb-8ccc-${String(i).padStart(12, "0")}`, email: nome.toLowerCase().split(" ")[0].normalize("NFD").replace(/\p{M}/gu, "") + "@exemplo.com", nome,
    criado_em: atras(criado), ultimo_login: atras(uso + rnd() * 5), email_ok: true, bloqueado_ate: i === 13 ? atras(-5) : null, provedor: "email", dois_passos: i === 0, admin: i === 0,
    sessoes: Math.ceil(rnd() * 3), perfil_feito: feito, profissao: consult ? "Psicóloga" : null, cidade_perfil: cidade, m_consultorio: consult ? "true" : "false", m_pessoal: "true", m_loja: loja ? "true" : null,
    ultimo_acesso: atras(uso), ip: i === 4 || i === 7 ? "177.37.10.200" : `200.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}`, rede: pega(redes), cidade, regiao, pais: "BR", aparelho: pega(uas),
    ips_30d: Math.ceil(rnd() * 3), acessos_30d: Math.round(rnd() * 60), primeiro_acesso: atras(criado - .01),
    ultima_mudanca: atras(uso + .01), contagem, casa: rnd() < .2 ? "Nossa casa" : null, loja: loja ? { nome: "Doces da Vera", papel: "dono" } : null,
  };
});

const planos = ["completo_mensal", "consultorio_anual", "pessoal_mensal", "tudo_anual"];
const valor = { completo_mensal: 39.9, consultorio_anual: 299 / 12, pessoal_mensal: 19.9, tudo_anual: 599 / 12 };
const nomePlano = { completo_mensal: "Pro Consultório + Pessoal mensal", consultorio_anual: "Pro Consultório anual", pessoal_mensal: "Pro Pessoal mensal", tudo_anual: "Pro Completo anual" };
const contas = {};
usuarios.forEach((u, i) => {
  const c = contas[u.id] = { nivel: "gratis", aparelhos: rnd() < .5 ? 1 : 0, vozHoje: Math.round(rnd() * 6), iaHoje: Math.round(rnd() * 2) };
  if (i % 4 === 1) { const p = pega(planos); Object.assign(c, { plano: p, nomePlano: nomePlano[p], forma: rnd() < .5 ? "pix" : "cartao", desde: dia(20), assinando: i !== 9, nivel: "pro", mensal: Math.round(valor[p] * 100) / 100, ambiente: "producao", pagamentos: 1, totalPago: 39.9, devolvidos: 0, ate: i === 9 ? dia(-12) : null }); }
  if (i === 3 || i === 6) Object.assign(c, { nivel: "pro", cortesiaAte: dia(-28), codigos: [{ codigo: i === 3 ? "AVN27MBC" : "AVNRFU36", dia: dia(2) }] });
  if (i === 10) Object.assign(c, { nivel: "pro", cortesiaAte: dia(-60) });
  if (i === 2) c.link = "carla-dias";
});

const codigos = [
  { codigo: "AVN27MBC", dias: 30, max: 1, usados: 1, usos: [{ uid: usuarios[3].id, dia: dia(2) }] },
  { codigo: "AVNRFU36", dias: 30, max: 1, usados: 1, usos: [{ uid: usuarios[6].id, dia: dia(2) }] },
  { codigo: "AVN3J4TK", dias: 30, max: 1, usados: 0, usos: [] }, { codigo: "AVN6THF7", dias: 30, max: 1, usados: 0, usos: [] },
  { codigo: "BETA30", dias: 30, max: 20, usados: 0, validoAte: dia(-30), usos: [] },
];

export const tudo = async () => espera({
  usuarios,
  kv: { contas, ia: { voz: { pessoas: 6, usos: 41 }, ia: { pessoas: 3, usos: 9 } }, aparelhosComAviso: 11, aparelhosSemConta: 2, cobrancaInicio: dia(1), asaasLigado: true, cloudflareLigado: true },
  funil: { contas: 20, perfil: 18, podiam_voltar: 19, voltaram: 14, ativos7: 15 },
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
export const acessos = async () => espera(Array.from({ length: 8 }, (_, i) => ({ quando: atras(i * 1.3), ultimo: atras(i * 1.3 - .02), ip: "200.150.10." + (20 + (i % 3)), rede: redes[i % 2], cidade: "Recife", regiao: "Pernambuco", pais: "BR", aparelho: uas[i % 2] })));
export const asaas = async () => espera({ status: "ativa", proxima: dia(-10), forma: "pix", historico: [{ id: "pay_1", data: dia(20), valor: 39.9, forma: "pix" }], garantia: null });
export const recentes = async () => espera(usuarios.flatMap((u, i) => Array.from({ length: 3 }, (_, j) => ({ user_id: u.id, email: u.email, nome: u.nome, quando: atras(i * .3 + j), ultimo: atras(i * .3 + j - .01), ip: u.ip, rede: u.rede, cidade: u.cidade, regiao: u.regiao, pais: "BR", aparelho: u.aparelho })))
  .sort((a, b) => b.ultimo.localeCompare(a.ultimo)));
export const ips = async () => espera([{ ip: "177.37.10.200", n: 2, ultimo: atras(.2), rede: "Brisanet Servicos de Telecomunicacoes S.A.", cidade: "Recife", contas: [usuarios[4], usuarios[7]].map(u => ({ id: u.id, email: u.email })) }]);
export const criarCodigo = async o => espera({ ok: true, codigos: o.gerar ? Array.from({ length: Number(o.gerar) }, (_, i) => "AVNX" + String(100 + i)) : [o.codigo] });
export const apagarCodigo = async () => espera({ ok: true });
export const cortesia = async () => espera({ ok: true });
export const aviso = async o => espera({ ok: true, aparelhos: o.todos ? 11 : 1 });
export const excluir = async () => espera({ ok: true, avisos: [] });
export const bloquear = async () => espera(null);
export const desconectar = async () => espera(null);
export const definirAdmin = async () => espera(null);
export const trocarSenha = async () => espera(null);
export const log = async () => espera([
  { quando: atras(.1), admin_email: "ana@exemplo.com", acao: "dar cortesia", alvo: usuarios[10].id, alvo_email: usuarios[10].email, detalhe: { ate: dia(-60) } },
  { quando: atras(.5), admin_email: "ana@exemplo.com", acao: "gerar códigos", alvo: null, alvo_email: null, detalhe: { quantidade: 15, dias: 30 } },
  { quando: atras(2), admin_email: "ana@exemplo.com", acao: "excluir conta", alvo: "99999999-aaaa-4bbb-8ccc-000000000099", alvo_email: "spam@exemplo.com", detalhe: { nome: "Spam" } },
]);
export const sistema = async () => espera({
  banco_bytes: 13.4 * 1024 ** 2, versao: "17.4", conexoes: 12, cache: 99.62, storage: null, sessoes_abertas: 31, bloqueadas: 1, contas_por_entrada: { email: 20 },
  tabelas: [["public.itens", 6800, 4.2e6], ["public.acessos", 412, 3.1e5], ["auth.users", 20, 1.6e5], ["public.perfis", 20, 9e4], ["auth.sessions", 31, 8e4], ["public.loja_itens", 230, 6e4], ["public.admin_log", 3, 3e4]]
    .map(([tabela, linhas, bytes]) => ({ tabela, linhas, bytes })),
});
export const cloudflare = async () => {
  const dias = Array.from({ length: 7 }, (_, i) => diaUTC(6 - i));
  return espera({
    configurado: true, dias, gerado: new Date().toISOString(), erros: {},
    workers: dias.map((d, i) => ({ dia: d, scripts: { "agenda-avisos": { requests: 2400 + i * 300, errors: i % 3, subrequests: 900 }, "avina-site": { requests: 300 + i * 40, errors: 0, subrequests: 0 } } })),
    kv: { dias: dias.map((d, i) => ({ dia: d, read: 4000 + i * 200, write: 520 + i * 40, delete: 12, list: 30 })), chaves: 160, bytes: 420000 },
    ia: dias.map((d, i) => ({ dia: d, neuronios: 1200 + i * 700, pedidos: 40 + i * 9 })),
    zona: { nome: "avina.com.br", dias: dias.map((d, i) => ({ dia: d, requests: 900 + i * 50, cachedRequests: 600, bytes: 3.2e7, pageViews: 210 + i * 12, threats: i % 2, visitantes: 60 + i * 9 })) },
  });
};
const codigosDoServidor = async () => espera({ codigos });
export { codigosDoServidor as codigos };
