// Prévia no navegador (build web, para ver e tirar print das telas nativas sem celular): no lugar da WebView com o
// site (components/camada-web.tsx), um site de mentira.
// - Manda o retrato da conta de exemplo (lib/exemplo.web.ts) e responde aos pedidos das telas (pedirSite em
//   lib/motor.ts) com os mesmos formatos do site (registrarNativo em ../src/App.jsx): estado, banco, bolinha,
//   lancar, apagarLanc, tema, conectarBanco, desligarBanco, sincronizar, sair e abrir; os de Contas fixas,
//   Transporte e Nossa casa ficam em lib/exemplo-areas.web.ts.
// - Quando uma tela traz o site para a frente (mostrarWeb, abrirNoSite, sem login), aparece um painel que diz o que
//   o site abriria ali, com o botão de voltar. No celular, ali fica o Avina do site de verdade.
// - Parâmetros da URL: ?tema=dark|light|auto · ?vazio=1 · ?logado=0 (veja lib/exemplo.web.ts).
import { router, usePathname } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Mascote, Texto } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { ACOES_AREAS, atenderAreas } from '@/lib/exemplo-areas.web';
import {
  bancosExemplo, CAT_ENTRADA, CATEGORIAS, logoDe, PREVIA, responderBolinhaExemplo, resumoExemplo, retratoExemplo, retratoSemLogin,
} from '@/lib/exemplo.web';
import {
  esconderWeb, lerEstado, lerWeb, ligarInjetor, mostrarWeb, pedirSite, receberEstado, receberResposta, siteProntoParaPedidos,
  useLogado, useWeb, type Estado, type Lanc, type PedidosSite,
} from '@/lib/motor';

/* ---------- O "site": o retrato e o que ele já abriu ---------- */

let retrato: Estado = PREVIA.logado ? retratoExemplo() : retratoSemLogin(PREVIA.tema);
let bancos = PREVIA.vazio ? [] : bancosExemplo(); // conta nova: nenhum banco conectado ainda
// já na primeira pintura as telas têm os dados (no celular, vêm do retrato guardado no aparelho)
receberEstado(retrato);

// o último pedido "abrir" (o painel do site diz o que abriria)
let ultimoPedido: string | null = null;
const ouvintes = new Set<() => void>();
const mudarPedido = (t: string | null) => { ultimoPedido = t; ouvintes.forEach((f) => f()); };
const usePedido = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => ultimoPedido);

// O mesmo de components/camada-web.tsx: sem login, o site vem para a frente (fechando as telas abertas)
function aoMudarLogin(logado: boolean) {
  const w = lerWeb();
  if (!logado) {
    try { if (router.canDismiss()) router.dismissAll(); } catch {}
    if (!w.visivel || w.motivo !== 'login') mostrarWeb('login');
  } else if (w.visivel && w.motivo === 'login') esconderWeb();
}

// O site manda o retrato de novo sempre que algo muda
function publicar(e: Estado) {
  retrato = { ...e, em: Date.now() };
  receberEstado(retrato);
  aoMudarLogin(retrato.logado);
}

/* ---------- Os pedidos das telas ---------- */

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const AREAS: Record<string, string> = { consultorio: 'Consultório', pessoal: 'Pessoal', loja: 'Loja', casa: 'Casa', transporte: 'Transporte' };
const ACOES: Record<string, string> = {
  ajustes: 'os Ajustes', perfil: 'o Perfil', avisos: 'os Avisos', 'excluir-conta': 'Excluir conta', 'importar-banco': 'Importar do banco',
  importar: 'Importar extrato', 'editar-lanc': 'a edição do lançamento', caixinha: 'a caixinha', contas: 'as contas fixas', 'nova-conta': 'Nova conta fixa',
  teto: 'o teto da categoria', 'novo-lanc': 'Anotar gasto', ...ACOES_AREAS,
};
function descrever(d: PedidosSite['abrir']['dados']) {
  const partes = [d.area ? `a área ${AREAS[d.area] ?? d.area}` : null, d.tela && d.area ? `na aba "${d.tela}"` : null, d.acao || (!d.area && d.tela) ? ACOES[d.acao || d.tela || ''] ?? `"${d.acao || d.tela}"` : null];
  return partes.filter(Boolean).join(', ');
}

// lancar: anota (ou atualiza, se o id já existe), como o site faz
function lancar(itens: PedidosSite['lancar']['dados']['itens']): PedidosSite['lancar']['volta'] {
  const P = retrato.pessoal;
  if (!P) return { ok: false, erro: 'pessoal', texto: 'Para anotar gastos, ligue o Pessoal em Perfil → Como você usa o app.' };
  const lista = (Array.isArray(itens) ? itens : []).filter((it) => it && Number(it.valor) > 0 && Number(it.valor) < 1e7);
  if (!lista.length) return { ok: false, erro: 'vazio', texto: 'Não achei nada para anotar.' };
  let lanc = [...P.lanc];
  const ids: string[] = [];
  for (const it of lista) {
    const tipo = it.tipo === 'entrada' ? 'entrada' : 'saida';
    const cats = tipo === 'entrada' ? CAT_ENTRADA : CATEGORIAS;
    const desc = String(it.desc || '').trim().slice(0, 80);
    const antes = it.id ? lanc.find((l) => l.id === it.id) : undefined;
    const l: Lanc = {
      ...(antes ?? {}),
      ...it,
      id: antes ? antes.id : `n${Date.now().toString(36)}${ids.length}`,
      tipo,
      valor: Math.round(Number(it.valor) * 100) / 100,
      cat: cats.some((c) => c.id === it.cat) ? it.cat : tipo === 'entrada' ? 'outros-e' : 'outros',
      desc,
      data: /^\d{4}-\d{2}-\d{2}$/.test(it.data || '') ? it.data : hojeIso(),
      ...logoDe(desc, it.marca),
      banco: antes?.banco ?? null,
    };
    lanc = antes ? lanc.map((x) => (x.id === l.id ? l : x)) : [l, ...lanc];
    ids.push(l.id);
  }
  lanc.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  publicar({ ...retrato, pessoal: { ...P, lanc } });
  return { ok: true, ids };
}

async function atender(acao: keyof PedidosSite | string, d: any): Promise<unknown> {
  d = d || {};
  switch (acao) {
    case 'estado': return retrato;
    case 'abrir': mudarPedido(descrever(d)); return null;
    case 'lancar': await esperar(250); return lancar(d.itens);
    case 'apagarLanc': {
      const P = retrato.pessoal;
      const tinha = !!P && !!d.id && P.lanc.some((l) => l.id === d.id);
      if (tinha && P) publicar({ ...retrato, pessoal: { ...P, lanc: P.lanc.filter((l) => l.id !== d.id) } });
      return { ok: tinha };
    }
    // a Bolinha demora um pouco (para ver o "pensando")
    case 'bolinha': await esperar(1200); return responderBolinhaExemplo(d.texto, retrato);
    case 'banco':
      await esperar(500);
      return d.rota === 'estado' ? { ligado: true, bancos } : resumoExemplo(bancos);
    case 'desligarBanco':
      bancos = bancos.filter((b) => b.id !== d.itemId);
      return { ok: true };
    // a janela do banco (Pluggy) só existe no site de verdade: aqui a pessoa "fecha" sem conectar
    case 'conectarBanco': mudarPedido('a janela do banco (Open Finance)'); await esperar(800); return null;
    case 'tema':
      if (d.modo === 'auto' || d.modo === 'dark' || d.modo === 'light') publicar({ ...retrato, tema: d.modo });
      return null;
    case 'sincronizar': await esperar(900); return null;
    case 'sair': publicar(retratoSemLogin(retrato.tema)); return null;
    default: {
      // Contas fixas, Transporte e Nossa casa: o site responde num instante e manda o retrato novo
      await esperar(300);
      const r = atenderAreas(acao, d, retrato);
      if (!r) throw new Error('acao-desconhecida');
      if (r.novo) publicar(r.novo);
      return r.volta;
    }
  }
}

// Para testar no console do navegador (e no tirar.mjs dos prints, passo --js): __previa.pedir('banco', { rota: 'resumo' })
(globalThis as { __previa?: unknown }).__previa = { pedir: pedirSite, retrato: () => retrato };

// O pedido chega como o JavaScript que iria para a WebView (lib/motor.ts, pedirSite):
// window.__avinaNativo && window.__avinaNativo(id, "acao", dados); true;
const PEDIDO = /__avinaNativo\((\d+), ("(?:[^"\\]|\\.)*"), ([\s\S]*)\); true;$/;
function injetar(js: string) {
  const m = PEDIDO.exec(js);
  if (!m) return;
  const id = Number(m[1]);
  let acao: string, dados: unknown;
  try { acao = JSON.parse(m[2]); dados = JSON.parse(m[3]); } catch { receberResposta({ resp: id, erro: 'pedido' }); return; }
  atender(acao, dados).then(
    (valor) => receberResposta({ resp: id, valor }),
    (e: Error) => receberResposta({ resp: id, erro: (e && e.message) || 'erro' }),
  );
}

/* ---------- O painel do site (quando ele vem para a frente) ---------- */

function PainelDoSite({ logado, motivo }: { logado: boolean; motivo: string | null }) {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const pedido = usePedido();
  const entrar = () => { mudarPedido(null); publicar(retratoExemplo(retrato.tema, PREVIA.vazio)); };
  const voltar = () => { mudarPedido(null); esconderWeb(); };
  const titulo = !logado ? 'Entrar no Avina' : motivo === 'banco' ? 'Conectar o banco' : 'O Avina do site';
  const texto = !logado
    ? 'No celular, aqui aparecem a tela de entrar e o cadastro do site. Na prévia, dá para entrar com a conta de exemplo.'
    : `No celular, aqui abre o Avina do site${pedido ? `: ${pedido}` : ''}. Na prévia do navegador, o site não roda.`;
  return (
    <ScrollView style={[StyleSheet.absoluteFill, estilos.painel, { backgroundColor: c.fundo }]} contentContainerStyle={[estilos.dentro, { paddingTop: ins.top + 72, paddingBottom: ins.bottom + Espaco.oito }]}>
      <Mascote tamanho={88} estado={logado ? 'parado' : 'feliz'} />
      <Texto style={[estilos.marca, { color: c.azul }]} accessibilityRole="header">avina</Texto>
      <View style={estilos.textos}>
        <Texto v="subtitulo" style={estilos.centro}>{titulo}</Texto>
        <Texto v="apoio" style={estilos.centro}>{texto}</Texto>
      </View>
      {logado
        ? <Botao titulo="Voltar ao app" icone="voltar" onPress={voltar} style={estilos.botao} />
        : <Botao titulo="Entrar com a conta de exemplo" icone="pessoa" onPress={entrar} style={estilos.botao} />}
    </ScrollView>
  );
}

export function CamadaWeb() {
  const camada = useWeb();
  const logado = useLogado();
  const rota = usePathname();
  // na frente de verdade: pedida e sem uma tela nativa aberta por cima (no navegador, todas ficam dentro do <Stack>)
  const frente = camada.visivel && rota === '/';

  // primeira abertura sem login: o site começa na frente
  useEffect(() => { if (!lerEstado()?.logado) mostrarWeb('login'); }, []);

  // os pedidos das telas vêm para o site de mentira; ele "carrega" num instante e solta a fila
  useEffect(() => {
    ligarInjetor(injetar);
    const t = setTimeout(siteProntoParaPedidos, 250);
    return () => { clearTimeout(t); ligarInjetor(null); };
  }, []);

  if (!frente) return null;
  return <PainelDoSite logado={logado === true} motivo={camada.motivo} />;
}

const estilos = StyleSheet.create({
  painel: { zIndex: 2 },
  dentro: { flexGrow: 1, alignItems: 'center', paddingHorizontal: Espaco.seis, gap: Espaco.cinco },
  marca: { fontFamily: Fontes.tituloForte, fontSize: 40, lineHeight: 48, letterSpacing: -1.5 },
  textos: { gap: Espaco.dois, maxWidth: 340 },
  centro: { textAlign: 'center' },
  botao: { alignSelf: 'center' },
});
