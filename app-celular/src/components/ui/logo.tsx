// A logo da empresa de um lançamento, do mesmo jeito que o site (../src/marcas.js):
// marca conhecida ou site → logo de verdade (tenta as fontes em ordem e lembra a que deu certo);
// sem logo → as iniciais numa cor própria; sem empresa → o ícone da categoria.
// banco: o selo do banco no canto (o lançamento veio do Open Finance).
// As logos de verdade levam um aro fininho: no claro, a logo de fundo branco não some no cartão branco.
// Daqui também sai a cor de cada banco (corDoBanco), a mesma no Início, nos Bancos e nos cartões de crédito.
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icone, iconeDaCategoria } from '@/components/icone';
import { comAlfa, misturar } from '@/components/ui/comum';
import { Fontes, useCores } from '@/constants/theme';
import { useEstado, type Categoria } from '@/lib/motor';
import { acharMarca, fonteLembrada, fontesLogo, lembrarFonte, marcaPorId, monograma } from '@site/marcas.js';

type Fonte = { url: string; min: number };

// A categoria pelo id (procura nas de gasto e nas de entrada do retrato do site) ou o próprio objeto
export function useCategoria(cat?: Categoria | string | null): Categoria | null {
  const e = useEstado();
  if (!cat) return null;
  if (typeof cat !== 'string') return cat;
  return e?.categorias.find((x) => x.id === cat) ?? e?.catEntrada.find((x) => x.id === cat) ?? null;
}

// Círculo com a cor da categoria e o ícone dela
export function IconeCategoria({ cat, tamanho = 44, style }: { cat?: Categoria | string | null; tamanho?: number; style?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const k = useCategoria(cat);
  const cor = k?.cor ?? c.apoio;
  return (
    <View
      accessible={false}
      style={[{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: comAlfa(cor, c.escuro ? 0.18 : 0.15) }, style]}>
      <Icone nome={iconeDaCategoria(k?.ic)} tamanho={Math.round(tamanho * 0.46)} cor={c.escuro ? misturar(cor, '#FFFFFF', 0.1) : misturar(cor, '#000000', 0.3)} cheio />
    </View>
  );
}

function Monograma({ nome, tamanho }: { nome: string; tamanho: number }) {
  const { ini, cor } = monograma(nome || '?') as { ini: string; cor: string };
  return (
    <View style={[estilos.redondo, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor }]}>
      <Text allowFontScaling={false} style={{ color: '#FFFFFF', fontFamily: Fontes.tituloForte, fontSize: Math.round(tamanho * (ini.length > 1 ? 0.34 : 0.4)), letterSpacing: -0.3 }}>{ini}</Text>
    </View>
  );
}

// Tenta as fontes em ordem (ícone grande do site > Google novo > Google antigo); se nada servir, as iniciais
function LogoDoSite({ site, rotulo, tamanho }: { site: string; rotulo: string; tamanho: number }) {
  const c = useCores();
  const fontes = fontesLogo(site) as Fonte[];
  const [i, setI] = useState<number>(() => { const f = fonteLembrada(site) as number | undefined; return f === undefined ? 0 : f; });
  const [pronta, setPronta] = useState(false);
  if (i < 0 || i >= fontes.length) return <Monograma nome={rotulo} tamanho={tamanho} />;
  const f = fontes[i];
  const proxima = () => { const n = i + 1; setPronta(false); if (n >= fontes.length) { lembrarFonte(site, -1); setI(-1); } else setI(n); };
  const cheia = i === 0; // o ícone de iPhone do site já vem quadrado e cheio: ocupa o círculo todo
  return (
    <View style={[estilos.redondo, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: pronta ? '#FFFFFF' : 'rgba(127,127,135,0.16)' }]}>
      <Image
        key={f.url}
        source={{ uri: f.url }}
        recyclingKey={f.url}
        cachePolicy="memory-disk"
        transition={160}
        contentFit={cheia ? 'cover' : 'contain'}
        style={cheia ? { width: tamanho, height: tamanho } : { width: tamanho * 0.62, height: tamanho * 0.62, borderRadius: tamanho * 0.12 }}
        onError={proxima}
        onLoad={(e) => { if ((e.source?.width ?? 0) < f.min) proxima(); else { lembrarFonte(site, i); setPronta(true); } }}
        accessible={false}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: tamanho / 2, borderWidth: tamanho >= 28 ? 1 : StyleSheet.hairlineWidth, borderColor: c.linhaForte }]} />
    </View>
  );
}

export type LogoProps = {
  marca?: string | null; // id em marcas.js
  site?: string | null; // domínio (quando a empresa não está na lista)
  nome?: string | null; // nome da empresa ou a descrição do lançamento (para as iniciais)
  cat?: Categoria | string | null; // categoria (objeto ou id): o ícone quando não há empresa
  banco?: string | null; // nome do banco do Open Finance: o selo no canto
  tamanho?: number; // 36, 44 ou 52
  anel?: string; // cor do anel em volta do selo (a cor do fundo atrás; padrão: o fundo da tela)
  style?: StyleProp<ViewStyle>;
};

export function Logo({ marca, site, nome, cat, banco, tamanho = 44, anel, style }: LogoProps) {
  const c = useCores();
  const m = marcaPorId(marca) as { nome: string; site: string } | null;
  const alvo = m && m.site ? m.site : site || null;
  const rotulo = (m && m.nome) || nome || alvo || '';
  let corpo;
  if (alvo) corpo = <LogoDoSite key={alvo} site={alvo} rotulo={rotulo} tamanho={tamanho} />;
  else if (m || (!cat && rotulo)) corpo = <Monograma nome={rotulo} tamanho={tamanho} />;
  else corpo = <IconeCategoria cat={cat} tamanho={tamanho} />;
  const selo = Math.max(16, Math.round(tamanho * 0.42));
  return (
    <View style={[{ width: tamanho, height: tamanho }, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      {corpo}
      {banco ? (
        <View style={[estilos.selo, { width: selo + 4, height: selo + 4, borderRadius: (selo + 4) / 2, backgroundColor: anel ?? c.fundo, right: -4, bottom: -4 }]}>
          <SeloBanco banco={banco} tamanho={selo} />
        </View>
      ) : null}
    </View>
  );
}

// A logo pequena do banco (pela lista de marcas: Nubank, Itaú, Inter...) ou as iniciais dele.
// O nome do banco se repete em toda a lista: a busca na lista de marcas fica guardada.
const bancos = new Map<string, { nome: string; site: string } | null>();
const marcaDoBanco = (banco: string) => {
  if (!bancos.has(banco)) bancos.set(banco, (acharMarca(banco) as { nome: string; site: string } | null) ?? null);
  return bancos.get(banco) ?? null;
};
function SeloBanco({ banco, tamanho }: { banco: string; tamanho: number }) {
  const m = marcaDoBanco(banco);
  if (m && m.site) return <LogoDoSite key={m.site} site={m.site} rotulo={m.nome} tamanho={tamanho} />;
  return <Monograma nome={banco} tamanho={tamanho} />;
}

// A cor de cada banco (a da marca), como no site (src/telas/bancos.jsx): os escuros demais (C6, XP) ganham um tom
// que aparece nos dois temas; banco fora da lista fica com a cor das iniciais dele.
const COR_BANCO: Record<string, string> = {
  nubank: '#820AD1', itau: '#EC7000', bradesco: '#CC092F', santander: '#EC0000', bb: '#F2C500', caixa: '#1C6FD1',
  inter: '#FF7A00', c6: '#7C7C84', picpay: '#21C25E', mercadopago: '#00A6E6', pagbank: '#12B886', neon: '#00A3FF',
  next: '#00C853', sicredi: '#3FA110', sicoob: '#00A091', btg: '#2F5FB3', xp: '#C9A400', rico: '#FF5A00',
  original: '#00A868', pan: '#00AEEF', will: '#E6C200', 'porto cartao': '#0067B1', paypal: '#1F7AE0', wise: '#5FB82E',
};
const coresBanco = new Map<string, string>();
export function corDoBanco(nome: string) {
  if (!coresBanco.has(nome)) {
    const m = acharMarca(nome) as { id: string } | null;
    coresBanco.set(nome, (m && COR_BANCO[m.id]) || (monograma(nome || '?') as { cor: string }).cor);
  }
  return coresBanco.get(nome)!;
}

// Só o logo de um banco (lista de contas conectadas, chips de banco)
export function LogoBanco({ banco, tamanho = 44, style }: { banco: string; tamanho?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={style} accessible={false}><SeloBanco banco={banco} tamanho={tamanho} /></View>;
}

const estilos = StyleSheet.create({
  redondo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  selo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
