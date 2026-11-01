// As áreas do Avina (Consultório, Pessoal completo, Loja, Contas fixas, Casa, Transporte), conforme o que a pessoa usa
// (Estado.modos). A mesma grade aparece na folha do botão "Avina" da barra e no cartão "Áreas do Avina".
// Contas fixas, Nossa casa e Transporte abrem a tela nativa quando o site atende (Estado.recursos); com uma cópia
// antiga do site, abrem no site, como antes (Contas fixas nem aparece: lá elas ficam dentro do Pessoal).
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { comAlfa, Icone, Texto, Tocavel, type NomeIcone } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores, type Paleta } from '@/constants/theme';
import { abrirNoSite, temRecurso, type Estado, type PedidosSite } from '@/lib/motor';

export type Area = {
  id: string; nome: string; descricao: string; icone: NomeIcone; cor: (c: Paleta) => string;
  abrir: PedidosSite['abrir']['dados']; // no site
  rota?: Href; // a tela nativa, quando há
};

export function areasDe(e: Estado | null): Area[] {
  const modos = e?.modos ?? [];
  const lista: Area[] = [];
  if (modos.includes('consultorio')) lista.push({ id: 'consultorio', nome: 'Consultório', descricao: 'Agenda, pacientes e cobranças', icone: 'consultorio', cor: (c) => c.azul, abrir: { area: 'consultorio' } });
  if (modos.includes('pessoal')) lista.push({ id: 'pessoal', nome: 'Pessoal completo', descricao: 'Gastos, contas e caixinhas', icone: 'carteira', cor: (c) => c.menta, abrir: { area: 'pessoal' } });
  if (modos.includes('loja')) lista.push({ id: 'loja', nome: 'Loja', descricao: 'Caixa, gastos e o que falta', icone: 'loja', cor: (c) => c.loja, abrir: { area: 'loja' } });
  if (modos.includes('pessoal')) {
    if (temRecurso(e, 'contas2')) lista.push({ id: 'contas', nome: 'Contas fixas', descricao: 'O que vence no mês e o que já foi pago', icone: 'calendario', cor: (c) => c.ambar, abrir: { area: 'pessoal', tela: 'contas' }, rota: '/contas' });
    lista.push({ id: 'casa', nome: 'Nossa casa', descricao: 'Dinheiro a dois ou em família', icone: 'casa', cor: (c) => c.roxo, abrir: { area: 'casa' }, rota: temRecurso(e, 'casa') ? '/casa' : undefined });
    lista.push({ id: 'transporte', nome: 'Transporte', descricao: 'Combustível e gastos do carro', icone: 'carro', cor: (c) => c.ciano, abrir: { area: 'transporte' }, rota: temRecurso(e, 'transporte') ? '/transporte' : undefined });
  }
  return lista;
}

// Abre a tela nativa da área (quando há) ou a área no site
export const abrirArea = (a: Area) => (a.rota ? router.push(a.rota) : abrirNoSite(a.abrir));

// A grade: duas colunas; com um número ímpar, a última ocupa a linha toda.
// fundo: a cor dos quadradinhos (na folha, os cartões; dentro de um cartão, o tom de dentro)
export function GradeAreas({ areas, fundo, antesDeAbrir }: { areas: Area[]; fundo?: string; antesDeAbrir?: () => void }) {
  const c = useCores();
  return (
    <View style={estilos.grade}>
      {areas.map((a) => {
        const cor = a.cor(c);
        return (
          <Tocavel
            key={a.id}
            onPress={() => { antesDeAbrir?.(); abrirArea(a); }}
            accessibilityLabel={`${a.nome}. ${a.descricao}`}
            accessibilityHint="Abre esta área do Avina"
            style={[estilos.area, { backgroundColor: fundo ?? c.cartao, borderColor: c.linha }]}>
            <View style={[estilos.icone, { backgroundColor: comAlfa(cor, c.escuro ? 0.18 : 0.12) }]}>
              <Icone nome={a.icone} tamanho={20} cor={cor} peso="semibold" />
            </View>
            <View style={{ gap: 2 }}>
              <Texto numberOfLines={2} style={estilos.nome}>{a.nome}</Texto>
              <Texto v="apoio" numberOfLines={2} style={estilos.desc}>{a.descricao}</Texto>
            </View>
          </Tocavel>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.dois + 2 },
  area: { flexGrow: 1, flexBasis: '45%', minHeight: 116, padding: Espaco.quatro, gap: Espaco.tres, borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1, justifyContent: 'space-between' },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nome: { fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  desc: { fontSize: 12.5, lineHeight: 17 },
});
