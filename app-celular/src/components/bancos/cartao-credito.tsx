// Um cartão de crédito do Open Finance desenhado como o cartão de plástico: degradê na cor do banco, a logo, o final
// do número e o nome, com a fatura atual grande, o vencimento (em âmbar quando está perto) e o anel do limite usado.
// Embaixo, os detalhes: limite livre, limite total, fechamento e pagamento mínimo.
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Anel } from '@/components/graficos';
import { corClara } from '@/components/bancos/comum';
import { ValorTexto } from '@/components/bancos/pecas';
import { Cartao, comAlfa, corDoBanco, Dinheiro, Icone, LogoBanco, misturar, Texto } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { dataCurta, diasAte, dinheiro, dm, porcento } from '@/lib/formato';
import type { ContaBanco } from '@/lib/motor';

// "vence hoje", "vence amanhã", "vence em 5 dias", "vence dia 10/11", "venceu dia 02/11"
export function textoVence(iso: string) {
  const d = diasAte(iso);
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  if (d > 1 && d <= 7) return `Vence em ${d} dias`;
  return d < 0 ? `Venceu dia ${dm(iso)}` : `Vence dia ${dm(iso)}`;
}
export const vencePerto = (iso?: string | null) => { if (!iso) return false; const d = diasAte(iso); return d >= 0 && d <= 5; };

// Quanto do limite está usado (0 a 1), ou null quando o banco não manda o limite
export function usoDoLimite(k: ContaBanco) {
  if (!k.limite || k.limite <= 0) return null;
  const usado = k.livre != null ? k.limite - k.livre : Math.max(0, k.saldo);
  return Math.max(0, usado / k.limite);
}

export function CartaoCredito({ k }: { k: ContaBanco }) {
  const c = useCores();
  const cor = corDoBanco(k.banco);
  const clara = corClara(cor);
  const tinta = clara ? '#141416' : '#FFFFFF';
  const uso = usoDoLimite(k);
  const perto = vencePerto(k.vence);
  const vence = k.vence ? textoVence(k.vence) : 'Fatura aberta';
  const falar = [
    `Cartão ${k.nome || k.banco}, final ${k.final}`,
    `fatura atual ${dinheiro(Math.max(0, k.saldo))}`,
    vence.toLowerCase(),
    uso != null ? `${porcento(uso)} do limite usado` : '',
  ].filter(Boolean).join(', ');

  return (
    <View style={{ gap: Espaco.dois }}>
      <View style={[estilos.plastico, { boxShadow: `0px 14px 28px ${comAlfa(c.escuro ? '#000000' : misturar(cor, '#000000', 0.4), c.escuro ? 0.5 : 0.22)}` }]} accessible accessibilityLabel={falar}>
        <LinearGradient
          colors={[misturar(cor, '#FFFFFF', 0.1), cor, misturar(cor, '#000000', clara ? 0.28 : 0.5)]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* os círculos de luz do plástico e o reflexo de cima */}
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 210" preserveAspectRatio="xMaxYMid slice">
          <Circle cx={330} cy={20} r={150} fill="#FFFFFF" opacity={0.07} />
          <Circle cx={360} cy={190} r={120} fill="#FFFFFF" opacity={0.05} />
        </Svg>
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={StyleSheet.absoluteFill} />

        <View style={estilos.topo}>
          <LogoBanco banco={k.banco} tamanho={34} />
          <Texto numberOfLines={1} cor={tinta} style={estilos.banco}>{k.nome || k.banco}</Texto>
          <Texto cor={comAlfa(tinta, 0.85)} style={estilos.final} accessible={false}>
            <Texto cor={comAlfa(tinta, 0.6)} style={estilos.pontos}>•••• </Texto>{k.final}
          </Texto>
        </View>

        <View style={estilos.meio}>
          <Texto cor={comAlfa(tinta, 0.72)} style={estilos.rotulo}>Fatura atual</Texto>
          <Dinheiro valor={Math.max(0, k.saldo)} tamanho={32} cor={tinta} />
        </View>

        <View style={estilos.base}>
          <View style={[estilos.vence, { backgroundColor: perto ? (clara ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.32)') : comAlfa(tinta, 0.14) }]}>
            <Icone nome="calendario" tamanho={13} cor={perto ? '#FFC24D' : tinta} peso="semibold" />
            <Texto numberOfLines={1} cor={perto ? '#FFC24D' : tinta} style={estilos.venceTexto}>{vence}</Texto>
          </View>
          <View style={{ flex: 1 }} />
          {uso != null ? (
            <Anel progresso={uso} tamanho={52} espessura={5} cor={tinta} fundo={comAlfa(tinta, 0.2)} rotulo={`${porcento(uso)} do limite usado`}>
              <Texto cor={tinta} maxFontSizeMultiplier={1.1} style={estilos.anelTexto}>{porcento(Math.min(uso, 9.99))}</Texto>
            </Anel>
          ) : null}
        </View>
      </View>

      <Cartao padding={Espaco.quatro} raio={Raio.medio} style={estilos.detalhes}>
        <Detalhe rotulo="Limite livre" valor={k.livre} cor={c.positivo} />
        <Detalhe rotulo="Limite total" valor={k.limite} />
        {k.fecha ? <Detalhe rotulo="Fecha" texto={dataCurta(k.fecha)} /> : null}
        {k.minimo ? <Detalhe rotulo="Mínimo" valor={k.minimo} /> : null}
      </Cartao>
    </View>
  );
}

function Detalhe({ rotulo, valor, texto, cor }: { rotulo: string; valor?: number | null; texto?: string; cor?: string }) {
  if (valor == null && !texto) return null;
  return (
    <View style={estilos.detalhe}>
      <Texto v="apoio" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{rotulo}</Texto>
      {texto ? <Texto numberOfLines={1} cor={cor} style={estilos.detalheValor}>{texto}</Texto> : <ValorTexto valor={valor ?? 0} cor={cor} style={estilos.detalheValor} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  plastico: { borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', aspectRatio: 1.62, padding: Espaco.cinco, justifyContent: 'space-between' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2 },
  banco: { flex: 1, fontFamily: Fontes.textoForte, fontSize: 16, lineHeight: 21 },
  final: { fontFamily: Fontes.titulo, fontSize: 15, lineHeight: 20, letterSpacing: 0.8, fontVariant: ['tabular-nums'] },
  pontos: { fontFamily: Fontes.textoPesado, fontSize: 13, letterSpacing: 1 },
  meio: { gap: 0 },
  rotulo: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18 },
  base: { flexDirection: 'row', alignItems: 'flex-end' },
  vence: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 11, borderRadius: Raio.pilula },
  venceTexto: { fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 17 },
  anelTexto: { fontFamily: Fontes.tituloForte, fontSize: 12, lineHeight: 15, letterSpacing: -0.3 },
  detalhes: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Espaco.tres, columnGap: Espaco.dois },
  detalhe: { flexBasis: '46%', flexGrow: 1, gap: 2 },
  detalheValor: { fontFamily: Fontes.tituloForte, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
});
