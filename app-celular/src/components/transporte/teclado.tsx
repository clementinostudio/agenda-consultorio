// As peças das folhas do Transporte (abastecer, manutenção, outro gasto, pagar um documento), em cima do teclado de
// valor do Anotar (components/atividades/teclado.tsx):
// - teclarCampo: a mesma tecla, para os campos de litros, preço do litro (3 casas, como na bomba) e km (sem vírgula).
// - CampoNumero: o quadradinho de um campo (rótulo, número e unidade). O que está sendo digitado fica com a borda
//   azul; o que sai sozinho da conta (o terceiro de valor, litros e preço) aparece apagado, com "≈".
// - useTecladoDoSistema: o teclado do sistema (na descrição) está aberto e quanto cobre da folha.
// - Dias: os dias para trás, no lugar do teclado (como no Anotar).
import { useEffect, useMemo, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { dataCompleta, diaDaSemanaCurto } from '@/components/atividades/acoes';
import type { Tecla } from '@/components/atividades/teclado';
import { comAlfa, Tocavel } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { hojeIso, mesNome, somarDias } from '@/lib/formato';

/* ---------- As teclas nos campos ---------- */

// casas: quantas depois da vírgula (0: sem vírgula); inteiros: o máximo antes dela. null quando não cabe
export function teclarCampo(txt: string, t: Tecla, casas: number, inteiros: number): string | null {
  if (t === 'apagar') return txt ? txt.slice(0, -1) : null;
  if (t === ',') return !casas || txt.includes(',') ? null : `${txt || '0'},`;
  const [int, dec] = txt.split(',');
  if (dec !== undefined) return dec.length >= casas ? null : txt + t;
  if (int === '0') return t === '0' ? null : t;
  if (int.length >= inteiros) return null;
  return txt + t;
}
export const numeroDe = (txt: string) => Number((txt || '0').replace(',', '.')) || 0;
const milhar = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// "48300" → "48.300"; "32,5" → "32,5"
export function mostrarCampo(txt: string) {
  const [int, dec] = txt.split(',');
  return `${milhar(int || '0')}${dec !== undefined ? `,${dec}` : ''}`;
}
// 32.456 → "32,46" (o número calculado, para mostrar apagado)
export const textoCalculado = (v: number, casas: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas ? Math.min(2, casas) : 0, maximumFractionDigits: casas });

/* ---------- O quadradinho de um campo ---------- */

export function CampoNumero({ rotulo, txt, calculado, dica, unidade, prefixo, ativo, onPress, falar, style }: {
  rotulo: string;
  txt: string; // o que foi digitado
  calculado?: string | null; // o número que sai da conta (quando nada foi digitado)
  dica?: string | null; // o exemplo apagado (ex.: o km de agora, o preço da semana)
  unidade?: string;
  prefixo?: string; // "R$"
  ativo: boolean;
  onPress: () => void;
  falar: string; // o que o leitor de tela diz
  style?: object;
}) {
  const c = useCores();
  const vazio = !txt;
  const mostra = !vazio ? mostrarCampo(txt) : calculado ?? dica ?? '0';
  const cor = !vazio ? c.texto : c.fraco;
  return (
    <Tocavel
      onPress={onPress}
      escala={0.96}
      accessibilityLabel={falar}
      accessibilityState={{ selected: ativo }}
      accessibilityHint={ativo ? undefined : 'Toque para digitar'}
      style={[estilos.campo, { backgroundColor: ativo ? comAlfa(c.azul, c.escuro ? 0.14 : 0.07) : c.escuro ? c.cartao : c.cartao2, borderColor: ativo ? comAlfa(c.azul, 0.75) : c.linha }, style]}>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[estilos.rotulo, { color: ativo ? c.azulTinta : c.apoio }]}>{rotulo}</Text>
      <View style={estilos.valorLinha}>
        {/* o que saiu da conta leva o "≈" na frente (antes do "R$") */}
        {vazio && calculado ? <Text maxFontSizeMultiplier={1.2} style={[estilos.unidade, { color: c.fraco, marginRight: 3 }]}>≈</Text> : null}
        {prefixo ? <Text maxFontSizeMultiplier={1.2} style={[estilos.unidade, { color: c.apoio, marginRight: 3 }]}>{prefixo}</Text> : null}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2} style={[estilos.valor, { color: cor }, vazio && !calculado && { fontFamily: Fontes.titulo }]}>{mostra}</Text>
        {unidade ? <Text maxFontSizeMultiplier={1.2} style={[estilos.unidade, { color: c.apoio, marginLeft: 3 }]}>{unidade}</Text> : null}
      </View>
    </Tocavel>
  );
}

/* ---------- O teclado do sistema ---------- */

// Se está aberto e quanto ele cobre da folha (medido na janela, porque a folha não começa no topo da tela)
export function useTecladoDoSistema(raiz: RefObject<ComponentRef<typeof View> | null>) {
  const [estado, setEstado] = useState({ aberto: false, cobre: 0 });
  useEffect(() => {
    const medir = (topo: number) => {
      const v = raiz.current;
      if (!v) { setEstado({ aberto: true, cobre: 0 }); return; }
      v.measureInWindow((_x, y, _w, h) => setEstado({ aberto: true, cobre: Math.max(0, y + h - topo) }));
    };
    const ios = Platform.OS === 'ios';
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => medir(e.endCoordinates.screenY)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setEstado({ aberto: false, cobre: 0 })),
    ];
    if (ios) subs.push(Keyboard.addListener('keyboardDidShow', (e) => medir(e.endCoordinates.screenY)));
    return () => subs.forEach((s) => s.remove());
  }, [raiz]);
  return estado;
}

/* ---------- Os dias ---------- */

const DIAS = 90;

export function Dias({ data, aoEscolher, margem }: { data: string; aoEscolher: (d: string) => void; margem: number }) {
  const c = useCores();
  const hoje = hojeIso();
  const dias = useMemo(() => Array.from({ length: DIAS }, (_, i) => somarDias(hoje, -i)), [hoje]);
  const L = 60, E = 8;
  const inicio = Math.max(0, dias.indexOf(data) - 2) * (L + E);
  return (
    <View style={estilos.dias}>
      <Text maxFontSizeMultiplier={1.3} style={[estilos.diasTitulo, { color: c.apoio, paddingHorizontal: margem + 2 }]}>{dataCompleta(data)}</Text>
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: inicio, y: 0 }}
        contentContainerStyle={{ gap: E, paddingHorizontal: margem }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Dia">
        {dias.map((d, i) => {
          const ativo = d === data;
          return (
            <Tocavel
              key={d}
              onPress={() => aoEscolher(d)}
              escala={0.94}
              accessibilityRole="radio"
              accessibilityLabel={dataCompleta(d)}
              accessibilityState={{ checked: ativo }}
              style={[estilos.dia, { width: L, backgroundColor: ativo ? c.azul : c.escuro ? c.cartao : c.cartao2, borderColor: ativo ? c.azul : c.linha }]}>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaSemana, { color: ativo ? 'rgba(255,255,255,0.8)' : c.apoio }]}>{i === 0 ? 'hoje' : i === 1 ? 'ontem' : diaDaSemanaCurto(d)}</Text>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaNumero, { color: ativo ? '#FFFFFF' : c.texto }]}>{Number(d.slice(8, 10))}</Text>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaMes, { color: ativo ? 'rgba(255,255,255,0.8)' : d.endsWith('-01') ? c.azulTinta : c.fraco }]}>{mesNome(d, true)}</Text>
            </Tocavel>
          );
        })}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { flex: 1, minHeight: 60, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 9, borderRadius: Raio.pequeno + 2, borderCurve: 'continuous', borderWidth: 1, justifyContent: 'space-between', gap: 2 },
  rotulo: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16 },
  valorLinha: { flexDirection: 'row', alignItems: 'baseline' },
  valor: { flexShrink: 1, fontFamily: Fontes.tituloForte, fontSize: 19, lineHeight: 24, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  unidade: { fontFamily: Fontes.titulo, fontSize: 12.5, lineHeight: 16 },
  dias: { flex: 1, justifyContent: 'center', gap: 14, marginHorizontal: -14 },
  diasTitulo: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 19 },
  dia: { height: 84, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  diaSemana: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16 },
  diaNumero: { fontFamily: Fontes.tituloForte, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  diaMes: { fontFamily: Fontes.texto, fontSize: 12, lineHeight: 16 },
});
