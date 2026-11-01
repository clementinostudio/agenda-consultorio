// O texto do Avina: Sora nos títulos e números, Manrope no resto.
// Números grandes ficam com no máximo 1,3× do tamanho quando a pessoa aumenta a letra do aparelho,
// para não estourar os cartões; o resto acompanha o aparelho normalmente.
import { Text, type TextProps, type TextStyle } from 'react-native';

import { Fontes, useCores } from '@/constants/theme';

export type VarianteTexto = 'display' | 'titulo' | 'subtitulo' | 'texto' | 'forte' | 'apoio' | 'rotulo' | 'numero';

export const ESTILO_TEXTO: Record<VarianteTexto, TextStyle> = {
  display: { fontFamily: Fontes.tituloForte, fontSize: 40, lineHeight: 46, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  titulo: { fontFamily: Fontes.tituloForte, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  subtitulo: { fontFamily: Fontes.titulo, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  texto: { fontFamily: Fontes.texto, fontSize: 15, lineHeight: 21 },
  forte: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  apoio: { fontFamily: Fontes.texto, fontSize: 13, lineHeight: 18 },
  rotulo: { fontFamily: Fontes.textoPesado, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  numero: { fontFamily: Fontes.tituloForte, fontSize: 34, lineHeight: 40, letterSpacing: -0.9, fontVariant: ['tabular-nums'] },
};

// variantes que levam o limite de tamanho (números e títulos grandes)
const GRANDES: Partial<Record<VarianteTexto, number>> = { display: 1.3, numero: 1.3, titulo: 1.4 };
// variantes que já nascem cinza
const CINZA: Partial<Record<VarianteTexto, true>> = { apoio: true, rotulo: true };

export type TextoProps = TextProps & { v?: VarianteTexto; cor?: string };

export function Texto({ v = 'texto', cor, style, maxFontSizeMultiplier, ...p }: TextoProps) {
  const c = useCores();
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? GRANDES[v]}
      {...p}
      style={[ESTILO_TEXTO[v], { color: cor ?? (CINZA[v] ? c.apoio : c.texto) }, style]}
    />
  );
}
