// Botões de texto: primário (azul do Avina), secundário (grafite), perigo (vermelho suave) e só texto.
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icone, type NomeIcone } from '@/components/icone';
import { comAlfa, Tocavel, type Vibracao } from '@/components/ui/comum';
import { Texto } from '@/components/ui/texto';
import { Fontes, Raio, useCores } from '@/constants/theme';

export type BotaoProps = {
  titulo: string;
  onPress?: () => void;
  variante?: 'primario' | 'secundario' | 'perigo' | 'texto';
  icone?: NomeIcone;
  carregando?: boolean;
  desativado?: boolean;
  tamanho?: 'grande' | 'medio' | 'pequeno'; // 54, 46 e 36 pt de altura
  largo?: boolean; // ocupa a largura toda
  rotulo?: string; // quando o leitor de tela deve falar outra coisa
  vibra?: Vibracao | false;
  style?: StyleProp<ViewStyle>;
};

const ALTURA = { grande: 54, medio: 46, pequeno: 36 } as const;

export function Botao({ titulo, onPress, variante = 'primario', icone, carregando, desativado, tamanho = 'grande', largo, rotulo, vibra, style }: BotaoProps) {
  const c = useCores();
  const fundo = variante === 'primario' ? c.azul : variante === 'secundario' ? c.cartao2 : variante === 'perigo' ? comAlfa(c.negativo, c.escuro ? 0.14 : 0.1) : 'transparent';
  const tinta = variante === 'primario' ? '#FFFFFF' : variante === 'perigo' ? c.negativo : variante === 'texto' ? c.azulTinta : c.texto;
  const h = ALTURA[tamanho];
  const fonte = tamanho === 'pequeno' ? 14 : 16;
  return (
    <Tocavel
      onPress={carregando ? undefined : onPress}
      disabled={desativado}
      accessibilityLabel={rotulo ?? titulo}
      accessibilityState={{ busy: !!carregando, disabled: !!(desativado || carregando) }}
      vibra={vibra ?? (variante === 'perigo' ? 'firme' : 'toque')}
      escala={0.97}
      hitSlop={tamanho === 'pequeno' ? 4 : undefined}
      style={[
        estilos.botao,
        { height: h, paddingHorizontal: tamanho === 'pequeno' ? 14 : 22, backgroundColor: fundo, alignSelf: largo ? 'stretch' : 'flex-start' },
        variante === 'secundario' && { borderWidth: 1, borderColor: c.linha },
        variante === 'primario' && !c.escuro && { boxShadow: `0px 6px 16px ${comAlfa(c.azul, 0.28)}` },
        style,
      ]}>
      {/* o texto fica no lugar (invisível) enquanto carrega, para o botão não mudar de tamanho */}
      <View style={[estilos.dentro, carregando && { opacity: 0 }]}>
        {icone ? <Icone nome={icone} tamanho={fonte + 2} cor={tinta} peso="semibold" /> : null}
        <Texto numberOfLines={1} cor={tinta} maxFontSizeMultiplier={1.4} style={{ fontFamily: Fontes.textoForte, fontSize: fonte }}>{titulo}</Texto>
      </View>
      {carregando ? <ActivityIndicator style={StyleSheet.absoluteFill} color={tinta} /> : null}
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  botao: { borderRadius: Raio.pilula, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  dentro: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
