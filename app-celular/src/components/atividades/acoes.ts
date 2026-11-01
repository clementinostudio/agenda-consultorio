// O que a lista de Atividades, o detalhe do lançamento e o Anotar fazem em comum: apagar (com a confirmação do
// sistema), editar no site, as datas do jeito da lista e o texto que o leitor de tela fala de cada lançamento.
import { Alert, Platform } from 'react-native';

import { vibrar } from '@/components/ui/comum';
import { dataLonga, dataRelativa, deIso, dinheiro, hojeIso, mesNome, numero, somarDias } from '@/lib/formato';
import { abrirNoSite, pedirSite, type Categoria, type Lanc } from '@/lib/motor';

/* ---------- Perguntas e avisos do sistema ---------- */

// Pergunta com os botões do sistema (no navegador da prévia, o confirm do navegador)
export function confirmar({ titulo, texto, sim, perigo }: { titulo: string; texto?: string; sim: string; perigo?: boolean }): Promise<boolean> {
  if (Platform.OS === 'web') {
    try { return Promise.resolve(window.confirm([titulo, texto].filter(Boolean).join('\n\n'))); } catch { return Promise.resolve(false); }
  }
  return new Promise((ok) => Alert.alert(titulo, texto, [
    { text: 'Cancelar', style: 'cancel', onPress: () => ok(false) },
    { text: sim, style: perigo ? 'destructive' : 'default', onPress: () => ok(true) },
  ], { cancelable: true, onDismiss: () => ok(false) }));
}

export function avisar(titulo: string, texto?: string) {
  if (Platform.OS === 'web') { try { window.alert([titulo, texto].filter(Boolean).join('\n\n')); } catch {} return; }
  Alert.alert(titulo, texto);
}

// O motivo de um pedido ao site não ter dado certo, em palavras de gente
export function motivoFalha(e: unknown) {
  const m = e instanceof Error ? e.message : String(e ?? '');
  if (m === 'site-carregando' || m === 'sem-site' || m === 'site-reiniciou') return 'O Avina ainda está abrindo. Tente de novo em alguns segundos.';
  if (m === 'tempo') return 'O Avina demorou para responder. Tente de novo.';
  return 'Tente de novo em instantes.';
}

/* ---------- Ações de um lançamento ---------- */

// Abre a edição do lançamento no Avina do site (a camada do site vem para a frente)
export const editarNoSite = (id: string) => abrirNoSite({ area: 'pessoal', acao: 'editar-lanc', id }, 'area');

// A pergunta do sistema antes de apagar (com a vibração de alerta)
export function confirmarApagar(l: Lanc) {
  vibrar('firme');
  return confirmar({
    titulo: 'Apagar este lançamento?',
    texto: `${l.desc || 'Sem descrição'} · ${dinheiro(l.valor)} · ${dataCurtaLista(l.data)}. Ele sai da lista e dos totais do mês.`,
    sim: 'Apagar',
    perigo: true,
  });
}

// Confirma com o sistema e pede ao site para apagar. Devolve true quando apagou.
export async function apagarLancamento(l: Lanc): Promise<boolean> {
  if (!(await confirmarApagar(l))) return false;
  return pedirApagar(l);
}

// Só o pedido ao site (já confirmado): vibra de sucesso, ou avisa o que houve
export async function pedirApagar(l: Lanc): Promise<boolean> {
  try {
    const r = await pedirSite('apagarLanc', { id: l.id });
    if (r && r.ok) { vibrar('ok'); return true; }
    vibrar('erro');
    avisar('Não achei este lançamento', 'Ele pode já ter sido apagado em outro aparelho.');
  } catch (e) {
    vibrar('erro');
    avisar('Não deu para apagar agora', motivoFalha(e));
  }
  return false;
}

/* ---------- Datas e textos ---------- */

const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// "17 de out" (a data embaixo da descrição, como os apps de banco); com o ano quando não é o deste ano
export function dataCurtaLista(iso: string) {
  const ano = iso.slice(0, 4) !== hojeIso().slice(0, 4) ? ` de ${iso.slice(0, 4)}` : '';
  return `${Number(iso.slice(8, 10))} de ${mesNome(iso, true)}${ano}`;
}

// "Hoje, 1 de novembro" · "Quinta-feira, 29 de outubro" · "Sábado, 17 de outubro de 2025"
export function dataCompleta(iso: string) {
  const hoje = hojeIso();
  const ano = iso.slice(0, 4) !== hoje.slice(0, 4) ? ` de ${iso.slice(0, 4)}` : '';
  const dia = iso === hoje ? 'Hoje' : iso === somarDias(hoje, -1) ? 'Ontem' : DIAS_LONGOS[deIso(iso).getDay()];
  return `${dia}, ${dataLonga(iso)}${ano}`;
}

export const diaDaSemanaCurto = (iso: string) => DIAS_CURTOS[deIso(iso).getDay()];

// "US$ 2,99" (compra em outra moeda)
const SIMBOLO: Record<string, string> = { USD: 'US$', EUR: '€', GBP: '£', ARS: 'AR$', CLP: 'CLP$', UYU: '$U', CAD: 'C$', AUD: 'A$', JPY: '¥', CHF: 'CHF' };
export const valorEstrangeiro = (moeda: string, v: number) => `${SIMBOLO[moeda] ?? moeda} ${numero(v, 2)}`;

// O que o leitor de tela fala de uma linha da lista
export function rotuloLanc(l: Lanc, cat: Categoria | null, oculto: boolean) {
  const valor = oculto ? 'valor escondido' : dinheiro(l.valor);
  return [
    l.desc || 'Sem descrição',
    `${l.tipo === 'entrada' ? 'entrada' : 'saída'} de ${valor}`,
    cat?.nome,
    dataRelativa(l.data),
    l.banco ? `pelo ${l.banco}` : null,
  ].filter(Boolean).join(', ');
}

/* ---------- Busca ---------- */

// "São João" → "sao joao" (a busca ignora acento e maiúscula)
export const normalizarBusca = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
