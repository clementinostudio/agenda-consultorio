// O que o chat da Bolinha guarda e calcula, sem nada de tela:
// - as falas e as conversas (guardadas no aparelho, até 30; a mais recente primeiro);
// - o histórico que vai junto com cada pergunta (as últimas 8 falas);
// - as sugestões da tela vazia, conforme os modos ligados e os números do mês;
// - o markdown simples das respostas (**negrito**, listas com "-" ou "1.", títulos com "#").
import type { NomeIcone } from '@/components/icone';
import { chaveMes, dinheiro, hojeIso, mesAnterior, mesNome, somarDias } from '@/lib/formato';
import type { Estado, Lanc, RespostaBolinha } from '@/lib/motor';
import { marcaPorId } from '@site/marcas.js';

/* ---------- Falas e conversas ---------- */

// Um item da proposta como o site mandou (pode trazer cotacao e iof, nas compras em outra moeda): volta igual no "lancar"
export type ItemProposta = Omit<Lanc, 'id'> & { id?: string; cotacao?: number | null; iof?: boolean };
export type SituacaoProposta = 'aberta' | 'anotando' | 'anotada' | 'dispensada' | 'recusada' | 'falhou';
export type Nota = 'bom' | 'ruim';

// viva: chegou agora, com o chat aberto (entra com animação e a resposta aparece palavra por palavra); não é guardado
type Base = { id: string; texto: string; em: number; viva?: boolean };
export type Fala =
  | (Base & { quem: 'eu' })
  | (Base & { quem: 'ela'; tipo: 'resposta'; nota?: Nota | null })
  | (Base & { quem: 'ela'; tipo: 'gastos'; itens: ItemProposta[]; situacao: SituacaoProposta; aviso?: string | null })
  | (Base & { quem: 'ela'; tipo: 'erro'; pergunta: string });

export type FalaEla = Extract<Fala, { quem: 'ela' }>;

export type Conversa = { id: string; titulo: string; criada: number; mudou: number; falas: Fala[] };

const K_CONVERSAS = 'avina-nativo-conversas';
const MAX_CONVERSAS = 30;
const MAX_FALAS = 120; // uma conversa muito longa guarda só o fim

export const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function lerConversas(): Conversa[] {
  try {
    const v = JSON.parse(localStorage.getItem(K_CONVERSAS) || '[]') as Conversa[];
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && Array.isArray(x.falas)) : [];
  } catch {
    return [];
  }
}

function gravarConversas(lista: Conversa[]) {
  try { localStorage.setItem(K_CONVERSAS, JSON.stringify(lista)); } catch {}
}

// Põe (ou atualiza) a conversa no topo da lista e guarda; devolve a lista nova.
// Sempre parte do que está guardado (e não de uma cópia em memória): uma resposta que chega depois de o chat fechar
// e abrir de novo não apaga a conversa que começou nesse meio tempo.
export function guardarConversa(c: Conversa): Conversa[] {
  // "anotando" não sobrevive a fechar o app: volta a ser uma proposta aberta (a nova tentativa usa os mesmos ids,
  // então não anota duas vezes se a primeira chegou a ir)
  const falas = c.falas.slice(-MAX_FALAS).map(({ viva: _, ...f }) => (f.quem === 'ela' && f.tipo === 'gastos' && f.situacao === 'anotando' ? { ...f, situacao: 'aberta' as const } : f)) as Fala[];
  const nova = [{ ...c, falas }, ...lerConversas().filter((x) => x.id !== c.id)]
    .sort((a, b) => b.mudou - a.mudou)
    .slice(0, MAX_CONVERSAS);
  gravarConversas(nova);
  return nova;
}

export function apagarConversa(id: string): Conversa[] {
  const nova = lerConversas().filter((x) => x.id !== id);
  gravarConversas(nova);
  return nova;
}

// O título é a primeira pergunta, numa linha só
export const tituloDe = (texto: string) => texto.replace(/\s+/g, ' ').trim().slice(0, 80);

// O que vai junto com a pergunta: as últimas 8 falas (sem os erros, que não são conversa)
export function historicoDe(falas: Fala[]): { quem: 'eu' | 'ela'; texto: string }[] {
  return falas
    .filter((f) => f.quem === 'eu' || f.tipo !== 'erro')
    .slice(-8)
    .map((f) => ({ quem: f.quem, texto: f.quem === 'ela' && f.tipo === 'gastos' ? resumoProposta(f) : textoSimples(f.texto) }));
}

// "Anoto assim? Uber, R$ 30,00 (anotado)": a proposta com o que ela dizia, para a pergunta seguinte ter contexto
function resumoProposta(f: Extract<Fala, { tipo: 'gastos' }>) {
  const itens = f.itens.map((i) => `${i.desc || (i.tipo === 'entrada' ? 'Entrada' : 'Gasto')}, ${i.tipo === 'entrada' ? '+' : ''}${dinheiro(i.valor)}`).join('; ');
  const fim = f.situacao === 'anotada' ? ' (anotado)' : f.situacao === 'dispensada' ? ' (não anotado)' : '';
  return `${textoSimples(f.texto)} ${itens}${fim}`;
}

// "Hoje, 10:32" · "Ontem" · "sexta-feira" · "17 de out."
export function quandoFoi(ms: number, agora = new Date()) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoje = hojeIso();
  if (iso === hoje) return `Hoje, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (iso === somarDias(hoje, -1)) return 'Ontem';
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  if (iso > somarDias(hoje, -7)) return dias[d.getDay()];
  const ano = d.getFullYear() !== agora.getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${d.getDate()} de ${mesNome(d.getMonth(), true)}.${ano}`;
}

/* ---------- Sugestões da tela vazia ---------- */

export type Sugestao = { titulo: string; enviar: string; icone: NomeIcone };

// Só o que ela sabe responder com os modos ligados; algumas vêm dos próprios números (a empresa onde mais
// aparece gasto no mês, as contas que vencem nesta semana). No começo do mês, as perguntas falam do mês que passou.
export function sugestoesDe(e: Estado | null, agora = new Date()): Sugestao[] {
  if (!e) return [];
  const pessoal = e.pessoal;
  const consult = e.consultorio;
  const comecoDoMes = agora.getDate() <= 3;
  const chave = comecoDoMes ? mesAnterior(chaveMes(agora)) : chaveMes(agora);
  const mes = mesNome(chave);
  const p: Sugestao[] = [];
  const c: Sugestao[] = [];

  if (pessoal) {
    p.push(comecoDoMes
      ? { titulo: `Quanto gastei em ${mes}?`, enviar: `Quanto gastei em ${mes}?`, icone: 'grafico' }
      : { titulo: 'Quanto gastei este mês?', enviar: 'Quanto gastei este mês?', icone: 'grafico' });
    p.push({ titulo: `Onde mais gastei em ${mes}?`, enviar: `Onde mais gastei em ${mes}?`, icone: 'categoria' });
    const dia = agora.getDay();
    const quando = dia === 6 ? 'hoje' : dia === 5 ? 'amanhã' : 'no sábado';
    p.push({ titulo: `Posso gastar R$ 200 ${quando}?`, enviar: `Posso gastar R$ 200 ${quando}?`, icone: 'calendario' });

    // a empresa que mais aparece nos gastos do mês (pelo menos 3 vezes)
    const vezes = new Map<string, number>();
    for (const l of pessoal.lanc) if (l.tipo === 'saida' && l.marca && l.data.startsWith(chave)) vezes.set(l.marca, (vezes.get(l.marca) ?? 0) + 1);
    const top = [...vezes.entries()].sort((a, b) => b[1] - a[1])[0];
    const marca = top && top[1] >= 3 ? (marcaPorId(top[0]) as { nome: string } | null) : null;
    if (marca?.nome) p.push({ titulo: `Quanto gastei com ${marca.nome}?`, enviar: `Quanto gastei com ${marca.nome} em ${mes}?`, icone: 'sacola' });

    // contas fixas que vencem nos próximos 7 dias e ainda não foram pagas
    const hoje = hojeIso(), limite = somarDias(hoje, 7);
    if (pessoal.contas.some((k) => !k.paga && k.vence >= hoje && k.vence <= limite)) {
      p.push({ titulo: 'Que contas vencem esta semana?', enviar: 'Quais contas vencem esta semana?', icone: 'conta' });
    }
    p.push({ titulo: 'Anotar 30 no Uber', enviar: 'Gastei 30 no Uber', icone: 'editar' });
  }
  if (consult) {
    if (consult.aReceber > 0) c.push({ titulo: 'Quem está me devendo?', enviar: 'Quem está me devendo?', icone: 'pessoas' });
    const proximo = agora.getDay() === 6 ? 'na segunda' : 'amanhã'; // no sábado, o próximo dia de agenda
    c.push({ titulo: `Quem eu atendo ${proximo}?`, enviar: `Quem eu atendo ${proximo}?`, icone: 'calendario' });
    const recebi = comecoDoMes ? `Quanto recebi em ${mes}?` : 'Quanto recebi este mês?';
    c.push({ titulo: recebi, enviar: recebi, icone: 'dinheiro' });
  }
  // a área aberta no site vem primeiro; as duas se intercalam para as primeiras sugestões cobrirem as duas
  const [a, b] = e.modo === 'consultorio' ? [c, p] : [p, c];
  const r: Sugestao[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) r.push(a[i]); if (b[i]) r.push(b[i]); }
  return r.slice(0, 7);
}

/* ---------- Markdown simples das respostas ---------- */

export type Trecho = { t: string; negrito?: boolean };
export type Bloco = { tipo: 'p' | 'item' | 'titulo'; marca?: string; trechos: Trecho[] };

// "**x**" vira negrito; um "*" ou "_" sozinho em volta de uma palavra some (itálico não vale a pena no celular)
function trechos(s: string): Trecho[] {
  const r: Trecho[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > i) r.push({ t: s.slice(i, m.index) });
    r.push({ t: m[1], negrito: true });
    i = re.lastIndex;
  }
  if (i < s.length) r.push({ t: s.slice(i) });
  return r.map((x) => ({ ...x, t: x.t.replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=$|[\s.,;:!?)])/g, '$1$2') }));
}

export function lerMarkdown(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let par: string[] = [];
  const fechar = () => { if (par.length) { blocos.push({ tipo: 'p', trechos: trechos(par.join('\n')) }); par = []; } };
  for (const linha of String(texto || '').replace(/\r/g, '').split('\n')) {
    const s = linha.trim();
    let m: RegExpMatchArray | null;
    if (!s) fechar();
    else if ((m = s.match(/^[-*•]\s+(.*)$/))) { fechar(); blocos.push({ tipo: 'item', marca: '•', trechos: trechos(m[1]) }); }
    else if ((m = s.match(/^(\d{1,2})[.)]\s+(.*)$/))) { fechar(); blocos.push({ tipo: 'item', marca: `${m[1]}.`, trechos: trechos(m[2]) }); }
    else if ((m = s.match(/^#{1,4}\s+(.*)$/))) { fechar(); blocos.push({ tipo: 'titulo', trechos: trechos(m[1]).map((t) => ({ ...t, negrito: true })) }); }
    else par.push(s);
  }
  fechar();
  return blocos;
}

// O texto sem as marcas (para copiar, para o leitor de tela e para o histórico)
export function textoSimples(texto: string) {
  return lerMarkdown(texto)
    .map((b) => (b.marca ? `${b.marca} ` : '') + b.trechos.map((t) => t.t).join(''))
    .join('\n')
    .trim();
}

// Quantas palavras tem a resposta (para aparecer palavra por palavra)
export const contarPalavras = (blocos: Bloco[]) => blocos.reduce((n, b) => n + b.trechos.reduce((k, t) => k + (t.t.match(/\S+/g)?.length ?? 0), 0), 0);

/* ---------- A resposta do site vira uma fala ---------- */

const ERRO_PADRAO = 'Não consegui responder agora. Tente de novo em instantes.';

export function falaDaResposta(r: RespostaBolinha | null, pergunta: string): FalaEla {
  const base = { id: novoId(), em: Date.now(), viva: true, quem: 'ela' as const };
  if (r && r.tipo === 'gastos' && Array.isArray(r.itens) && r.itens.length) {
    // cada item ganha um id já aqui: se a pessoa tocar "Anotar" de novo (a primeira vez demorou), o site atualiza
    // o mesmo lançamento em vez de anotar dois
    const itens: ItemProposta[] = r.itens.map((it) => ({ ...it, id: novoId() }));
    return { ...base, tipo: 'gastos', texto: r.texto || (itens.length > 1 ? `Anoto estes ${itens.length} lançamentos?` : 'Anoto assim?'), itens, situacao: 'aberta' };
  }
  if (r && r.tipo === 'resposta' && String(r.texto || '').trim()) return { ...base, tipo: 'resposta', texto: String(r.texto).trim() };
  return { ...base, tipo: 'erro', texto: (r && String(r.texto || '').trim()) || ERRO_PADRAO, pergunta };
}

// O pedido nem chegou a ter resposta (demorou, o site estava abrindo...): um texto gentil
export function falaDoErro(e: unknown, pergunta: string): FalaEla {
  const m = e instanceof Error ? e.message : String(e);
  const texto = m === 'tempo' ? 'Demorei mais do que devia para responder. Vamos tentar de novo?'
    : m === 'sem-site' || m === 'site-reiniciou' || m === 'site-carregando' ? 'O Avina ainda está terminando de abrir. Tente de novo em instantes.'
    : ERRO_PADRAO;
  return { id: novoId(), em: Date.now(), viva: true, quem: 'ela', tipo: 'erro', texto, pergunta };
}
