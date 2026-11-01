// Anotar uma conta fixa nova ou editar uma (folha que sobe de baixo; ?id= edita): o nome, que reconhece a empresa
// (mostra a logo, sugere as parecidas e escolhe a categoria dela), o valor, o dia do vencimento num seletor de − e +,
// a categoria e se é uma assinatura. Salvar pede ao site (contaSalvar).
// O que é mais complexo fica no Avina completo: escolher a logo, a conta em outra moeda e ler o boleto pela câmera.
// Numa conta em outra moeda, o valor segue a cotação: o campo fica travado e o site edita.
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { normalizarBusca } from '@/components/atividades/acoes';
import { editarContaNoSite, lerBoletoNoSite, novaContaNoSite, salvarConta, useContas } from '@/components/contas/acoes';
import { todoDia, valorNaMoeda, vencimentoNoMes } from '@/components/contas/regras';
import { Interruptor } from '@/components/perfil/interruptor';
import { Botao, BotaoRedondo, Chip, Icone, IconeCategoria, Logo, mostrarRecado, Tocavel, comAlfa, vibrar } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { chaveMes, dataLonga, dinheiro, hojeIso, mesAnterior } from '@/lib/formato';
import { useEstado } from '@/lib/motor';
import { acharMarca, buscarMarcas, marcaPorId } from '@site/marcas.js';

type Marca = { id: string; nome: string; site: string; cat: string };

const MARGEM = 20;

// "1234,5" a partir do que foi digitado: só números e uma vírgula, até 2 casas e 7 dígitos antes da vírgula
function limparValor(t: string) {
  const s = t.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const [int, ...resto] = s.split(',');
  const inteiro = int.replace(/^0+(?=\d)/, '').slice(0, 7);
  return resto.length ? `${inteiro || '0'},${resto.join('').slice(0, 2)}` : inteiro;
}
const valorDe = (t: string) => Number((t || '0').replace(',', '.')) || 0;
const textoDe = (v: number) => (v > 0 ? v.toFixed(2).replace('.', ',').replace(/,00$/, '') : '');

export default function EditarConta() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const estado = useEstado();
  const dados = useContas();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const antes = id ? dados?.lista.find((x) => x.id === id) ?? null : null;
  const editando = !!id;
  const emMoeda = !!antes?.moeda && antes.moeda !== 'BRL';
  const categorias = useMemo(() => estado?.categorias ?? [], [estado?.categorias]);

  const [nome, setNome] = useState(antes?.nome ?? '');
  const [txtValor, setTxtValor] = useState(antes ? textoDe(antes.valor) : '');
  const [dia, setDia] = useState(antes?.dia ?? 10);
  const [catEscolhida, setCatEscolhida] = useState<string | null>(antes?.cat ?? null);
  const [assinatura, setAssinatura] = useState(antes?.assinatura ?? false);
  const [focoNome, setFocoNome] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<{ texto: string; moeda?: boolean } | null>(null);
  const campoValor = useRef<TextInputInstance>(null);

  // a folha ainda está aberta? (a resposta do site pode chegar depois de a pessoa arrastar para fechar)
  const aberta = useRef(true);
  useEffect(() => { aberta.current = true; return () => { aberta.current = false; }; }, []);

  // a empresa do nome: a da conta (se o nome não mudou) ou a reconhecida pelo que foi digitado
  const marca = useMemo<Marca | null>(() => {
    if (antes && nome === antes.nome && antes.marca) return (marcaPorId(antes.marca) as Marca | null) ?? null;
    return nome.trim().length >= 2 ? (acharMarca(nome) as Marca | null) : null;
  }, [nome, antes]);
  const catAuto = marca && categorias.some((k) => k.id === marca.cat) ? marca.cat : null;
  const catId = catEscolhida ?? catAuto ?? 'casa';
  const cat = categorias.find((k) => k.id === catId) ?? null;
  const sugestoes = useMemo(() => {
    if (!focoNome || nome.trim().length < 2) return [];
    const q = normalizarBusca(nome);
    return (buscarMarcas(nome, 4) as { m: Marca }[]).map((r) => r.m).filter((m) => normalizarBusca(m.nome) !== q);
  }, [nome, focoNome]);
  const valor = valorDe(txtValor);
  const pode = nome.trim().length > 0 && valor > 0 && !salvando;

  // o próximo vencimento com o dia escolhido (este mês, ou o que vem se já passou)
  const hoje = hojeIso();
  const proxVence = (() => {
    const este = vencimentoNoMes(dia, chaveMes(hoje));
    if (este >= hoje) return este;
    const [a, m] = chaveMes(hoje).split('-').map(Number);
    return vencimentoNoMes(dia, m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`);
  })();

  const fechar = () => { Keyboard.dismiss(); if (router.canGoBack()) router.back(); else router.replace('/contas'); };
  const escolherMarca = (m: Marca) => {
    setNome(m.nome);
    vibrar('toque');
    if (!catEscolhida && categorias.some((k) => k.id === m.cat)) setCatEscolhida(m.cat);
    campoValor.current?.focus();
  };
  const mudarDia = (n: number) => {
    const novo = ((dia - 1 + n + 31) % 31) + 1; // 31 → 1 e 1 → 31
    setDia(novo);
    vibrar('toque');
  };
  const maisOpcoes = () => { fechar(); if (antes) editarContaNoSite(antes.id); else novaContaNoSite(); };

  const salvar = async () => {
    if (!pode) return;
    Keyboard.dismiss();
    setErro(null);
    setSalvando(true);
    const r = await salvarConta({
      ...(antes ? { id: antes.id } : {}),
      nome: (marca && normalizarBusca(nome) === normalizarBusca(marca.nome) ? marca.nome : nome.trim()),
      valor: Math.round(valor * 100) / 100,
      dia, cat: catId, assinatura, marca: marca?.id ?? null,
    });
    if (!aberta.current) return;
    setSalvando(false);
    if ('id' in r) {
      mostrarRecado({ titulo: editando ? 'Conta salva' : 'Conta adicionada', texto: nome.trim(), icone: 'check' });
      fechar();
      return;
    }
    setErro({ texto: r.texto || 'Não deu para salvar agora.', moeda: r.erro === 'moeda' });
  };

  if (editando && dados && !antes) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto, alignItems: 'center', justifyContent: 'center', padding: MARGEM }]}>
        <Text style={[estilos.sub, { color: c.apoio }]}>Esta conta não está mais aqui. Ela pode ter sido apagada em outro aparelho.</Text>
        <Botao titulo="Fechar" variante="secundario" onPress={fechar} style={{ marginTop: Espaco.quatro, alignSelf: 'center' }} />
      </View>
    );
  }

  const fundoCampo = c.escuro ? c.cartao : c.cartao2;
  const borda = (foco: boolean) => (foco ? comAlfa(c.azul, 0.6) : c.linha);
  return (
    <View style={[estilos.tela, { backgroundColor: c.fundoAlto }]}>
      <StatusBar style={c.escuro ? 'light' : 'dark'} />
      <View style={estilos.topo}>
        <BotaoRedondo icone="fechar" rotulo="Fechar sem salvar" variante="solido" tamanho={36} onPress={fechar} />
        <Text accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.titulo, { color: c.texto }]}>{editando ? 'Editar conta' : 'Nova conta fixa'}</Text>
        <Tocavel onPress={salvar} disabled={!pode} escala={0.94} vibra={false} hitSlop={8} accessibilityLabel={editando ? 'Salvar a conta' : 'Adicionar a conta'} style={estilos.salvarTopo}>
          <Text maxFontSizeMultiplier={1.3} style={[estilos.salvarTopoTexto, { color: c.azulTinta }]}>{editando ? 'Salvar' : 'Adicionar'}</Text>
        </Tocavel>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[estilos.corpo, { paddingBottom: Math.max(ins.bottom, 12) + 16 }]}>
        <Text maxFontSizeMultiplier={1.4} style={[estilos.sub, { color: c.apoio }]}>Repete todo mês. O Avina lembra antes de vencer.</Text>

        {!editando ? (
          <Tocavel onPress={() => { fechar(); lerBoletoNoSite(); }} escala={0.98} accessibilityLabel="Ler o boleto com a câmera. O Avina preenche a conta sozinho" style={[estilos.boleto, { backgroundColor: comAlfa(c.azul, c.escuro ? 0.14 : 0.08), borderColor: comAlfa(c.azul, 0.3) }]}>
            <View style={[estilos.boletoIcone, { backgroundColor: comAlfa(c.azul, c.escuro ? 0.24 : 0.14) }]}>
              <Icone nome="codigoBarras" tamanho={20} cor={c.azulTinta} peso="semibold" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text maxFontSizeMultiplier={1.3} style={[estilos.boletoTitulo, { color: c.texto }]}>Ler o boleto</Text>
              <Text maxFontSizeMultiplier={1.3} style={[estilos.boletoSub, { color: c.apoio }]}>Aponte a câmera e o Avina preenche sozinho</Text>
            </View>
            <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" />
          </Tocavel>
        ) : null}

        {/* o nome, com a logo da empresa quando reconhece */}
        <View style={{ gap: 6 }}>
          <Text maxFontSizeMultiplier={1.3} style={[estilos.rotulo, { color: c.apoio }]}>Nome da conta</Text>
          <View style={[estilos.campo, { backgroundColor: fundoCampo, borderColor: borda(focoNome) }]}>
            {marca ? (
              <Animated.View key={marca.id} entering={FadeIn.duration(200)}>
                <Logo marca={marca.id} nome={marca.nome} tamanho={30} />
              </Animated.View>
            ) : cat ? <IconeCategoria cat={cat} tamanho={30} /> : <Icone nome="conta" tamanho={18} cor={c.apoio} />}
            <TextInput
              value={nome}
              onChangeText={(t) => { setNome(t); setErro(null); }}
              onFocus={() => setFocoNome(true)}
              onBlur={() => setFocoNome(false)}
              autoFocus={!editando}
              placeholder="Ex.: Aluguel, Copel, Netflix"
              placeholderTextColor={c.fraco}
              maxLength={60}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => { if (!emMoeda) campoValor.current?.focus(); }}
              autoCapitalize="sentences"
              selectionColor={c.azul}
              cursorColor={c.azul}
              maxFontSizeMultiplier={1.3}
              accessibilityLabel="Nome da conta"
              style={[estilos.campoTexto, { color: c.texto }]}
            />
          </View>
          {sugestoes.length ? (
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -MARGEM }} contentContainerStyle={{ gap: 8, paddingHorizontal: MARGEM, paddingTop: 4 }}>
              {sugestoes.map((m) => (
                <Chip key={m.id} titulo={m.nome} papel="button" esquerda={<Logo marca={m.id} nome={m.nome} tamanho={24} style={{ marginLeft: -8 }} />} onPress={() => escolherMarca(m)} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* o valor e o dia */}
        <View style={estilos.dupla}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text maxFontSizeMultiplier={1.3} style={[estilos.rotulo, { color: c.apoio }]}>Valor por mês</Text>
            {emMoeda && antes ? (
              <View style={[estilos.campo, { backgroundColor: fundoCampo, borderColor: c.linha, opacity: 0.85 }]} accessible accessibilityLabel={`Valor: ${valorNaMoeda(antes.moeda!, antes.valorOrig ?? 0)}, hoje ${dinheiro(antes.valor)}. Segue a cotação`}>
                <Icone nome="transferir" tamanho={16} cor={c.apoio} />
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={1.3} style={[estilos.campoTexto, { color: c.texto, height: undefined }]}>{valorNaMoeda(antes.moeda!, antes.valorOrig ?? 0)}</Text>
                  <Text maxFontSizeMultiplier={1.3} style={[estilos.boletoSub, { color: c.apoio }]}>{dinheiro(antes.valor)} hoje</Text>
                </View>
              </View>
            ) : (
              <Tocavel onPress={() => campoValor.current?.focus()} vibra={false} escala={1} accessible={false} style={[estilos.campo, { backgroundColor: fundoCampo, borderColor: c.linha }]}>
                <Text maxFontSizeMultiplier={1.3} style={[estilos.moeda, { color: c.apoio }]}>R$</Text>
                <TextInput
                  ref={campoValor}
                  value={txtValor}
                  onChangeText={(t) => { setTxtValor(limparValor(t)); setErro(null); }}
                  placeholder="0,00"
                  placeholderTextColor={c.fraco}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  selectionColor={c.azul}
                  cursorColor={c.azul}
                  maxFontSizeMultiplier={1.3}
                  accessibilityLabel="Valor por mês, em reais"
                  style={[estilos.campoTexto, estilos.valorTexto, { color: c.texto }]}
                />
              </Tocavel>
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Text maxFontSizeMultiplier={1.3} style={[estilos.rotulo, { color: c.apoio }]}>Vence todo dia</Text>
            <View style={[estilos.dia, { backgroundColor: fundoCampo, borderColor: c.linha }]} accessible accessibilityRole="adjustable" accessibilityLabel={`Vence todo dia ${dia}`}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => mudarDia(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
              <Tocavel onPress={() => mudarDia(-1)} onLongPress={() => mudarDia(-5)} vibra={false} escala={0.88} accessibilityLabel="Dia anterior" style={estilos.passo}>
                <Icone nome="menos" tamanho={16} cor={c.texto} peso="bold" />
              </Tocavel>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaNumero, { color: c.texto }]}>{dia}</Text>
              <Tocavel onPress={() => mudarDia(1)} onLongPress={() => mudarDia(5)} vibra={false} escala={0.88} accessibilityLabel="Próximo dia" style={estilos.passo}>
                <Icone nome="mais" tamanho={16} cor={c.texto} peso="bold" />
              </Tocavel>
            </View>
          </View>
        </View>
        <Text maxFontSizeMultiplier={1.4} style={[estilos.dica, { color: c.apoio }]}>
          {emMoeda ? 'O valor segue a cotação do dia. Para mudar, use as opções do Avina completo. ' : ''}
          {todoDia(dia)}. Próximo vencimento: {dataLonga(proxVence)}{proxVence.slice(0, 7) === chaveMes(hoje) ? '' : ` (${mesAnterior(proxVence.slice(0, 7)) === chaveMes(hoje) ? 'mês que vem' : proxVence.slice(0, 4)})`}.
        </Text>

        {/* a categoria */}
        <View style={{ gap: 8 }}>
          <Text maxFontSizeMultiplier={1.3} style={[estilos.rotulo, { color: c.apoio }]}>Categoria</Text>
          <View style={estilos.cats} accessibilityRole="radiogroup" accessibilityLabel="Categoria">
            {categorias.map((k) => {
              const ativa = k.id === catId;
              return (
                <Tocavel
                  key={k.id}
                  onPress={() => setCatEscolhida(k.id)}
                  escala={0.95}
                  accessibilityRole="radio"
                  accessibilityLabel={k.nome}
                  accessibilityState={{ checked: ativa }}
                  style={[estilos.cat, { backgroundColor: ativa ? comAlfa(k.cor, c.escuro ? 0.2 : 0.14) : fundoCampo, borderColor: ativa ? comAlfa(k.cor, 0.7) : c.linha }]}>
                  <IconeCategoria cat={k} tamanho={26} />
                  <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.catTexto, { color: ativa ? c.texto : c.apoio }, ativa && { fontFamily: Fontes.textoPesado }]}>{k.nome}</Text>
                </Tocavel>
              );
            })}
          </View>
        </View>

        {/* assinatura */}
        <View style={[estilos.assin, { backgroundColor: fundoCampo, borderColor: c.linha }]}>
          <Icone nome="estrela" tamanho={18} cor={assinatura ? c.ambar : c.apoio} cheio={assinatura} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text maxFontSizeMultiplier={1.3} style={[estilos.boletoTitulo, { color: c.texto }]}>É uma assinatura</Text>
            <Text maxFontSizeMultiplier={1.3} style={[estilos.boletoSub, { color: c.apoio }]}>Streaming, app, academia: entra no total das assinaturas</Text>
          </View>
          <Interruptor valor={assinatura} aoMudar={(v) => { setAssinatura(v); vibrar('toque'); }} rotulo="É uma assinatura" />
        </View>

        {erro ? (
          <View style={[estilos.aviso, { backgroundColor: c.cartao2, borderColor: c.linha }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Icone nome="info" tamanho={18} cor={c.azulTinta} cheio />
            <Text maxFontSizeMultiplier={1.4} style={[estilos.avisoTexto, { color: c.texto }]}>{erro.texto}</Text>
          </View>
        ) : null}

        <Botao
          titulo={erro?.moeda ? 'Abrir no Avina completo' : editando ? 'Salvar' : 'Adicionar conta'}
          icone={erro?.moeda ? 'link' : 'check'}
          onPress={erro?.moeda ? maisOpcoes : salvar}
          carregando={salvando}
          desativado={!erro?.moeda && !pode}
          vibra={false}
          largo
          rotulo={erro?.moeda ? 'Abrir a edição desta conta no Avina completo' : !pode ? 'Salvar (coloque o nome e o valor primeiro)' : undefined}
        />
        <Botao
          titulo="Logo, moeda e mais no Avina completo"
          variante="texto"
          tamanho="pequeno"
          onPress={maisOpcoes}
          rotulo="Mais opções no Avina completo: escolher a logo, conta em outra moeda e código do boleto"
          style={{ alignSelf: 'center' }}
        />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 18, minHeight: 62 },
  titulo: { flex: 1, textAlign: 'center', fontFamily: Fontes.titulo, fontSize: 17, lineHeight: 22 },
  salvarTopo: { minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  salvarTopoTexto: { fontFamily: Fontes.textoPesado, fontSize: 15, lineHeight: 20 },
  corpo: { paddingHorizontal: MARGEM, paddingTop: 4, gap: 18 },
  sub: { fontFamily: Fontes.texto, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  boleto: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1 },
  boletoIcone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  boletoTitulo: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  boletoSub: { fontFamily: Fontes.texto, fontSize: 12.5, lineHeight: 17 },
  rotulo: { fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingLeft: 12, paddingRight: 14, borderRadius: Raio.pequeno + 2, borderCurve: 'continuous', borderWidth: 1 },
  campoTexto: { flex: 1, height: 52, fontFamily: Fontes.textoForte, fontSize: 16, padding: 0, outlineWidth: 0 },
  moeda: { fontFamily: Fontes.titulo, fontSize: 15 },
  valorTexto: { fontFamily: Fontes.tituloForte, fontSize: 20, fontVariant: ['tabular-nums'] },
  dupla: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  dia: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: Raio.pequeno + 2, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 2 },
  passo: { width: 44, height: 50, alignItems: 'center', justifyContent: 'center' },
  diaNumero: { minWidth: 32, textAlign: 'center', fontFamily: Fontes.tituloForte, fontSize: 20, fontVariant: ['tabular-nums'] },
  dica: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18, marginTop: -8, paddingHorizontal: 4 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingLeft: 7, paddingRight: 14, borderRadius: Raio.pilula, borderWidth: 1 },
  catTexto: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18 },
  assin: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1 },
  avisoTexto: { flex: 1, fontFamily: Fontes.texto, fontSize: 14, lineHeight: 19 },
});
