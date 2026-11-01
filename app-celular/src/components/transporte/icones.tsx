// Os ícones do Transporte: SF Symbols no iPhone e, no Android e na prévia, os mesmos desenhos do site
// (../src/telas/transporte.jsx: traço arredondado de 1,9). Ficam aqui, e não em components/icone.tsx, porque só esta
// tela usa (bomba, chave, estacionamento, ônibus, óleo, pneu...).
// - CirculoTipo: o ícone do tipo de gasto num círculo com a cor dele (a mesma do site), como a logo de uma linha.
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { infoSub } from '@/components/transporte/regras';
import { comAlfa, misturar } from '@/components/ui';
import { useCores } from '@/constants/theme';
import type { SubTransp } from '@/lib/motor';

export type NomeTransp = SubTransp | 'km' | 'oleo' | 'pneu' | 'local' | 'bike' | 'carro' | 'consumo';

type SF = Extract<SymbolViewProps['name'], string>;
const SIMBOLO: Record<NomeTransp, SF> = {
  combustivel: 'fuelpump.fill', app: 'car.fill', publico: 'bus.fill', manutencao: 'wrench.and.screwdriver.fill', melhorias: 'sparkles',
  estacionamento: 'parkingsign.circle.fill', documentos: 'doc.text.fill', outros: 'ellipsis', km: 'speedometer', oleo: 'oilcan.fill',
  pneu: 'tirepressure', local: 'location.fill', bike: 'bicycle', carro: 'car.side.fill', consumo: 'leaf.fill',
};

// os traços (viewBox 24): os do site para os tipos de gasto, e os outros no mesmo espírito
const TRACOS: Record<NomeTransp, string[]> = {
  combustivel: ['M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20', 'M4 20h11', 'M5 10h9', 'M14 9l3.2 2.2a1.5 1.5 0 0 1 .8 1.3V17a1.5 1.5 0 0 0 3 0V8.5L18 6'],
  app: ['M5 16v-4l2-5h10l2 5v4', 'M4.5 16h15', 'M6 16v2.5', 'M18 16v2.5', 'M8.5 13.2h.01', 'M15.5 13.2h.01'],
  publico: ['M8 3.5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z', 'M5 11h14', 'M8 17.5V20', 'M16 17.5V20', 'M8.5 14.3h.01', 'M15.5 14.3h.01'],
  manutencao: ['M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z'],
  melhorias: ['M11 3l1.7 4.4L17 9l-4.3 1.7L11 15l-1.7-4.3L5 9l4.3-1.6z', 'M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
  estacionamento: ['M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z', 'M10 16.5v-9h3a2.5 2.5 0 0 1 0 5h-3'],
  documentos: ['M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z', 'M14 3.5V8h4', 'M8.5 12h7', 'M8.5 15.5h5'],
  outros: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
  km: ['M4.5 16.5a7.5 7.5 0 1 1 15 0', 'M12 16.5l3.6-4.6', 'M6.5 12.8l1.3.7', 'M17.5 12.8l-1.3.7', 'M12 9V10.5'],
  oleo: ['M12 3.5S6 10.1 6 14a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5z'],
  pneu: ['M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z', 'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z', 'M12 3.5v5', 'M12 15.5v5', 'M3.5 12h5', 'M15.5 12h5'],
  local: ['M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z', 'M12 7.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z'],
  bike: ['M6 12.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z', 'M18 12.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z', 'M6 16l4-7h5.5L18 16', 'M10 9l2.5 7H6', 'M14 6h2.2'],
  carro: ['M5.5 11l1.5-3.7A2 2 0 0 1 8.9 6h6.2a2 2 0 0 1 1.9 1.3l1.5 3.7', 'M5 11h14a2 2 0 0 1 2 2v4.5H3V13a2 2 0 0 1 2-2z', 'M6.5 17.5v2', 'M17.5 17.5v2'],
  consumo: ['M5 19c0-8 5-13 14-14-1 9-6 14-14 14z', 'M5 19l7-7'],
};

export function IconeTransp({ nome, tamanho = 20, cor, style }: { nome: NomeTransp; tamanho?: number; cor?: string; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const tinta = cor ?? c.texto;
  const svg = (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
      {TRACOS[nome].map((d, i) => <Path key={i} d={d} stroke={tinta} strokeWidth={nome === 'outros' ? 3 : 1.9} strokeLinecap="round" strokeLinejoin="round" />)}
      {nome === 'km' ? <Circle cx={12} cy={16.5} r={1.4} fill={tinta} /> : null}
    </Svg>
  );
  if (Platform.OS !== 'ios') return style ? <View style={style} accessible={false}>{svg}</View> : svg;
  return (
    <SymbolView
      name={SIMBOLO[nome]}
      size={tamanho}
      tintColor={tinta}
      weight="semibold"
      resizeMode="scaleAspectFit"
      style={[{ width: tamanho, height: tamanho }, style]}
      accessible={false}
      importantForAccessibility="no"
      fallback={svg}
    />
  );
}

// O ícone de um tipo de gasto num círculo com a cor dele (como a IconeCategoria): mais claro no escuro, mais fechado no claro
export function CirculoTipo({ sub, nome, cor, tamanho = 40, style }: { sub?: SubTransp; nome?: NomeTransp; cor?: string; tamanho?: number; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const base = cor ?? infoSub(sub).cor;
  return (
    <View accessible={false} style={[{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: comAlfa(base, c.escuro ? 0.2 : 0.14) }, style]}>
      <IconeTransp nome={nome ?? sub ?? 'outros'} tamanho={Math.round(tamanho * 0.46)} cor={c.escuro ? misturar(base, '#FFFFFF', 0.18) : misturar(base, '#000000', 0.25)} />
    </View>
  );
}
