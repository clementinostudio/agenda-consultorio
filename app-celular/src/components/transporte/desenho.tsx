// O veículo na tela: a foto da pessoa (quando ela pôs uma no site) ou o desenho do tipo de carro, os mesmos do site.
// - A foto não vem no retrato (é grande): vem por pedirSite('veiculoFoto') e fica guardada na memória pela chave
//   dela (fotoK); trocou a foto no site, a chave muda e a nova é pedida.
// - O desenho vem do endereço do Avina (public/ilustras no site) e fica no cache do expo-image (memória e disco):
//   baixa uma vez só. Enquanto não chega (ou sem internet na primeira vez), aparece o ícone do tipo de veículo.
// - Palco: o desenho grande com uma luz atrás e a sombra no chão, como o carrossel da aba Transporte do site.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { IconeTransp, type NomeTransp } from '@/components/transporte/icones';
import { comAlfa } from '@/components/ui';
import { useCores } from '@/constants/theme';
import { pedirSite, type Veiculo } from '@/lib/motor';

const fotos = new Map<string, string | null>(); // 'id|fotoK' → data URL (null: o site não mandou)

function useFoto(v: Veiculo | null) {
  const chave = v?.fotoK ? `${v.id}|${v.fotoK}` : null;
  const [, setVersao] = useState(0);
  useEffect(() => {
    if (!chave || fotos.has(chave) || !v) return;
    let vivo = true;
    pedirSite('veiculoFoto', { id: v.id }, 20_000)
      .then((f) => { fotos.set(chave, typeof f === 'string' && f.startsWith('data:') ? f : null); if (vivo) setVersao((n) => n + 1); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [chave, v]);
  return chave ? fotos.get(chave) ?? null : null;
}

const iconeDo = (v: Veiculo | null): NomeTransp => (v?.tipo === 'bike' ? 'bike' : v?.tipo === 'nenhum' ? 'publico' : 'carro');
// o mesmo endereço do site (lib/site.ts, ENDERECO); lib/site não entra aqui porque mexe em arquivos ao carregar
export const urlDesenho = (d: string) => `https://app.avina.com.br/ilustras/${d}.webp`;

// O desenho (ou a foto) numa caixa; sem nenhum dos dois, o ícone. redondo: a foto num círculo (chips)
export function ImagemVeiculo({ v, largura, altura, redondo }: { v: Veiculo | null; largura: number; altura: number; redondo?: boolean }) {
  const c = useCores();
  const foto = useFoto(v);
  const [falhou, setFalhou] = useState<string | null>(null);
  const desenho = v?.desenho && falhou !== v.desenho ? v.desenho : null;
  const icone = <IconeTransp nome={iconeDo(v)} tamanho={Math.round(Math.min(largura, altura) * (redondo ? 0.55 : 0.5))} cor={c.apoio} />;
  if (foto) {
    return (
      <Image
        source={{ uri: foto }}
        contentFit="cover"
        transition={180}
        accessible={false}
        style={{ width: redondo ? altura : largura, height: altura, borderRadius: redondo ? altura / 2 : 22 }}
      />
    );
  }
  if (!desenho) return <View style={{ width: largura, height: altura, alignItems: 'center', justifyContent: 'center' }}>{icone}</View>;
  return (
    <View style={{ width: largura, height: altura, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={{ uri: urlDesenho(desenho) }}
        cachePolicy="memory-disk"
        recyclingKey={desenho}
        contentFit="contain"
        transition={220}
        onError={() => setFalhou(desenho)}
        accessible={false}
        style={{ width: largura, height: altura }}
      />
    </View>
  );
}

// O palco: o veículo grande com a luz atrás (na cor dada) e a sombra no chão
export function PalcoVeiculo({ v, largura, cor, style }: { v: Veiculo | null; largura: number; cor?: string; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const altura = Math.round(largura * 0.44);
  const luz = cor ?? c.ciano;
  return (
    <View style={[{ width: largura, height: altura + 18, alignItems: 'center' }, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={largura} height={altura + 18} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="palco-luz" cx="50%" cy="48%" r="50%">
            <Stop offset="0" stopColor={luz} stopOpacity={c.escuro ? 0.3 : 0.2} />
            <Stop offset="0.6" stopColor={luz} stopOpacity={c.escuro ? 0.08 : 0.06} />
            <Stop offset="1" stopColor={luz} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="palco-chao" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity={c.escuro ? 0.55 : 0.22} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* a luz cabe inteira no desenho (cortada, ela mostraria uma linha reta em cima) */}
        <Ellipse cx={largura / 2} cy={(altura + 18) / 2} rx={largura * 0.5} ry={(altura + 18) / 2} fill="url(#palco-luz)" />
        <Ellipse cx={largura / 2} cy={altura + 4} rx={largura * 0.38} ry={11} fill="url(#palco-chao)" />
      </Svg>
      <Animated.View key={`${v?.id}-${v?.desenho}-${v?.fotoK}`} entering={reduzir ? undefined : FadeIn.duration(320)}>
        <ImagemVeiculo v={v} largura={largura * 0.86} altura={altura} />
      </Animated.View>
    </View>
  );
}

// A miniatura redonda dos chips de escolher o veículo
export function MiniVeiculo({ v, tamanho = 28, ativo }: { v: Veiculo; tamanho?: number; ativo?: boolean }) {
  const c = useCores();
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? comAlfa(c.fundo, 0.12) : c.cartao2, marginLeft: -8 }}>
      <ImagemVeiculo v={v} largura={tamanho * 1.5} altura={tamanho} redondo={!!v.fotoK} />
    </View>
  );
}
