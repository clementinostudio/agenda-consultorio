// O campo do chat: uma pílula grande de vidro com o "+" à esquerda (atalhos), o texto (até 5 linhas) e o botão
// redondo de enviar (claro sobre escuro), que vira "parar" enquanto a Bolinha pensa.
// Também daqui: o menu do "+" (anotar gasto, anotar entrada...), que abre logo acima da pílula.
// Sem microfone: o app ainda não tem reconhecimento de voz próprio, e botão que não funciona não entra.
import type { Ref } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputInstance, type TextInputKeyPressEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { Icone, Texto, Tocavel, Vidro, type NomeIcone } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';

const LINHA = 22; // a altura de uma linha do texto
const BOTAO = 44;

export type CampoProps = {
  valor: string;
  aoMudar: (t: string) => void;
  aoEnviar: () => void;
  aoParar: () => void;
  esperando: boolean;
  aoMais?: () => void; // sem: o "+" não aparece (sem atalho que sirva)
  menuAberto?: boolean;
  dica: string;
  ref?: Ref<TextInputInstance>;
};

export function Campo({ valor, aoMudar, aoEnviar, aoParar, esperando, aoMais, menuAberto, dica, ref }: CampoProps) {
  const c = useCores();
  const pode = valor.trim().length > 0 && !esperando;
  const ativo = pode || esperando;

  // no navegador (a prévia), Enter envia e Shift+Enter quebra a linha; no celular, quem envia é o botão
  const tecla = Platform.OS === 'web'
    ? (e: TextInputKeyPressEvent) => {
      const ev = e as unknown as { nativeEvent: { key: string; shiftKey?: boolean }; preventDefault: () => void };
      if (ev.nativeEvent.key === 'Enter' && !ev.nativeEvent.shiftKey) { ev.preventDefault(); if (pode) aoEnviar(); }
    }
    : undefined;

  return (
    <Vidro raio={Raio.cartao} style={estilos.pilula}>
      {aoMais ? (
        <Tocavel
          onPress={aoMais}
          accessibilityLabel="Atalhos"
          accessibilityHint="Anotar um gasto ou uma entrada"
          accessibilityState={{ expanded: !!menuAberto }}
          escala={0.9}
          style={estilos.botao}>
          <Icone nome="mais" tamanho={24} cor={c.texto} peso="regular" />
        </Tocavel>
      ) : <View style={{ width: Espaco.dois }} />}
      <TextInput
        ref={ref}
        value={valor}
        onChangeText={aoMudar}
        placeholder={dica}
        placeholderTextColor={c.apoio}
        multiline
        maxLength={600}
        onKeyPress={tecla}
        accessibilityLabel="Mensagem para a Bolinha"
        maxFontSizeMultiplier={1.5}
        keyboardAppearance={c.escuro ? 'dark' : 'light'}
        selectionColor={c.azul}
        cursorColor={c.azul}
        textAlignVertical="center"
        style={[
          estilos.texto,
          { color: c.texto },
          // no celular o campo cresce sozinho até 5 linhas; no navegador (a prévia), fica numa linha que rola
          Platform.OS === 'web' ? { height: LINHA + 22 } : { maxHeight: LINHA * 5 + 22 },
        ]}
      />
      <Tocavel
        onPress={esperando ? aoParar : pode ? aoEnviar : undefined}
        accessibilityLabel={esperando ? 'Parar a resposta' : 'Enviar'}
        accessibilityState={{ disabled: !ativo }}
        vibra={esperando ? 'leve' : 'toque'}
        escala={ativo ? 0.88 : 1}
        style={[estilos.enviar, { backgroundColor: ativo ? c.texto : c.cartao3 }]}>
        {esperando ? (
          <Animated.View key="parar" entering={ZoomIn.duration(160)}>
            <View style={[estilos.quadrado, { backgroundColor: c.fundo }]} />
          </Animated.View>
        ) : (
          <Animated.View key="enviar" entering={ZoomIn.duration(160)}>
            <Icone nome="enviar" tamanho={20} cor={ativo ? c.fundo : c.fraco} peso="bold" />
          </Animated.View>
        )}
      </Tocavel>
    </Vidro>
  );
}

/* ---------- O menu do "+" ---------- */

export type Atalho = { id: string; titulo: string; sub: string; icone: NomeIcone; cor: string; aoTocar: () => void };

export function MenuMais({ aberto, aoFechar, atalhos, embaixo }: { aberto: boolean; aoFechar: () => void; atalhos: Atalho[]; embaixo: number }) {
  const c = useCores();
  if (!aberto) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar os atalhos" />
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        accessibilityViewIsModal
        style={[
          estilos.menu,
          { bottom: embaixo, backgroundColor: c.escuro ? c.cartao2 : c.cartao, borderColor: c.linhaForte },
          { boxShadow: c.escuro ? '0px 12px 32px rgba(0,0,0,0.5)' : '0px 12px 32px rgba(17,17,20,0.14)' },
        ]}>
        {atalhos.map((a, i) => (
          <Tocavel
            key={a.id}
            onPress={() => { aoFechar(); a.aoTocar(); }}
            accessibilityLabel={a.titulo}
            accessibilityHint={a.sub}
            escala={0.98}
            style={[estilos.atalho, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.linhaForte }]}>
            <View style={[estilos.atalhoIcone, { backgroundColor: c.escuro ? c.cartao3 : c.cartao2 }]}>
              <Icone nome={a.icone} tamanho={18} cor={a.cor} peso="semibold" />
            </View>
            <View style={{ flex: 1 }}>
              <Texto v="forte" numberOfLines={1}>{a.titulo}</Texto>
              <Texto v="apoio" numberOfLines={1} style={{ fontSize: 13 }}>{a.sub}</Texto>
            </View>
          </Tocavel>
        ))}
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pilula: { flexDirection: 'row', alignItems: 'flex-end', minHeight: 56, paddingHorizontal: 6, paddingVertical: 6 },
  botao: { width: BOTAO, height: BOTAO, borderRadius: BOTAO / 2, alignItems: 'center', justifyContent: 'center' },
  texto: { flex: 1, fontFamily: Fontes.texto, fontSize: 16, lineHeight: LINHA, paddingTop: 11, paddingBottom: 11, paddingHorizontal: 4, minHeight: BOTAO, outlineWidth: 0 },
  enviar: { width: BOTAO, height: BOTAO, borderRadius: BOTAO / 2, alignItems: 'center', justifyContent: 'center' },
  quadrado: { width: 14, height: 14, borderRadius: 3.5 },
  menu: { position: 'absolute', left: 16, width: 264, borderRadius: Raio.medio, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden' },
  atalho: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, paddingHorizontal: 14, paddingVertical: 12, minHeight: 60 },
  atalhoIcone: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
