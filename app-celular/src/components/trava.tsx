// Fica por cima de tudo:
// - Capa: quando o app sai da tela (lista de apps abertos), a agenda e os valores ficam escondidos atrás do logo.
// - Bloqueio: com o Face ID ligado (Perfil → Bloqueio do app), pede o rosto ou a digital ao abrir o app e ao voltar
//   depois de mais de 1 minuto fora.
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BotaoVidro, Texto } from '@/components/base';
import { Cores, Espaco } from '@/constants/theme';
import { aoMudarTrava, autenticar, estadoTrava, travaLigada } from '@/lib/trava';

const FORA_MAX = 60_000;
const ICONE = require('@/assets/images/icon.png');

export function Trava() {
  const [ligada, setLigada] = useState<boolean | null>(null);
  const [travado, setTravado] = useState(false);
  const [escondido, setEscondido] = useState(false);
  const [nome, setNome] = useState('Face ID');
  const saiu = useRef(0);
  const pedindo = useRef(false);

  const desbloquear = useCallback(async () => {
    if (pedindo.current) return;
    pedindo.current = true;
    try { if (await autenticar()) setTravado(false); } finally { pedindo.current = false; }
  }, []);

  useEffect(() => {
    travaLigada().then((l) => { setLigada(l); if (l) { setTravado(true); desbloquear(); } });
    estadoTrava().then((e) => setNome(e.nome)).catch(() => {});
    return aoMudarTrava(setLigada);
  }, [desbloquear]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        setEscondido(false);
        if (ligada && saiu.current && Date.now() - saiu.current > FORA_MAX) { setTravado(true); desbloquear(); }
        saiu.current = 0;
      } else {
        setEscondido(true);
        // o próprio pedido do Face ID deixa o app "inativo": só conta como saída quando vai para o fundo
        if (st === 'background' && !pedindo.current) saiu.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [ligada, desbloquear]);

  if (ligada === null) return <View style={[StyleSheet.absoluteFill, estilos.capa]} />; // ainda lendo a escolha: nada aparece
  if (!travado && !escondido) return null;
  return (
    <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(220)} style={[StyleSheet.absoluteFill, estilos.capa]}>
      <Image source={ICONE} style={estilos.icone} />
      {travado && (
        <View style={{ alignItems: 'center', gap: Espaco.quatro }}>
          <Texto v="subtitulo" cor={Cores.dark.texto}>O Avina está bloqueado</Texto>
          <BotaoVidro rotulo={`Desbloquear com ${nome}`} onPress={desbloquear} cor={Cores.dark.azul}>
            <Texto v="forte" cor="#fff">Desbloquear com {nome}</Texto>
          </BotaoVidro>
        </View>
      )}
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  capa: { backgroundColor: Cores.dark.fundo, alignItems: 'center', justifyContent: 'center', gap: 28, zIndex: 100 },
  icone: { width: 88, height: 88, borderRadius: 22, borderCurve: 'continuous' },
});
