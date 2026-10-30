// Avisos do Avina no celular: notificações agendadas no próprio aparelho (sem servidor, funcionam sem internet).
// O site manda a mesma lista dos próximos dias que, no navegador, vai para o servidor de avisos:
// [{ t: quando (ms), titulo, corpo, tag }]. Veja gerarAvisos em ../src/App.jsx.
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

export type Aviso = { t: number; titulo: string; corpo: string; tag?: string };
export type Permissao = 'ok' | 'permissao' | 'negado';

const CANAL = 'avisos';
const MAX = 60; // o iPhone guarda até 64 avisos agendados por app

// com o app aberto, o aviso aparece em cima da tela, com som
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function canal() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Avisos do Avina',
    description: 'Sessão chegando, conta vencendo e o resumo do dia',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 120, 60, 120],
    sound: 'default',
  });
}

export async function permissao(pedir: boolean): Promise<Permissao> {
  await canal();
  let s = await Notifications.getPermissionsAsync();
  if (s.granted) return 'ok';
  if (!s.canAskAgain) return 'negado';
  if (!pedir) return 'permissao';
  s = await Notifications.requestPermissionsAsync();
  return s.granted ? 'ok' : 'negado';
}

const conteudo = (titulo: string, corpo: string, tag?: string) => ({ title: titulo, body: corpo, sound: 'default' as const, data: tag ? { tag } : {} });

// troca tudo o que estava agendado pela lista nova
export async function agendar(avisos: Aviso[]) {
  if ((await permissao(false)) !== 'ok') throw new Error('permissao');
  await Notifications.cancelAllScheduledNotificationsAsync();
  const futuros = (avisos || []).filter((a) => a.t > Date.now() + 5000).sort((a, b) => a.t - b.t).slice(0, MAX);
  for (const a of futuros) {
    await Notifications.scheduleNotificationAsync({
      content: conteudo(a.titulo, a.corpo, a.tag),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.t, channelId: CANAL },
    });
  }
  return futuros.length;
}

export const cancelar = () => Notifications.cancelAllScheduledNotificationsAsync();

// aviso na hora (com o app aberto) ou daqui a pouco (o "Testar em 10 s" do Perfil)
export async function mostrar(titulo: string, corpo: string, pedir: boolean, atrasoMs = 0): Promise<string> {
  const p = await permissao(pedir);
  if (p !== 'ok') return p === 'negado' ? 'negado' : 'pendente';
  await Notifications.scheduleNotificationAsync({
    content: conteudo(titulo, corpo),
    trigger: atrasoMs > 0
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(atrasoMs / 1000)), channelId: CANAL }
      : Platform.OS === 'android' ? { channelId: CANAL } : null,
  });
  return 'ok';
}
