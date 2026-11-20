// Ícones do app. Os de uso geral vêm do Phosphor (phosphoricons.com), modernos e com vários pesos: "regular" no geral,
// "bold" nos sinais pequenos (+, ✓, setas) e "fill" na aba escolhida da barra de baixo. Os nomes (I.home, I.cal...)
// continuam os mesmos de antes, então quem usa não precisa mudar nada. Svg serve para os poucos desenhados à mão.
import React from "react";
import { ArrowCounterClockwise as PhArrowCounterClockwise, ArrowDown as PhArrowDown, ArrowLeft as PhArrowLeft, ArrowUp as PhArrowUp, ArrowsClockwise as PhArrowsClockwise, Barcode as PhBarcode, Bell as PhBell, CalendarBlank as PhCalendarBlank, CalendarCheck as PhCalendarCheck, Camera as PhCamera, Car as PhCar, CaretDown as PhCaretDown, CaretLeft as PhCaretLeft, CaretRight as PhCaretRight, ChartBar as PhChartBar, ChatCircle as PhChatCircle, Check as PhCheck, Clock as PhClock, Cloud as PhCloud, CloudLightning as PhCloudLightning, CloudRain as PhCloudRain, Copy as PhCopy, DeviceMobile as PhDeviceMobile, Door as PhDoor, DotsThree as PhDotsThree, DownloadSimple as PhDownloadSimple, EnvelopeSimple as PhEnvelopeSimple, Export as PhExport, Eye as PhEye, EyeSlash as PhEyeSlash, FileText as PhFileText, Flag as PhFlag, ForkKnife as PhForkKnife, Gauge as PhGauge, GearSix as PhGearSix, Heart as PhHeart, House as PhHouse, Invoice as PhInvoice, Key as PhKey, LockSimple as PhLockSimple, MagnifyingGlass as PhMagnifyingGlass, Microphone as PhMicrophone, Minus as PhMinus, Money as PhMoney, Moon as PhMoon, PaperPlaneTilt as PhPaperPlaneTilt, PencilSimple as PhPencilSimple, PiggyBank as PhPiggyBank, Plus as PhPlus, Receipt as PhReceipt, ShoppingBag as PhShoppingBag, ShoppingCart as PhShoppingCart, SignOut as PhSignOut, SpeakerHigh as PhSpeakerHigh, SquaresFour as PhSquaresFour, Star as PhStar, Sun as PhSun, Target as PhTarget, Trash as PhTrash, UploadSimple as PhUploadSimple, User as PhUser, UsersThree as PhUsersThree, VideoCamera as PhVideoCamera, Wallet as PhWallet, WarningCircle as PhWarningCircle, X as PhX } from "@phosphor-icons/react";

export const Svg = ({ children, sw = 1.8 }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
// Logo da Avina: um A de fita só (sobe, curva no topo, desce a haste; a travessa é um laço pela esquerda)
export const Marca = () => (
  <svg viewBox="97 105 300 300" aria-hidden="true">
    <path d="M338 380V176Q338 128 300 128Q274 128 260 158L196 300Q180 336 152 334Q128 332 134 302Q146 258 214 248Q296 238 338 300" fill="none" stroke="#1F3BEF" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const I = {
  home: () => <Svg><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z"/></Svg>,
  cal: () => <Svg><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></Svg>,
  grid: () => <Svg><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></Svg>,
  users: () => <Svg><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.8 2.4 3 5.2"/></Svg>,
  wallet: () => <Svg><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16.5 15h1"/><path d="M6 6l9-3 1.5 3"/></Svg>,
  plus: () => <Svg sw={2.2}><path d="M12 5v14M5 12h14"/></Svg>,
  x: () => <Svg sw={2.2}><path d="M6 6l12 12M18 6L6 18"/></Svg>,
  trash: () => <Svg><path d="M4 7h16M9.5 7V4.5h5V7"/><path d="M6.5 7l.9 11.6A2 2 0 0 0 9.4 20.5h5.2a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10.5 11v5.5M13.5 11v5.5"/></Svg>,
  check: () => <Svg sw={2.6}><path d="M5 12.5l4.5 4.5L19 7.5"/></Svg>,
  chev: () => <Svg sw={2.2}><path d="M9 6l6 6-6 6"/></Svg>,
  chevL: () => <Svg sw={2.2}><path d="M15 6l-6 6 6 6"/></Svg>,
  chevD: () => <Svg sw={2.2}><path d="M6 9l6 6 6-6"/></Svg>,
  gear: () => <Svg><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Svg>,
  sun: () => <Svg><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></Svg>,
  moon: () => <Svg><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></Svg>,
  eye: () => <Svg><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></Svg>,
  eyeOff: () => <Svg><path d="M4 4l16 16M10 6a9.6 9.6 0 0 1 2-.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 7.3C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/></Svg>,
  bell: () => <Svg><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></Svg>,
  user: () => <Svg><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/></Svg>,
  mail: () => <Svg><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></Svg>,
  lock: () => <Svg><rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 15v2"/></Svg>,
  phone: () => <Svg><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/></Svg>,
  money: () => <Svg><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></Svg>,
  door: () => <Svg><path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18"/><path d="M15 12v.5"/></Svg>,
  repeat: () => <Svg><path d="M17 2.5l3 3-3 3"/><path d="M4 11V9.5a4 4 0 0 1 4-4h12"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 13v1.5a4 4 0 0 1-4 4H4"/></Svg>,
  clock: () => <Svg><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></Svg>,
  alert: () => <Svg sw={2.2}><path d="M12 7v6M12 16.5v.5"/></Svg>,
  copy: () => <Svg><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></Svg>,
  send: () => <Svg><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></Svg>,
  down: () => <Svg sw={2.2}><path d="M12 5v13M6 12l6 6 6-6"/></Svg>,
  up: () => <Svg sw={2.2}><path d="M12 19V6M6 12l6-6 6 6"/></Svg>,
  receipt: () => <Svg><path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></Svg>,
  undo: () => <Svg><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></Svg>,
  key: () => <Svg><circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8L20 3M17 6l3 3"/></Svg>,
  search: () => <Svg><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></Svg>,
  out: () => <Svg><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10"/></Svg>,
  chat: () => <Svg sw={2.2}><path d="M5 18.5V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8z"/></Svg>,
  pencil: () => <Svg sw={2}><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></Svg>,
  chart: () => <Svg><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></Svg>,
  // Versões cheias dos ícones da barra de baixo (aparecem na aba que está aberta, como no app do Xbox)
  homeOn: () => <Svg><path fill="currentColor" stroke="none" d="M12 3.2c.4 0 .8.1 1.1.4l7 5.7c.6.5.9 1.2.9 1.9v7.8A2 2 0 0 1 19 21h-4.2v-5.5a1.3 1.3 0 0 0-1.3-1.3h-3a1.3 1.3 0 0 0-1.3 1.3V21H5a2 2 0 0 1-2-2v-7.8c0-.7.3-1.4.9-1.9l7-5.7c.3-.3.7-.4 1.1-.4z"/></Svg>,
  calOn: () => <Svg><path fill="currentColor" stroke="none" fillRule="evenodd" d="M6.5 5h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM7 11.5v2h2v-2zM11 11.5v2h2v-2zM15 11.5v2h2v-2zM7 15.5v2h2v-2zM11 15.5v2h2v-2z"/><path d="M8 3v3M16 3v3"/></Svg>,
  usersOn: () => <Svg><circle cx="9" cy="8" r="3.5" fill="currentColor"/><path fill="currentColor" d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5z"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.8 2.4 3 5.2"/></Svg>,
  walletOn: () => <Svg><path d="M6 6l9-3 1.5 3"/><path fill="currentColor" stroke="none" fillRule="evenodd" d="M6 5.2h12a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8.2a3 3 0 0 1 3-3zM15.5 13.6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z"/></Svg>,
  chartOn: () => <Svg><rect x="2.8" y="10" width="3.4" height="10.5" rx="1.2" fill="currentColor" stroke="none"/><rect x="8.3" y="3.5" width="3.4" height="17" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.8" y="12.5" width="3.4" height="8" rx="1.2" fill="currentColor" stroke="none"/><rect x="19.3" y="7" width="2.4" height="13.5" rx="1.1" fill="currentColor" stroke="none"/></Svg>,
  billOn: () => <Svg><path fill="currentColor" stroke="none" fillRule="evenodd" d="M7 3h10a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM8 7.2v1.6h8V7.2zM8 11.2v1.6h8v-1.6zM8 15.2v1.6h4v-1.6z"/></Svg>,
  bill: () => <Svg><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></Svg>,
  cart: () => <Svg><path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></Svg>,
  car: () => <Svg><path d="M4 16v-4l2-5h12l2 5v4M4 16h16M4 16v2.5M20 16v2.5"/><circle cx="7.5" cy="13.5" r=".8"/><circle cx="16.5" cy="13.5" r=".8"/></Svg>,
  carOn: () => <Svg><path fill="currentColor" stroke="none" fillRule="evenodd" d="M6.9 5.5h10.2a1.5 1.5 0 0 1 1.4.94l1.9 4.76c.4.36.6.86.6 1.4V17a1 1 0 0 1-1 1h-.5v1.2a1 1 0 0 1-2 0V18H6.5v1.2a1 1 0 0 1-2 0V18H4a1 1 0 0 1-1-1v-4.4c0-.54.2-1.04.6-1.4L5.5 6.44a1.5 1.5 0 0 1 1.4-.94zM6.2 10.5h11.6l-1.3-3.2H7.5zM7.5 15.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zm9 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z"/></Svg>,
  food: () => <Svg><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1-3.5 3.5-3.5 7h3.5"/></Svg>,
  heart: () => <Svg><path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/></Svg>,
  star: () => <Svg><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/></Svg>,
  bag: () => <Svg><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></Svg>,
  more: () => <Svg sw={2.6}><path d="M6 12h.01M12 12h.01M18 12h.01"/></Svg>,
  mic: () => <Svg sw={2}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></Svg>,
  cloud: () => <Svg><path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 18.5z"/></Svg>,
  rain: () => <Svg><path d="M7 15h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/></Svg>,
  storm: () => <Svg><path d="M7 15h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 15z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/></Svg>,
  target: () => <Svg><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" /></Svg>,
  share: () => <Svg><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/></Svg>,
  piggy: () => <Svg><path d="M19 11.5c0-3.6-3.1-6-7-6-1.7 0-3.3.5-4.5 1.3L5 5.5V9C4 10 3.5 11 3.5 12.5 3.5 15 5 17 7.5 18v2h3v-1.5h3V20h3v-2.2c1.4-.8 2.5-2.1 2.5-3.8h1.5v-2.5z"/><circle cx="15" cy="10.5" r=".6"/></Svg>,
  flag: () => <Svg><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></Svg>,
  logo: () => <Svg sw={2.2}><rect x="4" y="5" width="16" height="15" rx="3.5"/><path d="M4 10h16M9 15l2 2 4-4"/></Svg>,
  sound: () => <Svg><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></Svg>,
  camera: () => <Svg><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.5"/></Svg>,
  scan: () => <Svg><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 8v8M10 8v8M12.5 8v8M15 8v8M16.5 8v8"/></Svg>,
  upload: () => <Svg><path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4.5 14v4.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V14"/></Svg>,
  gauge: () => <Svg><path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 13l3.5-4"/><circle cx="12" cy="13" r="1.2"/></Svg>,
};

/* Ícones modernos (Phosphor) no lugar dos desenhados à mão: mesmos nomes (I.home, I.cal...), então nada mais muda.
   ph(Componente, peso): "regular" no geral, "bold" nos sinais pequenos (+, ✓, setas) e "fill" nas abas escolhidas. */
const ph = (C, weight = "regular") => props => <C weight={weight} aria-hidden="true" {...props} />;
Object.assign(I, {
  home: ph(PhHouse), homeOn: ph(PhHouse, "fill"), cal: ph(PhCalendarBlank), calOn: ph(PhCalendarBlank, "fill"), grid: ph(PhSquaresFour),
  users: ph(PhUsersThree), usersOn: ph(PhUsersThree, "fill"), wallet: ph(PhWallet), walletOn: ph(PhWallet, "fill"),
  plus: ph(PhPlus, "bold"), minus: ph(PhMinus, "bold"), x: ph(PhX, "bold"), trash: ph(PhTrash), check: ph(PhCheck, "bold"),
  chev: ph(PhCaretRight, "bold"), chevL: ph(PhCaretLeft, "bold"), chevD: ph(PhCaretDown, "bold"), setaL: ph(PhArrowLeft, "bold"),
  gear: ph(PhGearSix), sun: ph(PhSun), moon: ph(PhMoon), eye: ph(PhEye), eyeOff: ph(PhEyeSlash), bell: ph(PhBell), user: ph(PhUser),
  mail: ph(PhEnvelopeSimple), lock: ph(PhLockSimple), phone: ph(PhDeviceMobile), money: ph(PhMoney), door: ph(PhDoor),
  repeat: ph(PhArrowsClockwise), clock: ph(PhClock), alert: ph(PhWarningCircle), copy: ph(PhCopy), send: ph(PhPaperPlaneTilt),
  down: ph(PhArrowDown, "bold"), up: ph(PhArrowUp, "bold"), receipt: ph(PhReceipt), undo: ph(PhArrowCounterClockwise), key: ph(PhKey),
  search: ph(PhMagnifyingGlass), out: ph(PhSignOut), chat: ph(PhChatCircle), pencil: ph(PhPencilSimple),
  chart: ph(PhChartBar), chartOn: ph(PhChartBar, "fill"), bill: ph(PhInvoice), billOn: ph(PhInvoice, "fill"),
  cart: ph(PhShoppingCart), car: ph(PhCar), carOn: ph(PhCar, "fill"), food: ph(PhForkKnife), heart: ph(PhHeart), star: ph(PhStar),
  bag: ph(PhShoppingBag), more: ph(PhDotsThree, "bold"), mic: ph(PhMicrophone), cloud: ph(PhCloud), rain: ph(PhCloudRain), storm: ph(PhCloudLightning),
  target: ph(PhTarget), share: ph(PhExport), piggy: ph(PhPiggyBank), flag: ph(PhFlag), sound: ph(PhSpeakerHigh), camera: ph(PhCamera),
  scan: ph(PhBarcode), upload: ph(PhUploadSimple), gauge: ph(PhGauge), video: ph(PhVideoCamera), doc: ph(PhFileText),
  download: ph(PhDownloadSimple), calSync: ph(PhCalendarCheck),
});
I.menu = () => <Svg sw={2}><path d="M4 7h16M4 12h16M4 17h11"/></Svg>;
