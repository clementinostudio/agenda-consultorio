// A lista de compras da casa (aparece na hora no celular de todos): o campo que aceita "2 leite, pão; café", as
// listas prontas num toque, os itens por corredor com o último preço pago, o carrinho (com "Limpar comprados" e o
// Desfazer), a estimativa contra o limite e o "Estou no mercado". A linha do item e o campo também servem ao modo
// mercado (app/casa/mercado.tsx), maiores.
// - Um toque marca no carrinho; segurar abre o menu (mais um, menos um, tirar da lista).
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { menu } from '@/components/bancos/comum';
import { abrirCasaNoSite, adicionarNaLista, marcarItem, mudarQtd, tirarDaLista } from '@/components/casa/acoes';
import { maiuscula, nomeDe, textoItem, type ListaOrganizada } from '@/components/casa/regras';
import { Marcador } from '@/components/contas/linha';
import { BarraProgresso } from '@/components/graficos';
import { Botao, Cartao, Chip, comAlfa, Icone, Separador, Texto, Tocavel } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { dinheiro } from '@/lib/formato';
import { useOculto, type DadosCasa, type ItemCompra } from '@/lib/motor';

/* ---------- O campo de colocar na lista ---------- */

export function CampoAdicionar({ C, dica, grande, style }: { C: DadosCasa; dica: string; grande?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const [txt, setTxt] = useState('');
  const [foco, setFoco] = useState(false);
  const enviar = () => {
    const t = txt.trim();
    if (!t) return;
    setTxt('');
    adicionarNaLista(C, { texto: t });
  };
  const h = grande ? 54 : 48;
  return (
    <View style={[estilos.campo, { height: h, backgroundColor: c.escuro ? c.cartao2 : c.fundo, borderColor: foco ? comAlfa(c.azul, 0.6) : c.linha }, style]}>
      <Icone nome="mais" tamanho={18} cor={foco ? c.azulTinta : c.apoio} peso="semibold" />
      <TextInput
        value={txt}
        onChangeText={setTxt}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onSubmitEditing={enviar}
        // continua aberto depois de colocar: dá para ir digitando um item atrás do outro
        submitBehavior="submit"
        returnKeyType="done"
        placeholder={dica}
        placeholderTextColor={c.fraco}
        maxLength={300}
        autoCapitalize="none"
        autoCorrect
        selectionColor={c.azul}
        cursorColor={c.azul}
        maxFontSizeMultiplier={1.3}
        accessibilityLabel="Colocar na lista de compras"
        accessibilityHint="Dá para colocar vários de uma vez, separados por vírgula: 2 leite, pão, café"
        style={[estilos.campoTexto, { color: c.texto, height: h - 2, fontSize: grande ? 17 : 16 }]}
      />
      {txt.trim() ? (
        <Tocavel onPress={enviar} escala={0.9} hitSlop={6} accessibilityLabel="Colocar na lista" style={[estilos.enviar, { backgroundColor: c.azul }]}>
          <Icone nome="setaCima" tamanho={16} cor="#FFFFFF" peso="bold" />
        </Tocavel>
      ) : null}
    </View>
  );
}

/* ---------- Um item ---------- */

// O menu do toque longo: mais um, menos um, tirar da lista (no leitor de tela, as mesmas ações)
async function menuDoItem(x: ItemCompra) {
  const opcoes = [`Mais um (${x.qtd + 1}×)`, ...(x.qtd > 1 ? [`Menos um (${x.qtd - 1}×)`] : []), 'Tirar da lista'];
  const i = await menu({ titulo: textoItem(x), opcoes, perigo: opcoes.length - 1 });
  if (i === null) return;
  if (i === opcoes.length - 1) tirarDaLista([x]);
  else mudarQtd(x, x.qtd + (i === 0 ? 1 : -1));
}

export function LinhaItem({ C, x, grande }: { C: DadosCasa; x: ItemCompra; grande?: boolean }) {
  const c = useCores();
  const oculto = useOculto();
  const de = x.autor && x.autor !== C.eu ? `${nomeDe(C, x.autor)} colocou` : null;
  const sub = [x.obs, de].filter(Boolean).join(' · ');
  const preco = !x.feito && x.preco ? `~${oculto ? 'R$ ••••' : dinheiro(x.preco.total)}` : null;
  const tam = grande ? 19 : 16;
  return (
    <Tocavel
      onPress={() => { marcarItem(C, x, !x.feito); }}
      onLongPress={() => { menuDoItem(x); }}
      vibra={false}
      escala={0.985}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: x.feito }}
      accessibilityLabel={`${textoItem(x)}${x.obs ? `, ${x.obs}` : ''}${preco && !oculto ? `, cerca de ${dinheiro(x.preco!.total)}` : ''}`}
      accessibilityHint={x.feito ? 'Toque para tirar do carrinho' : 'Toque para marcar no carrinho'}
      accessibilityActions={[{ name: 'mais', label: 'Mais um' }, ...(x.qtd > 1 ? [{ name: 'menos', label: 'Menos um' }] : []), { name: 'tirar', label: 'Tirar da lista' }]}
      onAccessibilityAction={(e) => {
        const n = e.nativeEvent.actionName;
        if (n === 'tirar') tirarDaLista([x]); else mudarQtd(x, x.qtd + (n === 'mais' ? 1 : -1));
      }}
      style={[estilos.item, { minHeight: grande ? 64 : 48 }]}>
      <Marcador paga={x.feito} tamanho={grande ? 32 : 26} />
      <View style={{ flex: 1, gap: 1 }}>
        <Texto numberOfLines={2} maxFontSizeMultiplier={1.35} style={[estilos.itemTexto, { fontSize: tam, lineHeight: tam + 5 }, x.feito && { color: c.apoio, textDecorationLine: 'line-through' }]}>
          {x.qtd > 1 ? <Texto cor={x.feito ? c.apoio : c.azulTinta} style={[estilos.qtd, { fontSize: tam, lineHeight: tam + 5 }]}>{x.qtd}× </Texto> : null}
          {maiuscula(x.texto)}
        </Texto>
        {sub ? <Texto v="apoio" numberOfLines={1} style={{ fontSize: grande ? 14 : 12.5, lineHeight: grande ? 19 : 17 }}>{sub}</Texto> : null}
      </View>
      {preco ? <Texto cor={c.apoio} style={[estilos.preco, grande && { fontSize: 15 }]}>{preco}</Texto> : null}
    </Tocavel>
  );
}

/* ---------- A estimativa ---------- */

// Quanto a lista vai dar pelo último preço de cada item, contra o limite da casa (quando há)
export function Estimativa({ C, L }: { C: DadosCasa; L: ListaOrganizada }) {
  const c = useCores();
  const oculto = useOculto();
  const limite = C.listaLimite ?? 0;
  if (!(L.estimado > 0 || (limite > 0 && L.abertos.length))) return null;
  const passou = limite > 0 && L.estimado > limite;
  const v = (n: number) => (oculto ? 'R$ ••••' : dinheiro(n, { centavos: false }));
  return (
    <View style={[estilos.estimativa, { backgroundColor: passou ? comAlfa(c.negativo, c.escuro ? 0.12 : 0.07) : c.escuro ? c.cartao2 : c.fundo }]}>
      <View style={estilos.estimativaTopo}>
        <Texto v="apoio" style={{ flex: 1 }}>Estimativa da lista</Texto>
        <Texto style={estilos.estimativaValor} cor={passou ? c.negativo : c.texto}>~{oculto ? 'R$ ••••' : dinheiro(L.estimado)}</Texto>
      </View>
      {limite > 0 ? (
        <BarraProgresso progresso={L.estimado / limite} cor={c.positivo} altura={6} fundo={c.escuro ? c.cartao3 : c.cartao3} rotulo={`A lista usa ${Math.round((L.estimado / limite) * 100)}% do limite`} />
      ) : null}
      <Texto v="apoio" style={{ fontSize: 12.5, lineHeight: 17 }}>
        {limite > 0
          ? passou ? `Passou ${v(L.estimado - limite)} do limite de ${v(limite)}` : `Cabe no limite de ${v(limite)} · sobram ${v(limite - L.estimado)}`
          : `Pelo último preço de ${L.comPreco} ${L.comPreco === 1 ? 'item' : 'itens'}`}
      </Texto>
    </View>
  );
}

/* ---------- O cartão da lista ---------- */

export function ListaCompras({ C, L }: { C: DadosCasa; L: ListaOrganizada }) {
  const c = useCores();
  const reduzir = useReducedMotion();
  const total = L.abertos.length + L.feitos.length;
  const porCorredor = L.abertos.length >= 4;
  const entra = reduzir ? undefined : FadeIn.duration(200);
  const sai = reduzir ? undefined : FadeOut.duration(150);
  const mexe = reduzir ? undefined : LinearTransition.duration(220);
  return (
    <View style={{ gap: Espaco.dois }}>
      <View style={estilos.secao}>
        <Texto accessibilityRole="header" cor={c.apoio} style={estilos.secaoTitulo}>Lista de compras</Texto>
        {total ? <Texto cor={c.apoio} style={estilos.secaoDireita}>{L.feitos.length ? `${L.feitos.length} de ${total} no carrinho` : `${total} ${total === 1 ? 'item' : 'itens'}`}</Texto> : null}
      </View>
      <Cartao padding={Espaco.quatro}>
        <CampoAdicionar C={C} dica="Colocar (ex.: 2 leite, pão; café)" />
        {C.modelos.length ? (
          <View style={{ marginHorizontal: -Espaco.quatro }}>
            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Espaco.dois, paddingHorizontal: Espaco.quatro }} style={{ flexGrow: 0 }}>
              {[...C.modelos].sort((a, b) => a.nome.localeCompare(b.nome)).map((m) => (
                <Chip key={m.id} titulo={m.nome} icone="estrela" contagem={m.itens.length} papel="button" onPress={() => { adicionarNaLista(C, { itens: m.itens.map((i) => ({ texto: i.texto, qtd: i.qtd, ...(i.obs ? { obs: i.obs } : {}) })), nome: m.nome }); }} />
              ))}
            </Animated.ScrollView>
          </View>
        ) : null}
        {!total ? (
          <Texto v="apoio" style={{ fontSize: 14, lineHeight: 20, paddingVertical: Espaco.dois }}>
            O que um coloca aparece na hora para os outros, já separado por corredor. Segure um item para mudar a quantidade.
          </Texto>
        ) : null}
        {L.grupos.length ? (
          <View>
            {L.grupos.map((g, gi) => (
              <Animated.View key={g.secao} layout={mexe} entering={entra} exiting={sai}>
                {porCorredor ? <Texto v="rotulo" style={[estilos.corredor, !gi && { marginTop: 4 }]}>{g.nome}</Texto> : gi ? <Separador recuo={38} /> : null}
                {g.itens.map((x, i) => (
                  <Animated.View key={x.id} layout={mexe} entering={entra} exiting={sai}>
                    {i ? <Separador recuo={38} /> : null}
                    <LinhaItem C={C} x={x} />
                  </Animated.View>
                ))}
              </Animated.View>
            ))}
          </View>
        ) : null}
        {!L.abertos.length && L.feitos.length ? (
          <View style={estilos.tudo}>
            <Icone nome="check" tamanho={16} cor={c.positivo} peso="bold" />
            <Texto v="forte" cor={c.positivo}>Tudo no carrinho</Texto>
          </View>
        ) : null}
        {L.feitos.length ? (
          <Animated.View layout={mexe}>
            <View style={estilos.carrinhoTopo}>
              <Texto v="rotulo" style={{ flex: 1 }}>No carrinho</Texto>
              <Tocavel onPress={() => { tirarDaLista(L.feitos, { comprados: true }); }} vibra={false} escala={0.94} hitSlop={10} accessibilityLabel={`Limpar os ${L.feitos.length} comprados`}>
                <Texto cor={c.azulTinta} style={estilos.limpar}>Limpar comprados</Texto>
              </Tocavel>
            </View>
            {L.feitos.map((x, i) => (
              <Animated.View key={x.id} layout={mexe} entering={entra} exiting={sai}>
                {i ? <Separador recuo={38} /> : null}
                <LinhaItem C={C} x={x} />
              </Animated.View>
            ))}
          </Animated.View>
        ) : null}
        <Estimativa C={C} L={L} />
        {L.abertos.length ? (
          <Botao titulo="Estou no mercado" icone="carrinho" largo onPress={() => router.push('/casa/mercado')} rotulo="Estou no mercado: abre a lista grande, com a tela sempre acesa" style={{ marginTop: Espaco.dois }} />
        ) : null}
        <Botao titulo="Ler a nota do mercado" icone="recibo" variante={L.abertos.length ? 'texto' : 'secundario'} tamanho={L.abertos.length ? 'pequeno' : 'medio'} largo onPress={() => abrirCasaNoSite('casa-nota')} rotulo="Ler a nota do mercado (abre no Avina completo)" />
      </Cartao>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6, borderRadius: Raio.pilula, borderCurve: 'continuous', borderWidth: 1 },
  campoTexto: { flex: 1, fontFamily: Fontes.textoForte, padding: 0, outlineWidth: 0 },
  enviar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  itemTexto: { fontFamily: Fontes.textoForte },
  qtd: { fontFamily: Fontes.tituloForte, fontVariant: ['tabular-nums'] },
  preco: { fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  corredor: { marginTop: Espaco.tres + 2, fontSize: 11 },
  carrinhoTopo: { flexDirection: 'row', alignItems: 'center', marginTop: Espaco.tres, minHeight: 32 },
  limpar: { fontFamily: Fontes.textoForte, fontSize: 13.5, lineHeight: 18 },
  tudo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Espaco.dois },
  estimativa: { gap: 8, marginTop: Espaco.tres, padding: Espaco.tres, borderRadius: Raio.pequeno, borderCurve: 'continuous' },
  estimativaTopo: { flexDirection: 'row', alignItems: 'center' },
  estimativaValor: { fontFamily: Fontes.tituloForte, fontSize: 18, lineHeight: 23, fontVariant: ['tabular-nums'] },
  secao: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, paddingHorizontal: Espaco.um },
  secaoTitulo: { flex: 1, fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  secaoDireita: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
});
