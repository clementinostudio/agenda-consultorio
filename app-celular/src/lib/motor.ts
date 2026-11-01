// O motor do app: o Avina do site (WebView, components/camada-web.tsx) é quem guarda os dados, faz o login e
// sincroniza com a nuvem. As telas nativas leem um retrato dos dados e pedem as ações ao site.
// - O site manda o retrato sempre que algo muda (ação "estado" da ponte, ../src/app-nativo.js). Fica guardado no
//   aparelho: na próxima abertura, as telas nativas aparecem na hora, antes do site terminar de carregar.
// - pedirSite(acao, dados) pede algo ao site (salvar um gasto, perguntar à Bolinha, abrir uma tela) e devolve
//   uma Promise. Se o site ainda está abrindo, o pedido espera na fila.
// - A camada do site fica atrás das telas nativas; mostrarWeb() traz o site para a frente (consultório, loja,
//   ajustes, login) e esconderWeb() volta para as telas nativas.
import { useSyncExternalStore } from 'react';

/* ---------- O retrato que o site manda ---------- */

export type TemaEscolhido = 'auto' | 'dark' | 'light';
export type Modo = 'consultorio' | 'pessoal' | 'loja';

export type Lanc = {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number; // em reais, sempre positivo
  data: string; // AAAA-MM-DD
  cat: string; // id da categoria (Estado.categorias / Estado.catEntrada)
  desc: string;
  marca: string | null; // id em ../src/marcas.js (marcaPorId), quando reconhecida
  site?: string | null; // domínio da logo, já resolvido pelo site
  banco?: string | null; // nome do banco, quando veio do Open Finance
  moeda?: string | null; // compra em outra moeda (o valor já está em reais)
  valorOrig?: number | null;
  obs?: string | null;
};

export type Categoria = { id: string; nome: string; cor: string; ink: string; ic: string };

export type ContaFixa = {
  id: string;
  nome: string;
  valor: number;
  dia: number; // dia do vencimento
  cat: string | null;
  paga: boolean; // paga no mês de agora
  vence: string; // AAAA-MM-DD do vencimento neste mês
  assinatura: boolean;
  marca: string | null;
  site?: string | null;
};

export type Caixinha = { id: string; nome: string; emoji: string; guardado: number; meta: number | null; doBanco: boolean };

export type ItemAgenda = { hora: string; nome: string; status: 'proxima' | 'feita' | 'faltou' | 'cancelada' | 'outra'; valor: number | null };

export type Estado = {
  v: 1;
  em: number; // quando o site montou este retrato (ms)
  logado: boolean;
  tema: TemaEscolhido;
  conta: { nome: string; email: string; foto: string | null; uid: string | null } | null;
  modos: Modo[];
  modo: Modo | null; // a área aberta no site agora
  termo: string; // "Paciente", "Analisando"...
  plano: { pro: boolean; estado: string | null; ate: string | null } | null; // null = sem limite (cobrança desligada)
  servidor: string;
  bancoLigado: boolean; // Open Finance liberado para esta conta (hoje: só admin)
  categorias: Categoria[];
  catEntrada: Categoria[];
  pessoal: {
    lanc: Lanc[]; // últimos 400 dias
    contas: ContaFixa[];
    caixinhas: Caixinha[];
    limites: Record<string, number>; // teto do mês por categoria
    renda: number | null; // renda do mês, quando anotada
  } | null;
  consultorio: {
    hoje: ItemAgenda[];
    recebidoMes: number;
    aReceber: number;
    sessoesMes: number;
    faltasMes: number;
    pacientesAtivos: number;
  } | null;
};

/* ---------- Respostas do site para pedidos conhecidos ---------- */

export type ContaBanco = {
  id: string; itemId: string; banco: string; nome: string; final: string; tipo: 'conta' | 'cartao'; saldo: number;
  limite?: number | null; livre?: number | null; vence?: string | null; fecha?: string | null; minimo?: number | null;
  especial?: number | null; especialUsado?: number | null;
};
export type Investimento = { id: string; itemId: string; banco: string; nome: string; tipo: string; subtipo: string | null; saldo: number; aplicado: number | null; rendeu: number | null; vence: string | null };
export type BancoConectado = { id: string; nome: string; status: string; atualizado: string | null; logo?: string | null };
export type ResumoBanco = { ligado: boolean; bancos?: BancoConectado[]; contas?: ContaBanco[]; investimentos?: Investimento[]; em?: string; erro?: string };

export type RespostaBolinha =
  | { tipo: 'resposta'; texto: string }
  | { tipo: 'gastos'; texto: string; itens: Omit<Lanc, 'id'>[] } // proposta: o app mostra e a pessoa confirma
  | { tipo: 'erro'; texto: string };

// Ações que o site atende (src/app-nativo.js + src/App.jsx). Os nomes e formatos são o contrato da ponte.
export type PedidosSite = {
  estado: { dados: null; volta: Estado };
  abrir: { dados: { area?: Modo | 'casa' | 'transporte'; tela?: string; acao?: string; id?: string }; volta: null };
  lancar: { dados: { itens: (Omit<Lanc, 'id'> & { id?: string })[] }; volta: { ok: true; ids: string[] } | { ok: false; erro: string; texto: string } };
  apagarLanc: { dados: { id: string }; volta: { ok: boolean } };
  bolinha: { dados: { texto: string; historico: { quem: 'eu' | 'ela'; texto: string }[] }; volta: RespostaBolinha };
  banco: { dados: { rota: 'resumo' | 'estado'; forcar?: boolean }; volta: ResumoBanco };
  desligarBanco: { dados: { itemId: string }; volta: { ok: boolean } };
  conectarBanco: { dados: { itemId?: string }; volta: BancoConectado | null };
  tema: { dados: { modo: TemaEscolhido }; volta: null };
  sincronizar: { dados: null; volta: null };
  sair: { dados: null; volta: null };
};

/* ---------- Loja simples (sem biblioteca) ---------- */

function loja<T>(inicial: T) {
  let valor = inicial;
  const ouvintes = new Set<() => void>();
  return {
    ler: () => valor,
    mudar: (v: T) => { if (Object.is(v, valor)) return; valor = v; ouvintes.forEach((f) => f()); },
    ouvir: (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
  };
}

const lerLocal = <T,>(k: string, f: T): T => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : f; } catch { return f; } };
const gravarLocal = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const K_ESTADO = 'avina-nativo-estado';
const K_OCULTO = 'avina-nativo-oculto';

const estado = loja<Estado | null>(lerLocal<Estado | null>(K_ESTADO, null));
const siteVivo = loja(false); // o site respondeu (carregou e registrou as ações)
const web = loja<{ visivel: boolean; motivo: string | null }>({ visivel: false, motivo: null });
const oculto = loja<boolean>(lerLocal(K_OCULTO, false));

let gravarDepois: ReturnType<typeof setTimeout> | undefined;
// Chamado pela camada do site quando chega um retrato novo
export function receberEstado(e: Estado) {
  estado.mudar(e);
  clearTimeout(gravarDepois);
  gravarDepois = setTimeout(() => gravarLocal(K_ESTADO, e.logado ? e : { ...e, pessoal: null, consultorio: null }), 600);
}
export const lerEstado = () => estado.ler();
export const useEstado = () => useSyncExternalStore(estado.ouvir, estado.ler);
export const useTemaEscolhido = (): TemaEscolhido => useSyncExternalStore(estado.ouvir, () => estado.ler()?.tema ?? 'auto');
export const useSiteVivo = () => useSyncExternalStore(siteVivo.ouvir, siteVivo.ler);
// true/false pelo último retrato; null quando o site ainda não mandou nenhum (primeira abertura)
export const useLogado = (): boolean | null => useSyncExternalStore(estado.ouvir, () => estado.ler()?.logado ?? null);

// Esconder os valores (o "olho" do topo): vale para todas as telas e fica guardado
export const useOculto = () => useSyncExternalStore(oculto.ouvir, oculto.ler);
export const alternarOculto = () => { const n = !oculto.ler(); oculto.mudar(n); gravarLocal(K_OCULTO, n); };

/* ---------- A camada do site ---------- */

export const useWeb = () => useSyncExternalStore(web.ouvir, web.ler);
export const lerWeb = () => web.ler(); // fora de componente (a camada do site, ao receber o retrato)
// motivo: o que levou o site para a frente ('login', 'area', 'banco', 'ajustes'...)
export const mostrarWeb = (motivo = 'area') => web.mudar({ visivel: true, motivo });
export const esconderWeb = () => { if (web.ler().visivel) web.mudar({ visivel: false, motivo: null }); };

/* ---------- Pedidos ao site ---------- */

type Injetor = (js: string) => void;
let injetar: Injetor | null = null;
let proximo = 0;
const pendentes = new Map<number, { ok: (v: any) => void; falha: (e: Error) => void; t: ReturnType<typeof setTimeout> }>();
const fila: (() => void)[] = [];

// A camada do site liga (e desliga) o injetor; quando o site avisa que está vivo, a fila sai
export function ligarInjetor(f: Injetor | null) { injetar = f; if (!f) siteVivo.mudar(false); }
export function siteProntoParaPedidos() {
  siteVivo.mudar(true);
  while (fila.length) fila.shift()!();
}
// O site recarregou (versão nova, sistema derrubou a WebView): pedidos em andamento não vão ter resposta
export function siteReiniciou() {
  siteVivo.mudar(false);
  pendentes.forEach((p) => { clearTimeout(p.t); p.falha(new Error('site-reiniciou')); });
  pendentes.clear();
}

export function pedirSite<A extends keyof PedidosSite>(acao: A, dados: PedidosSite[A]['dados'], limiteMs = 30_000): Promise<PedidosSite[A]['volta']> {
  return new Promise((ok, falha) => {
    const enviar = () => {
      if (!injetar) { falha(new Error('sem-site')); return; }
      const id = ++proximo;
      const t = setTimeout(() => { pendentes.delete(id); falha(new Error('tempo')); }, limiteMs);
      pendentes.set(id, { ok, falha, t });
      injetar(`window.__avinaNativo && window.__avinaNativo(${id}, ${JSON.stringify(acao)}, ${JSON.stringify(dados ?? null)}); true;`);
    };
    if (siteVivo.ler()) enviar(); else fila.push(enviar);
  });
}

// Abre uma tela do site e traz a camada do site para a frente (o Avina → Consultório, Ajustes, a loja...).
// Pede primeiro e mostra quando o site já trocou de tela (ou em 250 ms), para não aparecer a tela anterior.
// Ex.: abrirNoSite({ area: 'consultorio' }); abrirNoSite({ tela: 'ajustes' }, 'ajustes')
export function abrirNoSite(dados: PedidosSite['abrir']['dados'], motivo = 'area'): Promise<boolean> {
  let mostrou = false; // só uma vez: uma resposta atrasada não traz o site de volta depois que a pessoa saiu dele
  const mostrar = () => { if (!mostrou) { mostrou = true; mostrarWeb(motivo); } };
  const t = setTimeout(mostrar, 250);
  return pedirSite('abrir', dados).then(
    () => { clearTimeout(t); mostrar(); return true; },
    () => { clearTimeout(t); mostrar(); return false; },
  );
}

// Resposta de um pedido: { resp: id, erro?, valor? } (veio pela mensagem da WebView)
export function receberResposta(m: { resp: number; erro?: string | null; valor?: unknown }) {
  const p = pendentes.get(m.resp);
  if (!p) return;
  pendentes.delete(m.resp);
  clearTimeout(p.t);
  if (m.erro) p.falha(new Error(m.erro)); else p.ok(m.valor ?? null);
}
