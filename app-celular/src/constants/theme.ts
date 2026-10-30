// As cores e as fontes do Avina (as mesmas do site: src/styles.css). Escuro primeiro, claro quando o aparelho pede.
import { useColorScheme } from 'react-native';

export const Cores = {
  dark: {
    fundo: '#0A0C11',
    cartao: '#15171D',
    cartao2: '#1E2129',
    cartao3: '#292D36',
    linha: '#2A2E37',
    texto: '#F2F4F8',
    apoio: '#8A91A0',
    fraco: '#5A606D',
    azul: '#2B46FF',
    azulTinta: '#8FA4FF',
    menta: '#46E0A4',
    mentaFundo: '#123327',
    loja: '#FFA25E',
    ambar: '#FFB648',
    rosa: '#FF7272',
    rosaFundo: '#3A1719',
    tintaBotao: '#06150F',
  },
  light: {
    fundo: '#F1F2F6',
    cartao: '#FFFFFF',
    cartao2: '#F1F2F6',
    cartao3: '#E2E4EC',
    linha: '#E4E6ED',
    texto: '#12141B',
    apoio: '#676D7D',
    fraco: '#A3A8B4',
    azul: '#2B46FF',
    azulTinta: '#2338C9',
    menta: '#0E9466',
    mentaFundo: '#DDF5EA',
    loja: '#B4530F',
    ambar: '#9A6200',
    rosa: '#D63A47',
    rosaFundo: '#FFE5E7',
    tintaBotao: '#FFFFFF',
  },
} as const;

export type Paleta = { [K in keyof typeof Cores.dark]: string };

export function useCores(): Paleta & { escuro: boolean } {
  const escuro = useColorScheme() !== 'light';
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
