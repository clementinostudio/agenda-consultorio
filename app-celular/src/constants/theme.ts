// As cores e as fontes do Avina no celular.
// - Escuro: preto fosco e cinzas grafite (nada de azul-marinho), com o azul e a menta do Avina como destaque.
// - Claro: cinza-gelo de fundo e cartões brancos com sombra bem leve.
// - O tema segue o que a pessoa escolheu no Avina (Perfil → Aparência: sistema, claro ou escuro), que chega pela
//   ponte (lib/motor.ts); em "sistema", segue o aparelho.
import { useColorScheme } from 'react-native';

import { useTemaEscolhido } from '@/lib/motor';

export const Cores = {
  dark: {
    fundo: '#0A0A0B',
    fundoAlto: '#101012',
    cartao: '#161618',
    cartao2: '#1E1E21',
    cartao3: '#29292D',
    vidro: 'rgba(30,30,33,0.72)',
    linha: 'rgba(255,255,255,0.07)',
    linhaForte: 'rgba(255,255,255,0.12)',
    brilho: 'rgba(255,255,255,0.06)', // reflexo de cima dos cartões
    texto: '#F4F4F5',
    apoio: '#9B9BA3',
    fraco: '#6C6C75', // terceiro nível (datas, rodapés): ainda legível no grafite
    azul: '#4A62FF',
    azulTinta: '#8FA4FF',
    azulFundo: '#161B3A',
    roxo: '#8B6CFF',
    ciano: '#3CC4E6',
    menta: '#46E0A4',
    mentaFundo: '#0F2A20',
    positivo: '#46E0A4',
    negativo: '#FF6B6B',
    loja: '#FFA25E',
    ambar: '#FFB648',
    rosa: '#FF7272',
    rosaFundo: '#341417',
    tintaBotao: '#06150F',
    sombra: '#000000',
  },
  light: {
    fundo: '#F2F2F5',
    fundoAlto: '#FFFFFF',
    cartao: '#FFFFFF',
    cartao2: '#F4F4F7',
    cartao3: '#E6E6EC',
    vidro: 'rgba(255,255,255,0.78)',
    linha: 'rgba(17,17,20,0.07)',
    linhaForte: 'rgba(17,17,20,0.12)',
    brilho: 'rgba(255,255,255,0.9)',
    texto: '#111114',
    apoio: '#6B6B74',
    fraco: '#86868F', // terceiro nível: o mais claro que ainda dá para ler no branco
    azul: '#2B46FF',
    azulTinta: '#2338C9',
    azulFundo: '#E6EAFF',
    roxo: '#6B46D7',
    ciano: '#0F7F97',
    menta: '#0B8459',
    mentaFundo: '#DDF5EA',
    positivo: '#0B8459', // os tons do claro são mais fechados que os do escuro: dá para ler no fundo branco
    negativo: '#CC3441',
    loja: '#B4530F',
    ambar: '#9A6200',
    rosa: '#CC3441',
    rosaFundo: '#FFE5E7',
    tintaBotao: '#FFFFFF',
    sombra: '#1A1A2E',
  },
} as const;

export type Paleta = { [K in keyof typeof Cores.dark]: string };

// O tema de agora: o escolhido no Avina, ou o do aparelho quando a escolha é "sistema"
export function useEscuro(): boolean {
  const sistema = useColorScheme();
  const escolhido = useTemaEscolhido();
  return escolhido === 'auto' ? sistema !== 'light' : escolhido === 'dark';
}

export function useCores(): Paleta & { escuro: boolean } {
  const escuro = useEscuro();
  return { ...(escuro ? Cores.dark : Cores.light), escuro };
}

// Sora nos títulos e números, Manrope no texto (carregadas em src/app/_layout.tsx)
export const Fontes = {
  titulo: 'Sora_600SemiBold',
  tituloForte: 'Sora_700Bold',
  numero: 'Sora_600SemiBold',
  texto: 'Manrope_500Medium',
  textoForte: 'Manrope_700Bold',
  textoPesado: 'Manrope_800ExtraBold',
} as const;

export const Raio = { cartao: 28, medio: 20, pequeno: 14, pilula: 999 } as const;
export const Espaco = { um: 4, dois: 8, tres: 12, quatro: 16, cinco: 20, seis: 24, oito: 32 } as const;
