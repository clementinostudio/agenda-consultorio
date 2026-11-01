// Os ícones do Avina: SF Symbols no iPhone (os mesmos dos apps da Apple) e, no Android, desenhos próprios em SVG
// no mesmo espírito (traço arredondado de 1,8). Um conjunto fixo de nomes, para as telas não dependerem de pacote
// de ícones nem de fonte baixada.
// - cheio: a versão preenchida (aba ativa, olho...), quando existe.
// - Os símbolos do iPhone usados aqui existem no iOS 16 (o mínimo do app).
import { SymbolView, type SymbolViewProps, type SymbolWeight } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { useCores } from '@/constants/theme';

export type NomeIcone =
  | 'inicio' | 'atividades' | 'areas' | 'bolinha' | 'chat' | 'mais' | 'menos' | 'busca' | 'filtro' | 'olho' | 'olhoFechado'
  | 'fechar' | 'voltar' | 'chevron' | 'chevronBaixo' | 'relogio' | 'copiar' | 'gostei' | 'naoGostei' | 'enviar' | 'microfone'
  | 'banco' | 'cartao' | 'investimento' | 'carteira' | 'grafico' | 'categoria' | 'calendario' | 'alerta' | 'cadeado' | 'faceid'
  | 'sair' | 'lixo' | 'editar' | 'compartilhar' | 'atualizar' | 'check' | 'estrela' | 'sol' | 'lua' | 'celular' | 'consultorio'
  | 'loja' | 'casa' | 'carro' | 'combustivel' | 'ajuda' | 'documento' | 'link' | 'setaCima' | 'setaBaixo' | 'entrada' | 'saida'
  | 'transferir' | 'configuracoes' | 'pessoa' | 'sino' | 'widgets'
  // categorias do site (ic: cart, food, heart, bag, money, bill, users, gear, receipt, more)
  | 'carrinho' | 'comida' | 'coracao' | 'sacola' | 'dinheiro' | 'conta' | 'pessoas' | 'recibo' | 'engrenagem' | 'pontos' | 'presente'
  // extras do chat e dos ajustes
  | 'parar' | 'faisca' | 'local' | 'escudo' | 'info' | 'ordenar' | 'arrastar';

/* ---------- iPhone: SF Symbols [normal, cheio] ---------- */

type SFSymbol = Extract<SymbolViewProps['name'], string>;

const SF: Record<NomeIcone, [SFSymbol, SFSymbol?]> = {
  inicio: ['house', 'house.fill'],
  atividades: ['list.bullet.rectangle', 'list.bullet.rectangle.fill'],
  areas: ['square.grid.2x2', 'square.grid.2x2.fill'],
  bolinha: ['face.smiling', 'face.smiling.inverse'],
  chat: ['bubble.left', 'bubble.left.fill'],
  mais: ['plus'],
  menos: ['minus'],
  busca: ['magnifyingglass'],
  filtro: ['line.3.horizontal.decrease'],
  olho: ['eye', 'eye.fill'],
  olhoFechado: ['eye.slash', 'eye.slash.fill'],
  fechar: ['xmark'],
  voltar: ['chevron.left'],
  chevron: ['chevron.right'],
  chevronBaixo: ['chevron.down'],
  relogio: ['clock.arrow.circlepath'],
  copiar: ['doc.on.doc', 'doc.on.doc.fill'],
  gostei: ['hand.thumbsup', 'hand.thumbsup.fill'],
  naoGostei: ['hand.thumbsdown', 'hand.thumbsdown.fill'],
  enviar: ['arrow.up'],
  microfone: ['mic', 'mic.fill'],
  banco: ['building.columns', 'building.columns.fill'],
  cartao: ['creditcard', 'creditcard.fill'],
  investimento: ['chart.line.uptrend.xyaxis'],
  carteira: ['wallet.pass', 'wallet.pass.fill'],
  grafico: ['chart.bar', 'chart.bar.fill'],
  categoria: ['chart.pie', 'chart.pie.fill'],
  calendario: ['calendar'],
  alerta: ['exclamationmark.triangle', 'exclamationmark.triangle.fill'],
  cadeado: ['lock', 'lock.fill'],
  faceid: ['faceid'],
  sair: ['rectangle.portrait.and.arrow.right'],
  lixo: ['trash', 'trash.fill'],
  editar: ['pencil'],
  compartilhar: ['square.and.arrow.up'],
  atualizar: ['arrow.clockwise'],
  check: ['checkmark'],
  estrela: ['star', 'star.fill'],
  sol: ['sun.max', 'sun.max.fill'],
  lua: ['moon', 'moon.fill'],
  celular: ['iphone'],
  consultorio: ['stethoscope'],
  loja: ['basket', 'basket.fill'],
  casa: ['house', 'house.fill'],
  carro: ['car', 'car.fill'],
  combustivel: ['fuelpump', 'fuelpump.fill'],
  ajuda: ['questionmark.circle', 'questionmark.circle.fill'],
  documento: ['doc.text', 'doc.text.fill'],
  link: ['link'],
  setaCima: ['arrow.up'],
  setaBaixo: ['arrow.down'],
  entrada: ['arrow.down.left'],
  saida: ['arrow.up.right'],
  transferir: ['arrow.left.arrow.right'],
  configuracoes: ['gearshape', 'gearshape.fill'],
  pessoa: ['person.crop.circle', 'person.crop.circle.fill'],
  sino: ['bell', 'bell.fill'],
  widgets: ['rectangle.3.group', 'rectangle.3.group.fill'],
  carrinho: ['cart', 'cart.fill'],
  comida: ['fork.knife'],
  coracao: ['heart', 'heart.fill'],
  sacola: ['bag', 'bag.fill'],
  dinheiro: ['banknote', 'banknote.fill'],
  conta: ['doc.plaintext', 'doc.plaintext.fill'],
  pessoas: ['person.2', 'person.2.fill'],
  recibo: ['scroll', 'scroll.fill'],
  engrenagem: ['gearshape.2', 'gearshape.2.fill'],
  pontos: ['ellipsis'],
  presente: ['gift', 'gift.fill'],
  parar: ['stop.fill'],
  faisca: ['sparkles'],
  local: ['location', 'location.fill'],
  escudo: ['lock.shield', 'lock.shield.fill'],
  info: ['info.circle', 'info.circle.fill'],
  ordenar: ['arrow.up.arrow.down'],
  arrastar: ['line.3.horizontal'],
};

/* ---------- Android: desenhos próprios (grade 24×24) ---------- */

// traços: caminhos com contorno; "p" = sempre preenchido (pontinhos); "c" = preenchido na versão cheia
type Traco = string | { d: string; p?: true; c?: true };
type Desenho = { t: Traco[]; espelho?: true };

const bola = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const caixa = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const CASA: Desenho = { t: ['M3.5 10.5 12 3.5l8.5 7', { d: 'M5.5 9v10a1.5 1.5 0 0 0 1.5 1.5h3v-6h4v6h3a1.5 1.5 0 0 0 1.5-1.5V9', c: true }] };
const ESTRELA = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';
const POLEGAR: Traco[] = [{ d: 'M8 10.5 11.3 3.6c1.4 0 2.5 1.1 2.5 2.5v3.6h4.9a2 2 0 0 1 2 2.4l-1.3 6.6a2 2 0 0 1-2 1.6H8z', c: true }, caixa(3.5, 10.5, 4.5, 10.3, 1.2)];
const ENGRENAGEM = 'M12 2.8l1.7 2.3 2.8-.7.6 2.8 2.7 1.1-.9 2.7L21 13l-2.2 1.8.6 2.8-2.8.4-.9 2.7-2.6-1.2L12 21.2l-1.6-2.2-2.6 1.2-.9-2.7-2.8-.4.6-2.8L3 13l2.1-1.9-.9-2.7 2.7-1.1.6-2.8 2.8.7z';
const CONTA: Desenho = { t: [{ d: 'M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z', c: true }, 'M9 8h6', 'M9 12h6', 'M9 16h3'] };

const DESENHOS: Record<NomeIcone, Desenho> = {
  inicio: CASA,
  casa: CASA,
  atividades: { t: [{ d: caixa(3.5, 3.5, 17, 17, 4), c: true }, 'M8 9h8', 'M8 12.5h8', 'M8 16h5'] },
  areas: { t: [{ d: caixa(3.5, 3.5, 7.2, 7.2, 2.2), c: true }, { d: caixa(13.3, 3.5, 7.2, 7.2, 2.2), c: true }, { d: caixa(3.5, 13.3, 7.2, 7.2, 2.2), c: true }, { d: caixa(13.3, 13.3, 7.2, 7.2, 2.2), c: true }] },
  widgets: { t: [{ d: caixa(3.5, 3.5, 7.2, 7.2, 2.2), c: true }, { d: caixa(13.3, 3.5, 7.2, 17, 2.2), c: true }, { d: caixa(3.5, 13.3, 7.2, 7.2, 2.2), c: true }] },
  bolinha: { t: [{ d: bola(12, 12, 8.5), c: true }, 'M9.6 10v2.6', 'M14.4 10v2.6'] },
  chat: { t: [{ d: 'M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.6z', c: true }] },
  mais: { t: ['M12 5v14', 'M5 12h14'] },
  menos: { t: ['M5 12h14'] },
  busca: { t: [bola(10.8, 10.8, 6.6), 'M15.8 15.8l4.7 4.7'] },
  filtro: { t: ['M4 7h16', 'M7 12h10', 'M10 17h4'] },
  olho: { t: [{ d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', c: true }, bola(12, 12, 3)] },
  olhoFechado: { t: ['M3.5 3.5l17 17', 'M10.4 5.6c.5-.1 1-.1 1.6-.1 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.7 3.5', 'M6.6 6.6C4.1 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.6-1.3', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'] },
  fechar: { t: ['M6 6l12 12', 'M18 6 6 18'] },
  voltar: { t: ['M15 4.5 7.5 12l7.5 7.5'] },
  chevron: { t: ['M9 4.5l7.5 7.5L9 19.5'] },
  chevronBaixo: { t: ['M4.5 9l7.5 7.5L19.5 9'] },
  relogio: { t: ['M4 12a8 8 0 1 0 2.4-5.7', 'M3.8 3.8v3.7h3.7', 'M12 8v4.4l3 1.8'] },
  copiar: { t: [{ d: caixa(8.5, 8.5, 12, 12, 2.5), c: true }, 'M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5'] },
  gostei: { t: POLEGAR },
  naoGostei: { t: POLEGAR, espelho: true },
  enviar: { t: ['M12 19.5v-15', 'M5.5 11 12 4.5 18.5 11'] },
  microfone: { t: [{ d: caixa(9, 3, 6, 11.5, 3), c: true }, 'M5.5 11.5a6.5 6.5 0 0 0 13 0', 'M12 18v3'] },
  banco: { t: [{ d: 'M3.5 9.5h17L12 4z', c: true }, 'M4 20h16', 'M6 12.5v5', 'M10 12.5v5', 'M14 12.5v5', 'M18 12.5v5'] },
  cartao: { t: [{ d: caixa(2.5, 5, 19, 14, 2.8), c: true }, 'M2.5 10h19', 'M6.5 15h3.5'] },
  investimento: { t: ['M3.5 3.5v17h17', 'M7 15l4-4 3 3 6-6.5', 'M15.5 7.5H20V12'] },
  carteira: { t: [{ d: caixa(3, 5.5, 18, 14, 3), c: true }, caixa(14, 10.3, 7, 4.6, 1.6), { d: bola(17.3, 12.6, 0.8), p: true }] },
  grafico: { t: ['M5 20v-7', 'M10 20V5', 'M15 20v-9', 'M20 20v-4'] },
  categoria: { t: [{ d: 'M11 3.6A8.5 8.5 0 1 0 20.4 13H11z', c: true }, 'M14.5 3.2a8.5 8.5 0 0 1 6.3 6.3h-6.3z'] },
  calendario: { t: [caixa(3.5, 5, 17, 15.5, 2.8), 'M3.5 10h17', 'M8 3v4', 'M16 3v4'] },
  alerta: { t: [{ d: 'M10.3 4.3 2.7 17.6a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z', c: true }, 'M12 9.5v4.2', { d: bola(12, 17, 1.1), p: true }] },
  cadeado: { t: [{ d: caixa(4.5, 10.5, 15, 10, 2.6), c: true }, 'M8 10.5V7.5a4 4 0 0 1 8 0v3'] },
  faceid: { t: ['M4 8.5V6.5A2.5 2.5 0 0 1 6.5 4h2', 'M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2', 'M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2', 'M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2', 'M9 9.5v1.5', 'M15 9.5v1.5', 'M12.3 9.5v3.8h-1', 'M9 16.2a4.2 4.2 0 0 0 6 0'] },
  sair: { t: ['M10 20H6.5A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4H10', 'M15.5 8l4 4-4 4', 'M19.5 12H9.5'] },
  lixo: { t: ['M4 6.5h16', 'M9 6.5V4.5h6v2', { d: 'M6 6.5l1 13a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5l1-13', c: true }, 'M10 11v5.5', 'M14 11v5.5'] },
  editar: { t: [{ d: 'M15.6 4.4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L8.5 19.5 4 20l.5-4.5z', c: true }, 'M13.5 6.5l4 4'] },
  compartilhar: { t: ['M12 3.5v11.5', 'M7.5 8 12 3.5 16.5 8', 'M8.5 10.5H7A2 2 0 0 0 5 12.5v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2h-1.5'] },
  atualizar: { t: ['M20 12a8 8 0 1 1-2.4-5.7', 'M20.2 4v4.3h-4.3'] },
  check: { t: ['M5 12.5l4.5 4.5L19 7.5'] },
  estrela: { t: [{ d: ESTRELA, c: true }] },
  sol: { t: [{ d: bola(12, 12, 4), c: true }, 'M12 2.5v2', 'M12 19.5v2', 'M5.3 5.3l1.4 1.4', 'M17.3 17.3l1.4 1.4', 'M2.5 12h2', 'M19.5 12h2', 'M5.3 18.7l1.4-1.4', 'M17.3 6.7l1.4-1.4'] },
  lua: { t: [{ d: 'M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z', c: true }] },
  celular: { t: [{ d: caixa(6.5, 2.5, 11, 19, 2.8), c: true }, 'M10.5 18.3h3'] },
  consultorio: { t: ['M6.5 3.5H5.5a1 1 0 0 0-1 1V9a4.8 4.8 0 0 0 9.6 0V4.5a1 1 0 0 0-1-1h-1', 'M9.3 13.8v1.4a5 5 0 0 0 10 0v-2', bola(19.3, 11.3, 2)] },
  loja: { t: [{ d: 'M3.5 9.5h17l-1.7 9.2a2 2 0 0 1-2 1.6H7.2a2 2 0 0 1-2-1.6z', c: true }, 'M8 9.5l3-6', 'M16 9.5l-3-6', 'M9.5 13.5v3', 'M14.5 13.5v3'] },
  carro: { t: ['M5.5 11l1.5-3.7A2 2 0 0 1 8.9 6h6.2a2 2 0 0 1 1.9 1.3l1.5 3.7', { d: caixa(3, 11, 18, 6.5, 2), c: true }, 'M6.5 17.5v2', 'M17.5 17.5v2', 'M6.5 14.2h1.5', 'M16 14.2h1.5'] },
  combustivel: { t: [{ d: 'M4.5 21V5.5a2 2 0 0 1 2-2h5.5a2 2 0 0 1 2 2V21', c: true }, 'M3 21h12.5', 'M4.5 10.5H14', 'M14 8.5h1.5a2 2 0 0 1 2 2v5.8a1.5 1.5 0 0 0 3 0V8.6L18 6'] },
  ajuda: { t: [{ d: bola(12, 12, 8.8), c: true }, 'M9.5 9.5a2.5 2.5 0 1 1 3.6 2.3c-.7.3-1.1.9-1.1 1.6v.3', { d: bola(12, 16.8, 1.05), p: true }] },
  documento: { t: [{ d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', c: true }, 'M14 3v5h5', 'M9 13h6', 'M9 17h4'] },
  link: { t: ['M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1', 'M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'] },
  setaCima: { t: ['M12 19.5v-15', 'M5.5 11 12 4.5 18.5 11'] },
  setaBaixo: { t: ['M12 4.5v15', 'M5.5 13 12 19.5 18.5 13'] },
  entrada: { t: ['M17.5 6.5l-11 11', 'M6.5 8.5v9h9'] },
  saida: { t: ['M6.5 17.5l11-11', 'M8.5 6.5h9v9'] },
  transferir: { t: ['M4 8h15', 'M15.5 4.5 19 8l-3.5 3.5', 'M20 16H5', 'M8.5 12.5 5 16l3.5 3.5'] },
  configuracoes: { t: [{ d: ENGRENAGEM, c: true }, bola(12, 12, 3)] },
  engrenagem: { t: [{ d: ENGRENAGEM, c: true }, bola(12, 12, 3)] },
  pessoa: { t: [{ d: bola(12, 8, 4), c: true }, 'M4.5 20.5a7.5 7.5 0 0 1 15 0'] },
  sino: { t: [{ d: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z', c: true }, 'M10 20.5a2 2 0 0 0 4 0'] },
  carrinho: { t: ['M3 4h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6', { d: bola(9.5, 19.5, 1.4), p: true }, { d: bola(17, 19.5, 1.4), p: true }] },
  comida: { t: ['M6 3v6.5a2 2 0 0 0 4 0V3', 'M8 3v18', { d: 'M17 21V3c-2.2 1-3.5 3.5-3.5 7v3H17', c: true }] },
  coracao: { t: [{ d: 'M12 20s-7.5-4.5-7.5-10A4.4 4.4 0 0 1 12 7.2 4.4 4.4 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z', c: true }] },
  sacola: { t: [{ d: 'M5 8h14l-1 12.2a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9z', c: true }, 'M9 10.5V7a3 3 0 0 1 6 0v3.5'] },
  dinheiro: { t: [{ d: caixa(2.5, 6, 19, 12, 2.6), c: true }, bola(12, 12, 2.6), { d: bola(6.2, 12, 0.9), p: true }, { d: bola(17.8, 12, 0.9), p: true }] },
  conta: CONTA,
  recibo: CONTA,
  pessoas: { t: [{ d: bola(9, 8, 3.5), c: true }, 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.6a3.5 3.5 0 0 1 0 6.8', 'M18 14a6.5 6.5 0 0 1 3.5 6'] },
  pontos: { t: [{ d: bola(5.5, 12, 1.7), p: true }, { d: bola(12, 12, 1.7), p: true }, { d: bola(18.5, 12, 1.7), p: true }] },
  presente: { t: [{ d: caixa(3.5, 8, 17, 4, 1.2), c: true }, 'M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12', 'M12 8v13', 'M12 8C10.5 4.5 7 4.2 7 6.5 7 8 12 8 12 8z', 'M12 8c1.5-3.5 5-3.8 5-1.5C17 8 12 8 12 8z'] },
  parar: { t: [{ d: caixa(6, 6, 12, 12, 2.6), p: true }] },
  faisca: { t: [{ d: 'M11 3.5l1.8 5.2L18 10.5l-5.2 1.8L11 17.5l-1.8-5.2L4 10.5l5.2-1.8z', c: true }, 'M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'] },
  local: { t: [{ d: 'M12 21s-7-6-7-11.3a7 7 0 0 1 14 0C19 15 12 21 12 21z', c: true }, bola(12, 9.6, 2.5)] },
  escudo: { t: [{ d: 'M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z', c: true }, 'M9 12l2.2 2.2L15.2 10'] },
  info: { t: [{ d: bola(12, 12, 8.8), c: true }, 'M12 11v5.5', { d: bola(12, 7.6, 1.05), p: true }] },
  ordenar: { t: ['M8 4v16', 'M4.5 7.5 8 4l3.5 3.5', 'M16 20V4', 'M12.5 16.5 16 20l3.5-3.5'] },
  arrastar: { t: ['M4 7h16', 'M4 12h16', 'M4 17h16'] },
};

/* ---------- O componente ---------- */

export type IconeProps = {
  nome: NomeIcone;
  tamanho?: number;
  cor?: string;
  cheio?: boolean;
  peso?: SymbolWeight; // só no iPhone ('regular', 'medium', 'semibold', 'bold')
  style?: StyleProp<ViewStyle>;
};

function IconeSvg({ nome, tamanho, cor, cheio }: { nome: NomeIcone; tamanho: number; cor: string; cheio?: boolean }) {
  const d = DESENHOS[nome] ?? DESENHOS.pontos;
  // no tamanho pequeno o traço fica um pouco mais grosso, para não sumir
  const larg = tamanho <= 16 ? 2.2 : tamanho <= 22 ? 2 : 1.8;
  return (
    // flexShrink 0: no navegador (prévia web) um <svg> numa linha apertada encolhe até sumir; no celular já é assim
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <G transform={d.espelho ? 'matrix(1 0 0 -1 0 24)' : undefined} fill="none" stroke={cor} strokeWidth={cheio ? larg + 0.2 : larg} strokeLinecap="round" strokeLinejoin="round">
        {d.t.map((t, i) => {
          const tr = typeof t === 'string' ? { d: t } : t;
          const encher = tr.p || (cheio && tr.c);
          return <Path key={i} d={tr.d} fill={encher ? cor : 'none'} />;
        })}
      </G>
    </Svg>
  );
}

export function Icone({ nome, tamanho = 22, cor, cheio, peso = 'medium', style }: IconeProps) {
  const c = useCores();
  const tinta = cor ?? c.texto;
  if (Platform.OS === 'ios') {
    const [normal, encher] = SF[nome] ?? SF.pontos;
    return (
      <SymbolView
        name={(cheio && encher) || normal}
        size={tamanho}
        tintColor={tinta}
        weight={peso}
        resizeMode="scaleAspectFit"
        style={[{ width: tamanho, height: tamanho }, style]}
        accessible={false}
        importantForAccessibility="no"
        fallback={<IconeSvg nome={nome} tamanho={tamanho} cor={tinta} cheio={cheio} />}
      />
    );
  }
  return (
    <IconeSvgComEstilo style={style}>
      <IconeSvg nome={nome} tamanho={tamanho} cor={tinta} cheio={cheio} />
    </IconeSvgComEstilo>
  );
}

// no Android, o estilo (margens, posição) vai numa View em volta do SVG
function IconeSvgComEstilo({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (!style) return <>{children}</>;
  return <View style={style} accessible={false} importantForAccessibility="no-hide-descendants">{children}</View>;
}

// O ícone de cada categoria do site (Categoria.ic) no conjunto do app
const POR_IC: Record<string, NomeIcone> = {
  cart: 'carrinho', home: 'casa', car: 'carro', food: 'comida', heart: 'coracao', star: 'estrela', bag: 'sacola',
  more: 'pontos', money: 'dinheiro', bill: 'conta', users: 'pessoas', gear: 'engrenagem', receipt: 'recibo', cal: 'calendario',
  gift: 'presente', fuel: 'combustivel', card: 'cartao', bank: 'banco', phone: 'celular', doc: 'documento',
};
export const iconeDaCategoria = (ic?: string | null): NomeIcone => (ic && POR_IC[ic]) || 'pontos';
