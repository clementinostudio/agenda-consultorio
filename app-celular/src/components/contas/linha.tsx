// Peças da lista de contas fixas: a logo com o dia do vencimento no canto, o círculo de marcar como paga e a linha
// (logo, nome, a situação numa pílula, a categoria, o valor e o círculo). Tocar na linha abre o detalhe da conta.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { alternarPaga } from '@/components/contas/acoes';
import { textoSituacao, type ContaMes } from '@/components/contas/regras';
import { comAlfa, Dinheiro, Icone, Logo, Pilula, Texto, Tocavel, useCategoria, useDizerValor } from '@/components/ui';
import { Fontes, useCores, type Paleta } from '@/constants/theme';
import type { SituacaoConta } from '@/lib/motor';

// A cor da situação: vermelho (atrasada), âmbar (vence hoje ou logo), menta (paga); no prazo, sem cor
export function corDaSituacao(st: SituacaoConta, c: Paleta): string | undefined {
  if (st === 'atrasada') return c.negativo;
  if (st === 'hoje' || st === 'breve') return c.ambar;
  if (st === 'paga') return c.positivo;
  return undefined;
}

// A logo da empresa (ou o ícone da categoria) com o dia do vencimento num selo no canto
export function LogoConta({ c, tamanho = 44, anel }: { c: ContaMes; tamanho?: number; anel?: string }) {
  const k = useCores();
  const cor = corDaSituacao(c.st, k);
  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Logo marca={c.marca} site={c.site} nome={c.nome} cat={c.cat} tamanho={tamanho} />
      <View style={[estilos.dia, { borderColor: anel ?? k.cartao, backgroundColor: c.st === 'atrasada' ? k.negativo : k.escuro ? k.cartao3 : k.cartao2 }]}>
        <Text allowFontScaling={false} style={[estilos.diaTexto, { color: c.st === 'atrasada' ? '#FFFFFF' : cor && c.st !== 'paga' ? cor : k.texto }]}>{Number(c.vence.slice(8, 10))}</Text>
      </View>
    </View>
  );
}

// O círculo de marcar: vazio (a pagar) ou cheio de menta com o visto (paga). Pula de leve ao marcar.
export function Marcador({ paga, cor, tamanho = 28 }: { paga: boolean; cor?: string; tamanho?: number }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const s = useSharedValue(1);
  const cheio = useSharedValue(paga ? 1 : 0);
  useEffect(() => {
    cheio.set(reduzir ? (paga ? 1 : 0) : withTiming(paga ? 1 : 0, { duration: 180 }));
    if (!reduzir && paga) s.set(withSequence(withTiming(1.18, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 260 })));
  }, [paga, reduzir, s, cheio]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  const dentro = useAnimatedStyle(() => ({ opacity: cheio.get(), transform: [{ scale: 0.6 + cheio.get() * 0.4 }] }));
  return (
    <Animated.View style={[{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderWidth: 2, borderColor: paga ? c.positivo : cor ?? c.linhaForte, alignItems: 'center', justifyContent: 'center' }, !paga && cor && { backgroundColor: comAlfa(cor, 0.08) }, estilo]}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: tamanho / 2, margin: -2, backgroundColor: c.positivo, alignItems: 'center', justifyContent: 'center' }, dentro]}>
        <Icone nome="check" tamanho={Math.round(tamanho * 0.5)} cor={c.escuro ? '#06150F' : '#FFFFFF'} peso="bold" />
      </Animated.View>
    </Animated.View>
  );
}

// Uma conta na lista: a situação numa pílula embaixo do nome. sub: um texto no lugar da pílula (nas assinaturas, "Todo
// dia 10 · R$ 1.558 por ano"; o círculo continua dizendo se está paga)
export function LinhaConta({ c, anel, sub }: { c: ContaMes; anel?: string; sub?: string }) {
  const k = useCores();
  const dizer = useDizerValor();
  const cat = useCategoria(c.cat);
  const cor = corDaSituacao(c.st, k);
  const situacao = textoSituacao(c);
  const abrir = () => router.push({ pathname: '/conta/[id]', params: { id: c.id } });
  return (
    <View style={estilos.linha}>
      <Tocavel
        onPress={abrir}
        escala={0.985}
        accessibilityLabel={`${c.nome}, ${dizer(c.valor)}, ${situacao}${cat ? `, ${cat.nome}` : ''}${c.assinatura ? ', assinatura' : ''}`}
        accessibilityHint="Abre o detalhe da conta"
        style={estilos.toque}>
        <LogoConta c={c} anel={anel} />
        <View style={{ flex: 1, gap: 5 }}>
          <Texto v="forte" numberOfLines={1} style={estilos.nome}>{c.nome}</Texto>
          {sub ? (
            <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17 }}>{sub}</Texto>
          ) : (
            <Pilula texto={situacao} cor={cor} icone={c.st === 'paga' ? 'check' : c.st === 'atrasada' ? 'alerta' : undefined} />
          )}
        </View>
        <Dinheiro valor={c.valor} tamanho={16} animar={false} style={c.paga ? { opacity: 0.55 } : undefined} />
      </Tocavel>
      <Tocavel
        onPress={() => { alternarPaga(c); }}
        vibra={false}
        escala={0.86}
        hitSlop={6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: c.paga }}
        accessibilityLabel={c.paga ? `${c.nome} paga. Toque para desmarcar` : `Marcar ${c.nome} como paga`}
        style={estilos.marcar}>
        <Marcador paga={c.paga} cor={c.st === 'atrasada' ? k.negativo : undefined} />
      </Tocavel>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  toque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  nome: { fontSize: 16, lineHeight: 21 },
  marcar: { width: 48, height: 48, alignItems: 'flex-end', justifyContent: 'center', marginLeft: 4 },
  dia: { position: 'absolute', right: -6, bottom: -4, minWidth: 22, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  diaTexto: { fontFamily: Fontes.tituloForte, fontSize: 10, lineHeight: 12, fontVariant: ['tabular-nums'] },
});
