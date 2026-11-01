// O "Paguei" de um documento do veículo (IPVA, licenciamento, seguro), em folha que sobe de baixo: o valor já vem o do
// documento (dá para corrigir no teclado), e a folha diz o que acontece: o gasto entra hoje no Transporte e o
// vencimento passa para o ano seguinte. Confirmar pede ao site (veiculoDocPagar, com o id do gasto criado aqui:
// repetir não paga duas vezes). Não tem Desfazer depois (o site não volta a data do documento), por isso a folha.
// Parâmetros: veiculo (id) e k (ipva | licenc | seguro).
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Teclado, Visor, falarValor, teclar, valorDoTexto, type Tecla } from '@/components/atividades/teclado';
import { novoId, pagarDocumento, useTransporte } from '@/components/transporte/acoes';
import { CirculoTipo } from '@/components/transporte/icones';
import { prazoDoc, umAnoDepois } from '@/components/transporte/regras';
import { Botao, BotaoRedondo, Icone, Pilula, Vazio, vibrar } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { dataLonga } from '@/lib/formato';

const MARGEM = 20;
const textoDe = (v: number) => (v > 0 ? v.toFixed(2).replace('.', ',').replace(/,00$/, '') : '');

export default function PagarDocumento() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const q = useLocalSearchParams<{ veiculo?: string; k?: string }>();
  const dados = useTransporte();
  const v = dados.st === 'ok' ? dados.veiculos.find((x) => x.id === q.veiculo) ?? null : null;
  const achado = v?.docs.find((d) => d.k === q.k) ?? null;
  // depois de pagar, a data do documento muda antes da folha fechar: fica o que estava na tela
  const [doc] = useState(achado);
  const atual = doc ?? achado;

  const [txt, setTxt] = useState(() => textoDe(achado?.valor ?? 0));
  const [tremor, setTremor] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const lancId = useRef(novoId('d'));
  const aberta = useRef(true);
  useEffect(() => { aberta.current = true; return () => { aberta.current = false; }; }, []);
  const [alturaFolha, setAlturaFolha] = useState(0);

  const fechar = () => { if (router.canGoBack()) router.back(); else router.replace('/transporte'); };
  const barra = <StatusBar style={c.escuro ? 'light' : 'dark'} />;

  if (!v || !atual) {
    return (
      <View style={[estilos.tela, { backgroundColor: c.fundoAlto, justifyContent: 'center' }]}>
        {barra}
        <BotaoRedondo icone="fechar" rotulo="Fechar" variante="solido" tamanho={36} onPress={fechar} style={estilos.fechar} />
        <Vazio icone="documento" titulo={dados.st === 'carregando' ? 'Abrindo…' : 'Este vencimento não está mais aqui'} texto={dados.st === 'carregando' ? undefined : 'Ele pode ter sido mudado em outro aparelho.'} acao={dados.st === 'carregando' ? undefined : { titulo: 'Fechar', onPress: fechar }} />
      </View>
    );
  }

  const valor = valorDoTexto(txt);
  const titulo = `${atual.nome} ${atual.data.slice(0, 4)}`;
  const proxima = umAnoDepois(atual.data);
  const cor = atual.dias < 0 ? c.negativo : atual.dias <= 15 ? c.ambar : undefined;
  const alturaTecla = alturaFolha ? Math.max(42, Math.min(56, Math.floor((alturaFolha - 470 - Math.max(ins.bottom, 12)) / 4))) : 52;

  const aoTeclar = (t: Tecla) => {
    const n = teclar(txt, t);
    if (n === null) { if (t !== 'apagar') { vibrar('aviso'); setTremor((x) => x + 1); } return; }
    setTxt(n);
    setErro(null);
  };
  const confirmar = async () => {
    if (valor <= 0 || salvando) return;
    setSalvando(true);
    setErro(null);
    const r = await pagarDocumento(v, atual, Math.round(valor * 100) / 100, lancId.current);
    if (!aberta.current) return;
    setSalvando(false);
    if (r.ok) fechar(); else setErro(r.texto);
  };

  return (
    <View onLayout={(e) => setAlturaFolha(Math.round(e.nativeEvent.layout.height))} style={[estilos.tela, { backgroundColor: c.fundoAlto, paddingBottom: Math.max(ins.bottom, 12) + 8 }]}>
      {barra}
      <View style={estilos.topo}>
        <BotaoRedondo icone="fechar" rotulo="Fechar sem marcar" variante="solido" tamanho={36} onPress={fechar} />
        <Text accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.titulo, { color: c.texto }]}>Marcar como pago</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={estilos.cabeca}>
        <CirculoTipo sub="documentos" cor={cor} tamanho={56} />
        <Text maxFontSizeMultiplier={1.3} style={[estilos.nome, { color: c.texto }]}>{titulo}</Text>
        <Text maxFontSizeMultiplier={1.3} style={[estilos.apoio, { color: c.apoio }]}>{v.nome} · vence em {dataLonga(atual.data)}</Text>
        <Pilula texto={prazoDoc(atual.dias, atual.data)} cor={cor} icone={atual.dias < 0 ? 'alerta' : 'calendario'} style={{ alignSelf: 'center', marginTop: 4 }} />
      </View>

      <View accessible accessibilityLabel={`Valor pago: ${falarValor(txt)}`} style={estilos.visorArea}>
        <Text maxFontSizeMultiplier={1.3} style={[estilos.apoio, { color: c.apoio }]}>Quanto você pagou?</Text>
        <Visor txt={txt} cor={c.texto} ativo tremor={tremor} />
      </View>

      <View style={[estilos.info, { backgroundColor: c.escuro ? c.cartao : c.cartao2, borderColor: c.linha }]}>
        <Icone nome="info" tamanho={16} cor={c.azulTinta} cheio />
        <Text maxFontSizeMultiplier={1.4} style={[estilos.infoTexto, { color: c.apoio }]}>
          Entra hoje nos gastos de transporte e o próximo vencimento passa para <Text style={{ color: c.texto, fontFamily: Fontes.textoForte }}>{dataLonga(proxima)} de {proxima.slice(0, 4)}</Text>.
        </Text>
      </View>

      <View style={[estilos.painel, { height: alturaTecla * 4 + 18 }]}>
        <Teclado altura={alturaTecla} aoTeclar={aoTeclar} aoLimpar={() => { if (txt) { vibrar('firme'); setTxt(''); } }} />
      </View>

      {erro ? (
        <View style={[estilos.aviso, { backgroundColor: c.cartao2, borderColor: c.linha }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icone nome="info" tamanho={18} cor={c.azulTinta} cheio />
          <Text maxFontSizeMultiplier={1.4} style={[estilos.avisoTexto, { color: c.texto }]}>{erro}</Text>
        </View>
      ) : null}

      <View style={estilos.rodape}>
        <Botao titulo="Marcar como pago" icone="check" onPress={confirmar} carregando={salvando} desativado={valor <= 0} vibra={false} largo
          rotulo={valor > 0 ? `Marcar ${titulo} como pago, ${falarValor(txt)}` : 'Marcar como pago (digite o valor primeiro)'} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  fechar: { position: 'absolute', top: 16, left: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, minHeight: 60 },
  titulo: { flex: 1, textAlign: 'center', fontFamily: Fontes.titulo, fontSize: 17, lineHeight: 22 },
  cabeca: { alignItems: 'center', gap: 4, paddingTop: 8 },
  nome: { fontFamily: Fontes.titulo, fontSize: 20, lineHeight: 26, marginTop: 8 },
  apoio: { fontFamily: Fontes.texto, fontSize: 14, lineHeight: 19, textAlign: 'center' },
  visorArea: { flex: 1, minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: MARGEM },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: MARGEM, paddingHorizontal: 14, paddingVertical: 12, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1 },
  infoTexto: { flex: 1, fontFamily: Fontes.texto, fontSize: 13.5, lineHeight: 19 },
  painel: { marginTop: 14, marginHorizontal: 14 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: MARGEM, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: Raio.pequeno, borderCurve: 'continuous', borderWidth: 1 },
  avisoTexto: { flex: 1, fontFamily: Fontes.texto, fontSize: 14, lineHeight: 19 },
  rodape: { paddingHorizontal: MARGEM, paddingTop: 12 },
});
