// Peças das folhas da Nossa casa: a fileira de pessoas (quem pagou, entre quem dividir), a grade de categorias e os
// dias (no lugar do teclado do valor, como no Anotar).
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { dataCompleta, diaDaSemanaCurto } from '@/components/atividades/acoes';
import { AvatarMembro } from '@/components/casa/pessoas';
import { nomeDe } from '@/components/casa/regras';
import { Icone, IconeCategoria, Tocavel } from '@/components/ui';
import { Fontes, Raio, useCores } from '@/constants/theme';
import { hojeIso, mesNome, somarDias } from '@/lib/formato';
import type { Categoria, DadosCasa } from '@/lib/motor';

export const MARGEM_FOLHA = 20;

/* ---------- As pessoas ---------- */

// Uma fileira de pessoas com o rótulo à esquerda. radio: escolhe uma (quem pagou); senão marca várias (dividir)
export function FileiraPessoas({ C, cores, rotulo, escolhidos, aoTocar, radio }: {
  C: DadosCasa; cores: Record<string, string>; rotulo: string; escolhidos: string[]; aoTocar: (id: string) => void; radio?: boolean;
}) {
  const c = useCores();
  return (
    <View style={estilos.fileira}>
      <Text maxFontSizeMultiplier={1.3} style={[estilos.fileiraRotulo, { color: c.apoio }]}>{rotulo}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={estilos.fileiraDentro}
        accessibilityRole={radio ? 'radiogroup' : undefined} accessibilityLabel={rotulo}>
        {C.membros.map((m) => {
          const ativo = escolhidos.includes(m.id);
          const cor = cores[m.id] ?? c.azul;
          return (
            <Tocavel
              key={m.id}
              onPress={() => aoTocar(m.id)}
              escala={0.95}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole={radio ? 'radio' : 'checkbox'}
              accessibilityState={{ checked: ativo }}
              accessibilityLabel={nomeDe(C, m.id)}
              style={[estilos.pessoa, ativo ? { backgroundColor: c.escuro ? c.cartao3 : c.cartao, borderColor: cor } : { backgroundColor: 'transparent', borderColor: c.linhaForte }]}>
              <View>
                <AvatarMembro m={m} cor={cor} tamanho={26} />
                {!radio && ativo ? (
                  <View style={[estilos.visto, { backgroundColor: cor, borderColor: c.fundoAlto }]}>
                    <Icone nome="check" tamanho={8} cor="#FFFFFF" peso="bold" />
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[estilos.pessoaNome, { color: ativo ? c.texto : c.apoio }]}>{nomeDe(C, m.id)}</Text>
            </Tocavel>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ---------- A grade de categorias ---------- */

export function GradeCategorias({ lista, escolhida, aoEscolher }: { lista: Categoria[]; escolhida: string | null; aoEscolher: (id: string) => void }) {
  const c = useCores();
  return (
    <ScrollView contentContainerStyle={estilos.grade} showsVerticalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Categoria">
      {lista.map((k) => {
        const ativa = k.id === escolhida;
        return (
          <Tocavel key={k.id} onPress={() => aoEscolher(k.id)} escala={0.94} accessibilityRole="radio" accessibilityLabel={k.nome} accessibilityState={{ checked: ativa }} style={estilos.gradeItem}>
            <View style={[estilos.gradeAnel, { borderColor: ativa ? k.cor : 'transparent' }]}>
              <IconeCategoria cat={k} tamanho={46} />
            </View>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.25} style={[estilos.gradeNome, { color: ativa ? c.texto : c.apoio }, ativa && { fontFamily: Fontes.textoForte }]}>{k.nome}</Text>
          </Tocavel>
        );
      })}
    </ScrollView>
  );
}

/* ---------- Os dias ---------- */

const DIAS = 90; // até quanto tempo atrás

export function EscolherDia({ data, aoEscolher }: { data: string; aoEscolher: (d: string) => void }) {
  const c = useCores();
  const hoje = hojeIso();
  const dias = useMemo(() => Array.from({ length: DIAS }, (_, i) => somarDias(hoje, -i)), [hoje]);
  const L = 60, E = 8;
  const inicio = Math.max(0, dias.indexOf(data) - 2) * (L + E);
  return (
    <View style={estilos.dias}>
      <Text maxFontSizeMultiplier={1.3} style={[estilos.diasTitulo, { color: c.apoio }]}>{dataCompleta(data)}</Text>
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentOffset={{ x: inicio, y: 0 }}
        contentContainerStyle={{ gap: E, paddingHorizontal: MARGEM_FOLHA }} accessibilityRole="radiogroup" accessibilityLabel="Dia">
        {dias.map((d, i) => {
          const ativo = d === data;
          return (
            <Tocavel key={d} onPress={() => aoEscolher(d)} escala={0.94} accessibilityRole="radio" accessibilityLabel={dataCompleta(d)} accessibilityState={{ checked: ativo }}
              style={[estilos.dia, { width: L, backgroundColor: ativo ? c.azul : c.escuro ? c.cartao : c.cartao2, borderColor: ativo ? c.azul : c.linha }]}>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaSemana, { color: ativo ? 'rgba(255,255,255,0.8)' : c.apoio }]}>{i === 0 ? 'hoje' : i === 1 ? 'ontem' : diaDaSemanaCurto(d)}</Text>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaNumero, { color: ativo ? '#FFFFFF' : c.texto }]}>{Number(d.slice(8, 10))}</Text>
              <Text maxFontSizeMultiplier={1.2} style={[estilos.diaMes, { color: ativo ? 'rgba(255,255,255,0.8)' : d.endsWith('-01') ? c.azulTinta : c.fraco }]}>{mesNome(d, true)}</Text>
            </Tocavel>
          );
        })}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  fileira: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: MARGEM_FOLHA },
  fileiraRotulo: { width: 58, fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 17 },
  fileiraDentro: { gap: 8, paddingRight: MARGEM_FOLHA },
  pessoa: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingLeft: 6, paddingRight: 14, borderRadius: Raio.pilula, borderWidth: 1.5 },
  pessoaNome: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 18, maxWidth: 110 },
  visto: { position: 'absolute', right: -4, bottom: -3, width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, paddingTop: 4 },
  gradeItem: { width: '25%', alignItems: 'center', gap: 5 },
  gradeAnel: { padding: 3, borderRadius: 30, borderWidth: 2 },
  gradeNome: { fontFamily: Fontes.texto, fontSize: 12.5, lineHeight: 16, paddingHorizontal: 2 },
  dias: { flex: 1, justifyContent: 'center', gap: 14, marginHorizontal: -14 },
  diasTitulo: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 19, paddingHorizontal: MARGEM_FOLHA + 2 },
  dia: { height: 84, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  diaSemana: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16 },
  diaNumero: { fontFamily: Fontes.tituloForte, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  diaMes: { fontFamily: Fontes.texto, fontSize: 12, lineHeight: 16 },
});
