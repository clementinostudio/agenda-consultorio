// O que a tela de Bancos pede ao site: conectar (ou autorizar de novo), desligar e trazer os lançamentos.
// A janela do banco (Pluggy) abre na camada do site, que só aparece por cima do Início: por isso conectar volta ao
// Início, mostra o site e, quando a pessoa termina (conectou ou fechou a janela), traz a tela de Bancos de volta.
import { router } from 'expo-router';

import { abrirNoSiteDaqui, avisar, confirmar, motivoFalha, voltarAoInicio } from '@/components/bancos/comum';
import { vibrar } from '@/components/ui';
import { atualizarBanco } from '@/hooks/use-banco';
import { esconderWeb, lerWeb, mostrarWeb, pedirSite, type BancoConectado } from '@/lib/motor';

let conectando = false;

// itemId: o banco que pediu para autorizar de novo; sem ele, conecta um banco novo
export async function conectarBanco(itemId?: string) {
  if (conectando) return;
  conectando = true;
  voltarAoInicio();
  mostrarWeb('banco');
  let r: BancoConectado | null = null;
  let falha: unknown = null;
  try {
    r = await pedirSite('conectarBanco', itemId ? { itemId } : {}, 15 * 60_000);
  } catch (e) {
    falha = e;
  } finally {
    conectando = false;
  }
  // a pessoa ainda está na janela do banco: volta para a tela de Bancos (se ela já saiu do site, fica onde está)
  const w = lerWeb();
  const aindaAli = w.visivel && w.motivo === 'banco';
  if (aindaAli) {
    esconderWeb();
    router.push('/bancos');
  }
  atualizarBanco(true);
  if (r) vibrar('ok');
  else if (falha && aindaAli) avisar('Não deu para abrir o banco', motivoFalha(falha));
}

export async function desligarBanco(b: { id: string; nome: string }) {
  const sim = await confirmar({
    titulo: `Desligar ${b.nome}?`,
    texto: `Os saldos e os lançamentos novos de ${b.nome} param de chegar ao Avina. O que já veio continua aqui. Dá para conectar de novo quando quiser.`,
    sim: 'Desligar',
    perigo: true,
  });
  if (!sim) return false;
  try {
    await pedirSite('desligarBanco', { itemId: b.id }, 45_000);
    vibrar('ok');
    await atualizarBanco(true);
    return true;
  } catch (e) {
    vibrar('erro');
    avisar(`Não deu para desligar ${b.nome}`, motivoFalha(e));
    return false;
  }
}

// O site abre a importação já buscando no banco (os gastos e entradas novos entram no Pessoal)
export const trazerLancamentos = () => abrirNoSiteDaqui({ acao: 'importar-banco' }, 'banco');
