// Posto mais barato perto: a mesma busca do site, em tela nativa. Abre por cima do Avina quando a pessoa toca em
// Transporte → Combustível → "Posto mais barato perto" (o site manda o combustível e o consumo do carro).
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { BotaoVidro, Cartao, Chips, Tela, Texto, vibrar } from '@/components/base';
import { FaixaPrecos } from '@/components/faixa-precos';
import { Espaco, Raio, useCores } from '@/constants/theme';
import { usePostos, type Posto } from '@/hooks/use-postos';
import { brl, dm, guardar, km, lerGuardado, preco } from '@/lib/formato';
import { COMBS, haQuanto, linkMapa, resumoPostos, valeIr } from '@site/postos.js';

const K_ESCOLHA = 'agenda-postos-escolha'; // a mesma chave do site
const RAIOS = [2, 5, 10, 20];
const LITROS = 40;
const CONSUMO = 11; // km/l, quando o carro ainda não tem consumo anotado

const abrirMapa = (p: Posto) => { vibrar(); Linking.openURL(linkMapa(p, Platform.OS === 'ios')).catch(() => {}); };

export default function Postos() {
  const c = useCores();
  const q = useLocalSearchParams<{ comb?: string; consumo?: string }>();
  const consumo = Number(q.consumo) > 0 ? Number(q.consumo) : CONSUMO;
  const [esc, setEsc] = useState(() => {
    const g = lerGuardado(K_ESCOLHA, { comb: 'gasolina', raio: 5 });
    return q.comb && COMBS.some((x: { id: string }) => x.id === q.comb) ? { ...g, comb: q.comb } : g;
  });
  const trocar = (m: Partial<typeof esc>) => { const n = { ...esc, ...m }; setEsc(n); guardar(K_ESCOLHA, n); };
  const p = usePostos(esc.comb, esc.raio);
  const r = resumoPostos(p.lista, LITROS);
  const comDist = p.lista.filter((x) => x.dist != null);
  const perto = comDist.length > 1 ? comDist.reduce((m, x) => ((x.dist as number) < (m.dist as number) ? x : m)) : null;
  const vale = r && perto && perto !== r.menor && r.menor.dist != null
    ? valeIr({ ...r.menor, dist: Math.max(0, r.menor.dist - (perto.dist as number)) }, perto.preco, LITROS, consumo)
    : null;
  const nomeComb = (COMBS.find((x: { id: string }) => x.id === esc.comb) || COMBS[0]).nome.toLowerCase();
  const sub = p.fonte === 'anp' ? `Pesquisa da ANP${p.cidade ? ` em ${p.cidade}` : ''}` : 'Notas fiscais de agora';
  const rotulo = esc.raio === 20 ? (p.fonte === 'anp' ? `O mais barato de ${p.cidade}` : 'O mais barato da região') : `O mais barato a até ${esc.raio} km`;

  return (
    <Tela folha titulo="Posto mais barato" sub={sub} atualizando={p.st === 'buscando' && p.lista.length > 0} aoAtualizar={p.buscar}
      direita={<BotaoVidro rotulo="Fechar" onPress={() => router.back()} cor={c.cartao3}>
        {Platform.OS === 'ios' ? <SymbolView name="xmark" size={15} weight="bold" tintColor={c.texto} /> : <Texto v="forte">Fechar</Texto>}
      </BotaoVidro>}>
      <StatusBar style={c.escuro || Platform.OS === 'ios' ? 'light' : 'dark'} />
      <View style={{ gap: Espaco.dois }}>
        <Chips rotulo="Combustível" valor={esc.comb} onTrocar={(comb) => trocar({ comb })} opcoes={COMBS.filter((x: { id: string }) => x.id !== 'gnv')} />
        <Chips rotulo="Distância" valor={esc.raio} onTrocar={(raio) => trocar({ raio })}
          opcoes={RAIOS.map((x) => ({ id: x, nome: x === 20 ? (p.fonte === 'anp' ? 'Cidade toda' : '20 km') : `${x} km` }))} />
      </View>

      {(p.st === 'buscando' && !p.lista.length) || (p.st === 'ok' && !p.lista.length && p.localizando) ? (
        <Vazio carregando texto={p.localizando ? 'Vendo onde fica cada posto da cidade…' : 'Procurando os postos perto de você…'} />
      ) : null}
      {p.st === 'semLocal' && <Vazio texto="Sem a localização não dá para achar os postos perto. Libere a localização nos Ajustes do aparelho." acao="Tentar de novo" aoAgir={p.buscar} />}
      {p.st === 'erro' && <Vazio texto="Não consegui buscar os preços agora. Confira a internet e tente de novo." acao="Tentar de novo" aoAgir={p.buscar} />}
      {p.st === 'ok' && !p.lista.length && !p.localizando && (
        <Vazio texto={p.fonte === 'anp' ? `A ANP não tem preço de ${nomeComb} a até ${esc.raio} km nesta semana. Tente uma distância maior.` : 'Nenhuma nota com esse combustível nos últimos 3 dias. Tente uma distância maior.'} />
      )}

      {r && (
        <Animated.View key={`${esc.comb}-${r.menor.id}`} entering={FadeInDown.springify().damping(18)} style={{ paddingHorizontal: Espaco.cinco, opacity: p.st === 'buscando' ? 0.6 : 1 }}>
          <Cartao destaque={c.menta + '66'} style={{ backgroundColor: c.escuro ? '#0F1A16' : c.cartao }}>
            <Texto v="rotulo" cor={c.menta}>{rotulo}</Texto>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.tres }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Texto v="numero" style={{ fontSize: 44 }} adjustsFontSizeToFit numberOfLines={1}>{preco(r.menor.preco)}</Texto>
                <Texto v="apoio">/litro</Texto>
              </View>
              <BotaoVidro rotulo={`Ir até ${r.menor.nome}`} onPress={() => abrirMapa(r.menor)}>
                {Platform.OS === 'ios' && <SymbolView name="arrow.triangle.turn.up.right.diamond.fill" size={16} tintColor={c.tintaBotao} />}
                <Texto v="forte" cor={c.tintaBotao}>Ir até lá</Texto>
              </BotaoVidro>
            </View>
            <Texto v="subtitulo">{r.menor.nome}{r.menor.bandeira ? <Texto v="apoio"> · {r.menor.bandeira}</Texto> : null}</Texto>
            <Texto v="apoio">{[r.menor.endereco, r.menor.bairro, km(r.menor.dist), r.menor.t ? haQuanto(r.menor.t) : ''].filter(Boolean).join(' · ')}</Texto>
            {r.maior > r.menor.preco && <FaixaPrecos menor={r.menor.preco} tipico={r.tipico} maior={r.maior} />}
            {r.economia >= 1 && (
              <Texto style={{ marginTop: 4 }}>
                Enchendo {LITROS} litros aqui, você economiza <Texto v="forte" cor={c.menta}>{brl(r.economia)}</Texto> em relação ao preço comum.
              </Texto>
            )}
            {vale && perto && (
              <Texto v="apoio">
                O mais perto ({perto.nome}, {km(perto.dist)}) cobra {preco(perto.preco)}.{' '}
                {vale.vale ? <>Mesmo contando a ida e a volta, sobram <Texto v="forte" cor={c.menta} style={{ fontSize: 13 }}>{brl(vale.sobra)}</Texto>.</> : 'Indo só para abastecer, a ida e a volta comem a economia.'}
              </Texto>
            )}
          </Cartao>
        </Animated.View>
      )}

      {p.lista.length > 1 && (
        <View style={{ paddingHorizontal: Espaco.cinco, gap: Espaco.dois }}>
          <Texto v="rotulo" cor={c.apoio} style={{ marginLeft: 4 }}>Outros postos</Texto>
          <Animated.View layout={LinearTransition} style={[estilos.lista, { backgroundColor: c.cartao }]}>
            {p.lista.slice(1, 30).map((x, i) => (
              <Animated.View key={x.id} entering={FadeIn.delay(Math.min(i, 12) * 35)}>
                <Pressable onPress={() => abrirMapa(x)} accessibilityRole="button" accessibilityLabel={`${x.nome}, ${preco(x.preco)}, ${km(x.dist)}`}
                  style={({ pressed }) => [estilos.linha, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.linha }, pressed && { backgroundColor: c.cartao2 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Texto v="forte" numberOfLines={1}>{x.nome}</Texto>
                    <Texto v="apoio" numberOfLines={1}>{[x.bairro || x.endereco, km(x.dist), x.t ? haQuanto(x.t) : ''].filter(Boolean).join(' · ')}</Texto>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Texto v="subtitulo" style={{ fontVariant: ['tabular-nums'] }}>{preco(x.preco)}</Texto>
                    {r && <Texto v="apoio" cor={c.rosa} style={{ fontSize: 12 }}>+{preco(x.preco - r.menor.preco).replace('R$ ', '')}</Texto>}
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </Animated.View>
        </View>
      )}

      {p.st === 'ok' && p.lista.length > 0 && (
        <Texto v="apoio" style={{ paddingHorizontal: Espaco.cinco + 4 }}>
          {p.fonte === 'nota'
            ? 'Preço das notas fiscais dos últimos 3 dias (Nota Paraná). Pode ter desconto de app ou de pagamento à vista.'
            : `Pesquisa semanal da ANP${p.ini ? `, coletada de ${dm(p.ini)} a ${dm(p.fim)}` : ''}. O preço pode ter mudado, e a distância é pelo CEP.`}
        </Texto>
      )}
    </Tela>
  );
}

function Vazio({ texto, carregando, acao, aoAgir }: { texto: string; carregando?: boolean; acao?: string; aoAgir?: () => void }) {
  const c = useCores();
  return (
    <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: Espaco.tres, paddingHorizontal: Espaco.oito, paddingVertical: Espaco.oito }}>
      {carregando && <ActivityIndicator color={c.menta} />}
      <Texto v="apoio" style={{ textAlign: 'center' }}>{texto}</Texto>
      {acao && aoAgir && <BotaoVidro rotulo={acao} onPress={aoAgir} cor={c.cartao3}><Texto v="forte">{acao}</Texto></BotaoVidro>}
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  lista: { borderRadius: Raio.cartao, borderCurve: 'continuous', overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingHorizontal: Espaco.cinco, paddingVertical: 14 },
});
