// As pessoas da casa: o avatar (a bolinha pronta do Avina, a foto de verdade ou as iniciais na cor da pessoa) e a
// pilha de avatares sobrepostos do topo. A foto de verdade não vem no retrato (é grande): o app pede ao site uma vez
// por versão (fotoK) e guarda.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icone } from '@/components/ui';
import { Fontes, useCores } from '@/constants/theme';
import { pedirSite, type MembroCasa } from '@/lib/motor';

const fotos = new Map<string, string | null>(); // 'id|fotoK' → data URL (null: não veio)

function useFoto(m: MembroCasa) {
  const k = m.fotoK ? `${m.id}|${m.fotoK}` : null;
  const [, setVersao] = useState(0);
  useEffect(() => {
    if (!k || fotos.has(k)) return;
    let vivo = true;
    fotos.set(k, null); // um pedido só por versão, mesmo com vários avatares da mesma pessoa na tela
    pedirSite('foto', { de: 'membro', id: m.id }, 15_000).then(
      (f) => { fotos.set(k, typeof f === 'string' && f.startsWith('data:') ? f : null); if (vivo) setVersao((v) => v + 1); },
      () => { fotos.delete(k); }, // sem resposta: tenta de novo na próxima vez
    );
    return () => { vivo = false; };
  }, [k, m.id]);
  return (k && fotos.get(k)) || m.foto || null;
}

const iniciais = (nome: string) => {
  const p = (nome || '?').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

// anel: a cor da borda em volta (a do fundo atrás, para os avatares sobrepostos se separarem)
export function AvatarMembro({ m, cor, tamanho = 36, anel, style }: { m: MembroCasa; cor: string; tamanho?: number; anel?: string; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const foto = useFoto(m);
  const borda = anel ? Math.max(2, Math.round(tamanho / 18)) : 0;
  const T = tamanho + borda * 2;
  return (
    <View style={[{ width: T, height: T, borderRadius: T / 2, padding: borda, backgroundColor: anel ?? 'transparent' }, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[estilos.redondo, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: foto ? c.cartao2 : cor }]}>
        {foto ? (
          <Image source={{ uri: foto }} contentFit="cover" transition={120} style={StyleSheet.absoluteFill} accessible={false} />
        ) : (
          <Text allowFontScaling={false} style={[estilos.ini, { fontSize: Math.round(tamanho * (iniciais(m.nome).length > 1 ? 0.36 : 0.42)) }]}>{iniciais(m.nome)}</Text>
        )}
      </View>
    </View>
  );
}

// Os avatares sobrepostos (até 4, e um "+N" quando há mais). mais: o círculo de convidar no fim
export function PilhaAvatares({ membros, cores, tamanho = 36, anel, mais }: { membros: MembroCasa[]; cores: Record<string, string>; tamanho?: number; anel: string; mais?: boolean }) {
  const c = useCores();
  const vistos = membros.slice(0, 4);
  const sobra = membros.length - vistos.length;
  const passo = Math.round(tamanho * 0.68);
  const borda = Math.max(2, Math.round(tamanho / 18));
  const T = tamanho + borda * 2;
  const n = vistos.length + (sobra > 0 ? 1 : 0) + (mais ? 1 : 0);
  return (
    <View style={{ width: T + (n - 1) * passo, height: T }}>
      {vistos.map((m, i) => (
        <AvatarMembro key={m.id} m={m} cor={cores[m.id] ?? c.azul} tamanho={tamanho} anel={anel} style={[estilos.pilha, { left: i * passo, zIndex: n - i }]} />
      ))}
      {sobra > 0 ? (
        <View style={[estilos.pilha, estilos.redondo, { left: vistos.length * passo, width: T, height: T, borderRadius: T / 2, borderWidth: borda, borderColor: anel, backgroundColor: c.cartao3, zIndex: 1 }]}>
          <Text allowFontScaling={false} style={[estilos.ini, { color: c.texto, fontSize: Math.round(tamanho * 0.34) }]}>+{sobra}</Text>
        </View>
      ) : null}
      {mais ? (
        <View style={[estilos.pilha, estilos.redondo, { left: (n - 1) * passo, width: T, height: T, borderRadius: T / 2, borderWidth: borda, borderColor: anel, backgroundColor: c.escuro ? c.cartao2 : c.cartao, zIndex: 0 }]}>
          <View style={[StyleSheet.absoluteFill, estilos.redondo, { margin: 3, borderRadius: T / 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.linhaForte }]} />
          <Icone nome="mais" tamanho={Math.round(tamanho * 0.42)} cor={c.apoio} peso="semibold" />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  redondo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ini: { color: '#FFFFFF', fontFamily: Fontes.tituloForte, letterSpacing: -0.3 },
  pilha: { position: 'absolute', top: 0 },
});
