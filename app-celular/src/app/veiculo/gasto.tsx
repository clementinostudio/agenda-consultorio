// Anotar um gasto de transporte (folha que sobe de baixo, aberta pelas ações rápidas do Transporte), com o teclado de
// valor do Anotar (sem o teclado do sistema, a não ser na descrição):
// - Abastecer: o valor grande e, embaixo, litros, preço do litro e km do painel. O teclado digita no campo tocado;
//   com dois dos três (valor, litros, preço), o terceiro sai sozinho (aparece apagado, com "≈"), como no site.
//   O combustível (Gasolina, Etanol, Diesel, GNV) e a média da semana na cidade (ANP), dizendo se pagou acima ou abaixo.
//   Os postos onde a pessoa já abastece viram atalhos para a descrição.
// - Manutenção: o que foi feito (revisão, troca de óleo, pneus...) e o km do painel (alimentam os lembretes).
// - Outro gasto: o tipo (estacionamento e pedágio, documentos, peças, corrida, ônibus e metrô, outros).
// - O dia: Hoje no topo; tocar mostra os dias para trás no lugar do teclado.
// Salvar pede ao site (transporteGasto, com o id criado aqui: repetir não anota duas vezes). Deu certo: fecha e o
// Transporte mostra o recado com Desfazer. Não deu (o limite do plano grátis, por exemplo): o texto do site, neutro.
// Parâmetros: tipo (combustivel | manutencao | outro | app | publico), veiculo (id) e manut (oleo, alinhamento...).
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dataCurtaLista } from '@/components/atividades/acoes';
import { Segmentos } from '@/components/atividades/segmentos';
import { Teclado, Visor, falarValor, teclar, valorDoTexto, type Tecla } from '@/components/atividades/teclado';
import { anotarGasto, novoId, usePrecosAgora, useTransporte, type TipoFolha } from '@/components/transporte/acoes';
import { CirculoTipo } from '@/components/transporte/icones';
import { COMB_ABAST, combDoVeiculo, MANUT, nomeCurto, precoLitro, temMotor, textoKm } from '@/components/transporte/regras';
import { CampoNumero, Dias, numeroDe, teclarCampo, textoCalculado, useTecladoDoSistema } from '@/components/transporte/teclado';
import { Botao, BotaoRedondo, Chip, Icone, Logo, Tocavel, comAlfa, vibrar } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { hojeIso, somarDias } from '@/lib/formato';
import type { CombAbast, IdManut, SubTransp, Veiculo } from '@/lib/motor';
import { acharMarca } from '@site/marcas.js';

type Campo = 'valor' | 'litros' | 'preco' | 'km';
type Marca = { id: string; nome: string };

const MARGEM = 20;

// os tipos do "Outro gasto", na ordem que mais aparece para cada veículo
function tiposDoOutro(v: Veiculo | null): SubTransp[] {
  if (v?.tipo === 'nenhum') return ['app', 'publico', 'estacionamento', 'outros'];
  if (v?.tipo === 'bike') return ['melhorias', 'estacionamento', 'publico', 'app', 'outros'];
  return ['estacionamento', 'documentos', 'melhorias', 'app', 'publico', 'outros'];
}
const TITULO: Record<SubTransp, string> = {
  combustivel: 'Abastecer', manutencao: 'Manutenção', app: 'Corrida', publico: 'Ônibus e metrô', estacionamento: 'Estacionamento',
  documentos: 'Documentos e multas', melhorias: 'Peças e melhorias', outros: 'Outro gasto',
};
const PERGUNTA: Record<SubTransp, string> = {
  combustivel: 'Quanto deu o abastecimento?', manutencao: 'Quanto custou?', app: 'Quanto foi a corrida?', publico: 'Quanto foi a passagem?',
  estacionamento: 'Quanto você pagou?', documentos: 'Quanto você pagou?', melhorias: 'Quanto custou?', outros: 'Quanto você gastou?',
};
const DESCRICAO: Record<SubTransp, string> = {
  combustivel: 'Posto (opcional)', manutencao: 'Oficina ou detalhe (opcional)', app: 'Uber, 99... (opcional)', publico: 'Ônibus, metrô, BRT (opcional)',
  estacionamento: 'Estacionamento, pedágio (opcional)', documentos: 'Multa, vistoria, CNH (opcional)', melhorias: 'O que foi comprado (opcional)', outros: 'Descrição (opcional)',
};
const BOTAO: Record<SubTransp, string> = {
  combustivel: 'Anotar abastecimento', manutencao: 'Anotar manutenção', app: 'Anotar corrida', publico: 'Anotar passagem',
  estacionamento: 'Anotar estacionamento', documentos: 'Anotar gasto', melhorias: 'Anotar compra', outros: 'Anotar gasto',
};
// atalhos para a descrição (um toque preenche); no abastecer, os postos onde a pessoa já abastece
const ATALHOS: Partial<Record<SubTransp, string[]>> = {
  app: ['Uber', '99', 'inDrive'], publico: ['Ônibus', 'Metrô', 'Trem'], estacionamento: ['Zona Azul', 'Sem Parar', 'Pedágio'],
  documentos: ['Multa', 'Vistoria', 'CNH'], manutencao: ['Lava-jato', 'Borracharia', 'Oficina'],
};

export default function GastoTransporte() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const q = useLocalSearchParams<{ tipo?: string; veiculo?: string; manut?: string }>();
  const dados = useTransporte();
  const precosAgora = usePrecosAgora();
  const veiculos = useMemo(() => (dados.st === 'ok' ? dados.veiculos : []), [dados]);
  const v = veiculos.find((x) => x.id === q.veiculo) ?? null;
  const tipo = (['combustivel', 'manutencao', 'outro', 'app', 'publico'].includes(q.tipo ?? '') ? q.tipo : 'outro') as TipoFolha;
  const outros = tiposDoOutro(v);

  const raiz = useRef<ComponentRef<typeof View>>(null);
  const campoDesc = useRef<TextInputInstance>(null);
  const teclado = useTecladoDoSistema(raiz);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => campoDesc.current?.blur());
    return () => sub.remove();
  }, []);

  const [sub, setSub] = useState<SubTransp>(tipo === 'outro' ? outros[0] : tipo);
  const [txt, setTxt] = useState<Record<Campo, string>>({ valor: '', litros: '', preco: '', km: '' });
  const [ativo, setAtivo] = useState<Campo>('valor');
  const [tremor, setTremor] = useState(0);
  const [comb, setComb] = useState<CombAbast>(() => combDoVeiculo(v, v?.ultimoAbast?.combustivel));
  const [manut, setManut] = useState<IdManut>(() => (MANUT.some((m) => m[0] === q.manut) ? (q.manut as IdManut) : 'revisao'));
  const [desc, setDesc] = useState('');
  const [focoDesc, setFocoDesc] = useState(false);
  const [data, setData] = useState(hojeIso);
  const [dias, setDias] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = useRef(novoId());

  const aberta = useRef(true);
  useEffect(() => { aberta.current = true; return () => { aberta.current = false; }; }, []);

  const ehComb = sub === 'combustivel';
  const ehManut = sub === 'manutencao' || sub === 'melhorias';
  const comKm = (ehComb || ehManut) && temMotor(v);
  const val = valorDoTexto(txt.valor), l = numeroDe(txt.litros), p = numeroDe(txt.preco), km = numeroDe(txt.km);
  // com dois dos três, o terceiro sai da conta
  const valor = val || (ehComb && l && p ? Math.round(l * p * 100) / 100 : 0);
  const litrosCalc = ehComb && !l && val && p ? val / p : 0;
  const precoCalc = ehComb && !p && val && l ? val / l : 0;
  const P = precosAgora && (!(dados.st === 'ok' && dados.T.precos) || precosAgora.em > (dados.st === 'ok' ? dados.T.precos?.em ?? 0 : 0)) ? precosAgora : dados.st === 'ok' ? dados.T.precos : null;
  const media = ehComb ? P?.p[comb] : undefined;
  const pagou = p || precoCalc;
  const difMedia = media && pagou ? pagou - media : null;

  const marca = useMemo(() => (desc.trim().length >= 2 ? (acharMarca(desc) as Marca | null) : null), [desc]);
  const atalhos = ehComb ? (v?.postos ?? []).map((x) => x.nome).slice(0, 4) : ATALHOS[sub] ?? [];

  // as teclas acompanham a altura da folha (num iPhone pequeno, sem a pergunta e com o valor menor)
  const [alturaFolha, setAlturaFolha] = useState(0);
  const baixa = alturaFolha > 0 && alturaFolha < 640;
  const resto = 60 + (tipo === 'outro' ? 50 : 0) + (baixa ? 64 : 92) + (ehComb ? 70 + 50 + (media ? 22 : 0) : ehManut ? 50 + (comKm ? 70 : 0) : 0)
    + 64 + (atalhos.length && !baixa ? 46 : 0) + 70 + Math.max(ins.bottom, 12) + 8;
  const alturaTecla = alturaFolha ? Math.max(40, Math.min(54, Math.floor((alturaFolha - resto - 18) / 4))) : 50;
  const alturaPainel = alturaTecla * 4 + 6 * 3;
  const comTeclado = teclado.aberto || focoDesc;

  const fechar = () => { Keyboard.dismiss(); if (router.canGoBack()) router.back(); else router.replace('/transporte'); };
  const tirarFoco = () => { Keyboard.dismiss(); campoDesc.current?.blur(); };
  const tocarCampo = (k: Campo) => { tirarFoco(); setDias(false); setAtivo(k); };
  const aoTeclar = (t: Tecla) => {
    const atual = txt[ativo];
    const n = ativo === 'valor' ? teclar(atual, t) : ativo === 'litros' ? teclarCampo(atual, t, 2, 4) : ativo === 'preco' ? teclarCampo(atual, t, 3, 2) : teclarCampo(atual, t, 0, 7);
    if (n === null) { if (t !== 'apagar') { vibrar('aviso'); setTremor((x) => x + 1); } return; }
    setTxt((x) => ({ ...x, [ativo]: n }));
    setErro(null);
  };
  const limpar = () => { if (txt[ativo]) { vibrar('firme'); setTxt((x) => ({ ...x, [ativo]: '' })); } };
  const trocarSub = (s: SubTransp) => { setSub(s); setErro(null); if (ativo !== 'valor') setAtivo('valor'); };
  const escolherAtalho = (nome: string) => { setDesc(nome); vibrar('toque'); tirarFoco(); };

  const salvar = async () => {
    if (valor <= 0 || salvando || dados.st !== 'ok') return;
    tirarFoco();
    setSalvando(true);
    setErro(null);
    const r = await anotarGasto({
      id: id.current, veiculoId: v?.id ?? null, sub, valor, data,
      desc: (marca && desc.trim().toLowerCase() === marca.nome.toLowerCase() ? marca.nome : desc.trim()) || undefined,
      ...(ehComb ? { combustivel: comb, ...(l ? { litros: l } : {}), ...(p ? { precoLitro: p } : {}) } : {}),
      ...(ehManut ? { manut: sub === 'melhorias' && manut === 'revisao' ? 'pecas' : manut } : {}),
      ...(comKm && km ? { km } : {}),
    }, veiculos);
    if (!aberta.current) return;
    setSalvando(false);
    if (r.ok) fechar(); else setErro(r.texto);
  };

  const barra = <StatusBar style={c.escuro ? 'light' : 'dark'} />;
  const fundoCampo = c.escuro ? c.cartao : c.cartao2;
  const hoje = hojeIso();
  const textoDia = data === hoje ? 'Hoje' : data === somarDias(hoje, -1) ? 'Ontem' : dataCurtaLista(data);
  const ativoTeclado = !dias && !comTeclado;

  return (
    <View
      ref={raiz}
      collapsable={false}
      onLayout={(e) => setAlturaFolha(Math.round(e.nativeEvent.layout.height))}
      style={[estilos.tela, { backgroundColor: c.fundoAlto, paddingBottom: teclado.aberto ? teclado.cobre + 10 : Math.max(ins.bottom, 12) + 8 }]}>
      {barra}

      {/* fechar, o título (com o veículo) e o dia */}
      <View style={estilos.topo}>
        <BotaoRedondo icone="fechar" rotulo="Fechar sem anotar" variante="solido" tamanho={36} onPress={fechar} />
        <View style={estilos.titulo}>
          <Text accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.tituloTexto, { color: c.texto }]}>{tipo === 'outro' ? 'Outro gasto' : TITULO[sub]}</Text>
          {v ? <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.tituloSub, { color: c.apoio }]}>{v.nome}</Text> : null}
        </View>
        <Tocavel
          onPress={() => { tirarFoco(); setDias(!dias); }}
          escala={0.94}
          accessibilityLabel={`Dia: ${textoDia}. Toque para trocar`}
          accessibilityState={{ expanded: dias }}
          style={[estilos.dia, { backgroundColor: dias ? comAlfa(c.azul, c.escuro ? 0.22 : 0.12) : fundoCampo, borderColor: dias ? comAlfa(c.azul, 0.6) : c.linha }]}>
          <Icone nome="calendario" tamanho={14} cor={dias ? c.azulTinta : c.apoio} peso="semibold" />
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[estilos.diaTexto, { color: dias ? c.azulTinta : c.texto }]}>{textoDia}</Text>
        </Tocavel>
      </View>

      {/* o tipo, no "Outro gasto" */}
      {tipo === 'outro' ? (
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={estilos.faixa} contentContainerStyle={estilos.faixaDentro} accessibilityRole="radiogroup" accessibilityLabel="Tipo de gasto">
          {outros.map((s) => (
            <Chip key={s} titulo={nomeCurto(s)} ativo={s === sub} esquerda={<CirculoTipo sub={s} tamanho={26} style={{ marginLeft: -9 }} />} onPress={() => trocarSub(s)} />
          ))}
        </ScrollView>
      ) : null}

      {/* o valor (tocar volta para ele) */}
      <Pressable
        onPress={() => tocarCampo('valor')}
        accessibilityRole="button"
        accessibilityLabel={`Valor: ${valor ? falarValor(txt.valor || String(valor).replace('.', ',')) : 'vazio'}${!val && valor ? ', calculado pelos litros e o preço' : ''}`}
        style={[estilos.visorArea, baixa && { minHeight: 60, paddingVertical: 2 }]}>
        {!teclado.aberto && !baixa ? <Text maxFontSizeMultiplier={1.3} style={[estilos.pergunta, { color: c.apoio }]}>{PERGUNTA[sub]}</Text> : null}
        <Visor
          txt={txt.valor || (valor ? textoCalculado(valor, 2).replace(/\./g, '') : '')}
          cor={val ? c.texto : c.apoio}
          ativo={ativo === 'valor' && ativoTeclado}
          tremor={ativo === 'valor' ? tremor : 0}
          compacto={teclado.aberto || baixa}
        />
      </Pressable>

      {/* o que foi feito na manutenção */}
      {sub === 'manutencao' ? (
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={[estilos.faixa, { marginTop: 0, marginBottom: 12 }]} contentContainerStyle={estilos.faixaDentro} accessibilityRole="radiogroup" accessibilityLabel="O que foi feito">
          {MANUT.map(([k, n]) => <Chip key={k} titulo={n} ativo={manut === k} onPress={() => setManut(k)} />)}
        </ScrollView>
      ) : null}

      {/* litros, preço do litro e km (abastecer) ou só o km (manutenção) */}
      {ehComb || comKm ? (
        <View style={estilos.campos}>
          {ehComb ? (
            <>
              <CampoNumero rotulo="Litros" txt={txt.litros} calculado={litrosCalc ? textoCalculado(litrosCalc, 2) : null} unidade="L" ativo={ativo === 'litros' && ativoTeclado} onPress={() => tocarCampo('litros')}
                falar={`Litros: ${txt.litros || (litrosCalc ? `cerca de ${textoCalculado(litrosCalc, 2)}, calculado` : 'vazio')}`} />
              <CampoNumero rotulo="Preço do litro" txt={txt.preco} calculado={precoCalc ? textoCalculado(precoCalc, 2) : null} dica={media ? textoCalculado(media, 2) : null} prefixo="R$" ativo={ativo === 'preco' && ativoTeclado} onPress={() => tocarCampo('preco')}
                falar={`Preço do litro: ${txt.preco ? `${txt.preco} reais` : precoCalc ? `cerca de ${precoLitro(precoCalc)}, calculado` : 'vazio'}`} />
            </>
          ) : null}
          {comKm ? (
            <CampoNumero rotulo={ehComb ? 'Km no painel' : 'Km no painel (opcional)'} txt={txt.km} dica={v?.km ? textoCalculado(v.km, 0) : null} ativo={ativo === 'km' && ativoTeclado} onPress={() => tocarCampo('km')}
              falar={`Quilometragem no painel, opcional: ${txt.km || 'vazio'}${v?.km ? `. A última anotada foi ${textoKm(v.km)}` : ''}`} style={ehComb ? { flex: 1.1 } : undefined} />
          ) : null}
        </View>
      ) : null}

      {/* o combustível e a média da semana */}
      {ehComb ? (
        <View style={{ marginTop: 12, marginHorizontal: MARGEM, gap: 8 }}>
          <Segmentos rotulo="Combustível" opcoes={COMB_ABAST.map(([k, n]) => ({ id: k, nome: n }))} valor={comb} onTrocar={(k) => { setComb(k); vibrar('toque'); }} />
          {media ? (
            <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[estilos.media, { color: c.apoio }]}>
              Média da semana: {precoLitro(media)}
              {difMedia != null && Math.abs(difMedia) >= 0.02 ? (
                <Text style={{ color: difMedia > 0 ? c.ambar : c.positivo, fontFamily: Fontes.textoForte }}> · {precoLitro(Math.abs(difMedia))} {difMedia > 0 ? 'acima' : 'abaixo'}</Text>
              ) : difMedia != null ? <Text style={{ color: c.positivo, fontFamily: Fontes.textoForte }}> · na média</Text> : null}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* a descrição, com a logo da empresa quando reconhece */}
      <View style={[estilos.campo, { backgroundColor: fundoCampo, borderColor: focoDesc ? comAlfa(c.azul, 0.6) : c.linha }]}>
        {marca ? (
          <Animated.View key={marca.id} entering={FadeIn.duration(200)}><Logo marca={marca.id} nome={marca.nome} tamanho={30} /></Animated.View>
        ) : <CirculoTipo sub={sub} tamanho={30} />}
        <TextInput
          ref={campoDesc}
          value={desc}
          onChangeText={(t) => { setDesc(t); setErro(null); }}
          onFocus={() => { setFocoDesc(true); setDias(false); }}
          onBlur={() => setFocoDesc(false)}
          placeholder={DESCRICAO[sub]}
          placeholderTextColor={c.apoio}
          maxLength={80}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          autoCapitalize="sentences"
          selectionColor={c.azul}
          cursorColor={c.azul}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel={DESCRICAO[sub]}
          style={[estilos.campoTexto, { color: c.texto }]}
        />
        {desc ? (
          <Tocavel onPress={() => setDesc('')} hitSlop={12} escala={0.9} accessibilityLabel="Limpar a descrição" style={[estilos.limpar, { backgroundColor: c.cartao3 }]}>
            <Icone nome="fechar" tamanho={10} cor={c.texto} peso="bold" />
          </Tocavel>
        ) : null}
      </View>

      {/* os postos onde já abasteceu (ou os apps de corrida): um toque preenche */}
      {atalhos.length && !desc && !baixa ? (
        <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={[estilos.faixa, { marginTop: 8 }]} contentContainerStyle={estilos.faixaDentro}>
          {atalhos.map((nome) => {
            const m = acharMarca(nome) as Marca | null;
            const esquerda = m ? <Logo marca={m.id} nome={nome} tamanho={24} style={{ marginLeft: -8 }} /> : <CirculoTipo sub={sub} tamanho={24} style={{ marginLeft: -8 }} />;
            return <Chip key={nome} titulo={nome} papel="button" esquerda={esquerda} onPress={() => escolherAtalho(nome)} />;
          })}
        </ScrollView>
      ) : null}

      {/* o teclado (ou os dias); some com o teclado do sistema */}
      {!comTeclado ? (
        <View style={[estilos.painel, { height: alturaPainel }]}>
          {dias ? (
            <Animated.View key="dias" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <Dias data={data} margem={MARGEM} aoEscolher={(d) => { setData(d); setDias(false); }} />
            </Animated.View>
          ) : (
            <Animated.View key="teclado" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <Teclado altura={alturaTecla} aoTeclar={aoTeclar} aoLimpar={limpar} />
            </Animated.View>
          )}
        </View>
      ) : null}

      {erro ? (
        <View style={[estilos.aviso, { backgroundColor: c.cartao2, borderColor: c.linha }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icone nome="info" tamanho={18} cor={c.azulTinta} cheio />
          <Text maxFontSizeMultiplier={1.4} style={[estilos.avisoTexto, { color: c.texto }]}>{erro}</Text>
        </View>
      ) : null}

      <View style={estilos.rodape}>
        <Botao
          titulo={BOTAO[sub]}
          onPress={salvar}
          carregando={salvando}
          desativado={valor <= 0 || dados.st !== 'ok'}
          vibra={false}
          largo
          rotulo={valor > 0 ? `${BOTAO[sub]} de ${falarValor(txt.valor || textoCalculado(valor, 2).replace(/\./g, ''))}` : `${BOTAO[sub]} (digite o valor primeiro)`}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, minHeight: 60 },
  titulo: { flex: 1, alignItems: 'center' },
  tituloTexto: { fontFamily: Fontes.titulo, fontSize: 17, lineHeight: 22 },
  tituloSub: { fontFamily: Fontes.texto, fontSize: 12.5, lineHeight: 16 },
  dia: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, maxWidth: 120, paddingHorizontal: 12, borderRadius: Raio.pilula, borderWidth: 1 },
  diaTexto: { fontFamily: Fontes.textoForte, fontSize: 13.5, lineHeight: 18 },
  faixa: { flexGrow: 0, marginTop: 10 },
  faixaDentro: { gap: 8, paddingHorizontal: MARGEM, alignItems: 'center' },
  visorArea: { flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6, paddingHorizontal: MARGEM },
  pergunta: { fontFamily: Fontes.texto, fontSize: 14, lineHeight: 19 },
  campos: { flexDirection: 'row', gap: 8, marginHorizontal: MARGEM },
  media: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, marginHorizontal: MARGEM, marginTop: 12, paddingLeft: 11, paddingRight: 14, borderRadius: Raio.pilula, borderCurve: 'continuous', borderWidth: 1 },
  campoTexto: { flex: 1, height: 50, fontFamily: Fontes.textoForte, fontSize: 16, padding: 0, outlineWidth: 0 },
  limpar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  painel: { marginTop: 12, marginHorizontal: 14 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: MARGEM, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1 },
  avisoTexto: { flex: 1, fontFamily: Fontes.texto, fontSize: 14, lineHeight: 19 },
  rodape: { paddingHorizontal: MARGEM, paddingTop: 12 },
});
