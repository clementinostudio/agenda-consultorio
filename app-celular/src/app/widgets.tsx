// Cartões do Início (folha que sobe de baixo): ligar e desligar cada cartão e arrastar a alça para mudar a ordem.
// A escolha fica guardada no aparelho (lib/widgets.ts). Um cartão que depende de algo desligado (o Pessoal, o
// Consultório, um teto, uma caixinha) aparece esmaecido com o motivo; ele entra no Início quando isso existir.
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Interruptor } from '@/components/perfil/interruptor';
import { ListaOrdenavel } from '@/components/perfil/ordenar';
import { Botao, Cartao, comAlfa, Icone, Texto, vibrar, type NomeIcone } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { useEstado, type Estado } from '@/lib/motor';
import { mudarEscolhaWidgets, restaurarWidgets, useEscolhaWidgets, WIDGETS, type IdWidget, type InfoWidget } from '@/lib/widgets';

const ICONES: Record<IdWidget, NomeIcone> = {
  bancos: 'banco', gastosMes: 'investimento', categorias: 'categoria', recentes: 'atividades', fluxo: 'transferir', contas: 'calendario',
  tetos: 'escudo', caixinhas: 'dinheiro', consultorio: 'consultorio', combustivel: 'combustivel', areas: 'areas',
};

// Por que o cartão não aparece agora (null: aparece)
function motivo(w: InfoWidget, e: Estado | null): string | null {
  if (!e || !w.precisa || w.precisa(e)) return null;
  if (w.id === 'bancos') return 'A conexão com bancos não está disponível na sua conta';
  if (w.id === 'consultorio') return 'Aparece com a área Consultório ligada';
  if (!e.pessoal) return 'Aparece com a área Pessoal ligada';
  if (w.id === 'tetos') return 'Aparece quando houver um teto por categoria';
  if (w.id === 'caixinhas') return 'Aparece quando você criar uma caixinha';
  return 'Aparece quando houver dados para mostrar';
}

export default function Widgets() {
  const c = useCores();
  const ins = useSafeAreaInsets();
  const e = useEstado();
  const escolha = useEscolhaWidgets();
  const [arrastando, setArrastando] = useState(false);
  const nomes = Object.fromEntries(WIDGETS.map((w) => [w.id, w.nome]));
  const ligados = escolha.ordem.filter((id) => !escolha.escondidos.includes(id)).length;

  const trocar = (id: IdWidget, ligar: boolean) => {
    vibrar('toque');
    const escondidos = ligar ? escolha.escondidos.filter((x) => x !== id) : [...escolha.escondidos, id];
    mudarEscolhaWidgets({ ...escolha, escondidos });
  };

  return (
    <View style={[estilos.tela, { backgroundColor: c.fundoAlto }]}>
      <StatusBar style={c.escuro ? 'light' : 'dark'} />
      <View style={estilos.topo}>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto v="subtitulo" accessibilityRole="header" style={estilos.titulo}>Cartões do Início</Texto>
          <Texto v="apoio">{ligados === 1 ? '1 cartão ligado' : `${ligados} cartões ligados`}</Texto>
        </View>
        <Botao titulo="Pronto" variante="secundario" tamanho="pequeno" onPress={() => router.back()} />
      </View>

      <ScrollView
        scrollEnabled={!arrastando}
        contentContainerStyle={{ paddingHorizontal: Espaco.quatro, paddingBottom: ins.bottom + Espaco.seis, gap: Espaco.quatro }}>
        <View style={[estilos.dica, { backgroundColor: comAlfa(c.azul, c.escuro ? 0.12 : 0.07) }]}>
          <Icone nome="arrastar" tamanho={16} cor={c.azulTinta} peso="semibold" />
          <Texto v="apoio" cor={c.azulTinta} style={{ flex: 1, fontFamily: Fontes.textoForte }}>Segure a alça e arraste para mudar a ordem.</Texto>
        </View>

        <Cartao padding={0} vidro={false} style={{ gap: 0, overflow: 'visible' }}>
          <ListaOrdenavel
            ordem={escolha.ordem}
            nomes={nomes}
            aoArrastar={setArrastando}
            aoMudar={(ordem) => mudarEscolhaWidgets({ ...escolha, ordem: ordem as IdWidget[] })}
            linha={(id) => {
              const w = WIDGETS.find((x) => x.id === id)!;
              const ligado = !escolha.escondidos.includes(w.id);
              const porque = motivo(w, e);
              return (
                <>
                  <View style={[estilos.icone, { backgroundColor: c.cartao2, opacity: porque ? 0.5 : 1 }]}>
                    <Icone nome={ICONES[w.id]} tamanho={19} cor={ligado && !porque ? c.texto : c.apoio} />
                  </View>
                  <View style={{ flex: 1, gap: 2, opacity: porque ? 0.62 : ligado ? 1 : 0.75 }}>
                    <Texto v="forte" numberOfLines={1} maxFontSizeMultiplier={1.25} style={{ fontSize: 16, lineHeight: 21 }}>{w.nome}</Texto>
                    <Texto v="apoio" numberOfLines={2} maxFontSizeMultiplier={1.25} cor={porque ? c.fraco : c.apoio} style={{ fontSize: 13, lineHeight: 17 }}>{porque ?? w.descricao}</Texto>
                  </View>
                  <Interruptor valor={ligado} aoMudar={(v) => trocar(w.id, v)} rotulo={`${w.nome}${porque ? `. ${porque}` : ''}`} />
                </>
              );
            }}
          />
        </Cartao>

        <Botao
          titulo="Restaurar padrão"
          icone="atualizar"
          variante="texto"
          onPress={() => { vibrar('leve'); restaurarWidgets(); }}
          style={{ alignSelf: 'center' }}
        />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingHorizontal: Espaco.cinco, paddingTop: Espaco.seis, paddingBottom: Espaco.quatro },
  titulo: { fontFamily: Fontes.tituloForte, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  dica: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois, paddingHorizontal: Espaco.quatro, paddingVertical: Espaco.tres, borderRadius: 16 },
  icone: { width: 40, height: 40, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
