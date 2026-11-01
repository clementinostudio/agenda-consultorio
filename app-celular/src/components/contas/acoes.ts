// O que a tela de Contas fixas pede ao site: marcar como paga (e desfazer), salvar, apagar e abrir no site o que é
// de lá (logo, moeda estrangeira, ler o boleto). E useContas(): as contas do mês, já com o que a pessoa acabou de
// marcar e o site ainda não confirmou (lib/pendentes.ts).
// - Marcar vibra na hora e mostra o recado "Conta paga · Desfazer"; o Desfazer pede o contrário ao site.
// - Se o site disser que não deu, a marcação volta e aparece o motivo (neutro).
import { useMemo } from 'react';

import { abrirNoSiteEVoltar, avisar, confirmar, motivoFalha } from '@/components/bancos/comum';
import { contaNoMes, resumirContas, type ContaMes, type ResumoContas } from '@/components/contas/regras';
import { mostrarRecado, vibrar } from '@/components/ui';
import { chaveMes, dinheiro, hojeIso, mesNome } from '@/lib/formato';
import { lerOculto, pedirSite, useEstado, type ContaFixa, type PedidosSite } from '@/lib/motor';
import { criarPendentes } from '@/lib/pendentes';

/* ---------- As contas do mês ---------- */

// os pagamentos marcados na tela: 'id|AAAA-MM' → data (paga) ou null (desmarcada)
const pagamentos = criarPendentes<string | null>();
const chave = (id: string, mes: string) => `${id}|${mes}`;

const usePagamentos = () => pagamentos.usePendentes();

export type ContasDoMes = { hoje: string; lista: ContaMes[]; resumo: ResumoContas };

// null: o Pessoal está desligado (ou o site ainda não mandou nada)
export function useContas(): ContasDoMes | null {
  const e = useEstado();
  const vivas = usePagamentos();
  const hoje = hojeIso();
  const P = e?.pessoal ?? null;
  const em = e?.em ?? 0;
  return useMemo(() => {
    if (!P) return null;
    const agora = chaveMes(hoje);
    const mesRetrato = em ? chaveMes(new Date(em)) : agora;
    const lista = P.contas.map((c) => {
      // os pagamentos marcados na tela entram no histórico da conta (qualquer mês)
      let pagas = c.pagas;
      vivas.forEach((v, k) => {
        const [id, mes] = k.split('|');
        if (id !== c.id) return;
        pagas = { ...(pagas ?? {}) };
        if (v) pagas[mes] = v; else delete pagas[mes];
      });
      return contaNoMes({ ...c, pagas }, hoje, mesRetrato, vivas.get(chave(c.id, agora)));
    });
    return { hoje, lista, resumo: resumirContas(lista, hoje) };
  }, [P, em, vivas, hoje]);
}

/* ---------- Marcar como paga ---------- */

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const descricao = (c: Pick<ContaFixa, 'nome' | 'valor'>) => (lerOculto() ? c.nome : `${c.nome} · ${dinheiro(c.valor)}`);

type Conta = Pick<ContaFixa, 'id' | 'nome' | 'valor'>;

// mes: 'AAAA-MM' (padrão: o de agora); data: quando pagou (padrão: hoje). silencioso: sem recado (o Desfazer do recado)
export async function pagarConta(c: Conta, { mes = chaveMes(), data = hojeIso(), silencioso = false }: { mes?: string; data?: string; silencioso?: boolean } = {}) {
  const k = chave(c.id, mes);
  const ficha = pagamentos.marcar(k, data);
  vibrar('ok');
  if (!silencioso) {
    mostrarRecado({
      titulo: mes === chaveMes() ? 'Conta paga' : `${maiuscula(mesNome(mes))} marcado como pago`,
      texto: descricao(c),
      acao: { titulo: 'Desfazer', onPress: () => { desmarcarConta(c, { mes, silencioso: true }); } },
    });
  }
  try {
    const r = await pedirSite('contaPagar', { id: c.id, mes, data });
    if (r.ok) { pagamentos.confirmar(k, ficha); return true; }
    pagamentos.tirar(k, ficha);
    vibrar('erro');
    avisar('Não deu para marcar como paga', r.texto);
  } catch (e) {
    pagamentos.tirar(k, ficha);
    vibrar('erro');
    avisar('Não deu para marcar como paga', motivoFalha(e));
  }
  return false;
}

// Tira o pagamento do mês. dataAntes: a data que volta se a pessoa tocar em Desfazer no recado
export async function desmarcarConta(c: Conta, { mes = chaveMes(), dataAntes, silencioso = false }: { mes?: string; dataAntes?: string | null; silencioso?: boolean } = {}) {
  const k = chave(c.id, mes);
  const ficha = pagamentos.marcar(k, null);
  vibrar(silencioso ? 'leve' : 'firme');
  if (!silencioso) {
    mostrarRecado({
      titulo: 'Pagamento desfeito',
      texto: descricao(c),
      icone: 'relogio',
      cor: '#FFB648',
      acao: { titulo: 'Desfazer', onPress: () => { pagarConta(c, { mes, data: dataAntes || hojeIso(), silencioso: true }); } },
    });
  }
  try {
    const r = await pedirSite('contaDesfazer', { id: c.id, mes });
    // ok false: ela já não estava paga (desmarcada em outro aparelho): vale o retrato
    if (r.ok) pagamentos.confirmar(k, ficha); else pagamentos.tirar(k, ficha);
    return true;
  } catch (e) {
    pagamentos.tirar(k, ficha);
    vibrar('erro');
    avisar('Não deu para desfazer o pagamento', motivoFalha(e));
    return false;
  }
}

// O círculo da linha: marca ou desmarca o mês de agora
export function alternarPaga(c: ContaMes) {
  if (c.paga) return desmarcarConta(c, { dataAntes: c.pagaEm });
  return pagarConta(c);
}

/* ---------- Salvar e apagar ---------- */

export type DadosConta = PedidosSite['contaSalvar']['dados'];

// Devolve o id salvo, ou o erro com o texto para mostrar (erro 'moeda': a conta é em outra moeda e o valor mudou; a
// folha oferece abrir a edição no site).
export async function salvarConta(d: DadosConta): Promise<{ id: string } | { erro: string; texto: string }> {
  try {
    const r = await pedirSite('contaSalvar', d);
    if (r.ok) { vibrar('ok'); return { id: r.id }; }
    vibrar('aviso');
    return { erro: r.erro, texto: r.texto };
  } catch (e) {
    vibrar('erro');
    return { erro: 'falha', texto: motivoFalha(e) };
  }
}

// Confirma com o sistema e apaga (não tem desfazer: o histórico de pagamentos vai junto). true quando apagou.
export async function apagarConta(c: Conta): Promise<boolean> {
  vibrar('firme');
  const sim = await confirmar({
    titulo: 'Apagar esta conta fixa?',
    texto: `${c.nome} para de aparecer nos próximos meses e nos lembretes. Os pagamentos anotados dela também saem.`,
    sim: 'Apagar',
    perigo: true,
  });
  if (!sim) return false;
  try {
    const r = await pedirSite('contaApagar', { id: c.id });
    if (r.ok) {
      vibrar('ok');
      mostrarRecado({ titulo: 'Conta apagada', texto: c.nome, icone: 'lixo', cor: '#FF6B6B' });
      return true;
    }
    avisar('Não achei esta conta', 'Ela pode já ter sido apagada em outro aparelho.');
  } catch (e) {
    vibrar('erro');
    avisar('Não deu para apagar agora', motivoFalha(e));
  }
  return false;
}

/* ---------- O que fica no site ---------- */

// A edição completa (escolher a logo, moeda estrangeira, o código do boleto); ao sair do site, volta para as Contas
export const editarContaNoSite = (id: string) => abrirNoSiteEVoltar({ area: 'pessoal', acao: 'editar-conta', id }, '/contas', 'contas');
export const novaContaNoSite = () => abrirNoSiteEVoltar({ area: 'pessoal', acao: 'nova-conta' }, '/contas', 'contas');
// Ler o boleto pela câmera (o site lê o código e preenche a conta nova)
export const lerBoletoNoSite = () => abrirNoSiteEVoltar({ area: 'pessoal', acao: 'ler-boleto' }, '/contas', 'contas');
