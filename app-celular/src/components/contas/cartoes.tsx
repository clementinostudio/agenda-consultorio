// Os blocos da tela de Contas fixas: o topo (quanto falta pagar, a barra do que já foi pago e a régua do mês), a
// próxima conta em destaque (com o marcar como paga e o copiar código), os grupos da lista e o cartão das assinaturas.
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { CartaoLista } from '@/components/bancos/comum';
import { pagarConta } from '@/components/contas/acoes';
import { corDaSituacao, LinhaConta, LogoConta } from '@/components/contas/linha';
import { ReguaContas } from '@/components/contas/regua';
import { diaDaSemana, soDigitos, textoSituacao, type ContaMes, type ResumoContas } from '@/components/contas/regras';
import { BarraProgresso } from '@/components/graficos';
import { Botao, Cartao, comAlfa, Dinheiro, Icone, Logo, mostrarRecado, Separador, Texto, Tocavel, useDizerValor, vibrar } from '@/components/ui';
import { Espaco, Fontes, Raio, useCores } from '@/constants/theme';
import { dinheiro, mesNome, porcento } from '@/lib/formato';
import { useOculto } from '@/lib/motor';

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/* ---------- O topo ---------- */

export function TopoContas({ r, hoje }: { r: ResumoContas; hoje: string }) {
  const c = useCores();
  const oculto = useOculto();
  const n = r.todas.length;
  const tudoPago = n > 0 && r.falta < 0.005;
  return (
    <View style={{ gap: 2 }}>
      <Texto v="rotulo" accessibilityRole="header" style={{ marginBottom: 4 }}>
        {maiuscula(mesNome(r.mes))} · {r.pagas.length} de {n} {n === 1 ? 'paga' : 'pagas'}
      </Texto>
      <Texto v="apoio" style={estilos.rotulo}>{tudoPago ? 'Tudo pago este mês' : 'Falta pagar'}</Texto>
      <Dinheiro valor={tudoPago ? r.total : r.falta} tamanho={40} cor={tudoPago ? c.positivo : undefined} />
      <Texto v="apoio" style={{ marginTop: 2 }}>
        {oculto ? `${porcento(r.total ? r.pago / r.total : 0)} já pago` : `${dinheiro(r.pago)} de ${dinheiro(r.total)} já pagos`}
      </Texto>
      <BarraProgresso
        progresso={r.total ? r.pago / r.total : 0}
        cor={c.positivo}
        altura={8}
        fundo={c.escuro ? c.cartao2 : c.cartao3}
        rotulo={`${porcento(r.total ? r.pago / r.total : 0)} das contas do mês já pagas`}
        style={{ marginTop: Espaco.tres }}
      />
      <ReguaContas contas={r.todas} hoje={hoje} />
    </View>
  );
}

/* ---------- A próxima conta ---------- */

// A que mais pede atenção (a mais atrasada, senão a próxima a vencer), com o botão de marcar e o código do boleto
export function CartaoProxima({ conta }: { conta: ContaMes }) {
  const c = useCores();
  const dizer = useDizerValor();
  const cor = corDaSituacao(conta.st, c) ?? c.azul;
  const situacao = textoSituacao(conta);
  const titulo = conta.st === 'atrasada' ? 'Atrasada' : conta.st === 'hoje' ? 'Vence hoje' : 'Próxima a vencer';
  const copiar = async () => {
    if (!conta.codigo) return;
    await Clipboard.setStringAsync(soDigitos(conta.codigo));
    vibrar('ok');
    mostrarRecado({ titulo: 'Código copiado', texto: 'Cole no app do seu banco para pagar', icone: 'copiar' });
  };
  return (
    <Cartao destaque={cor} onPress={() => router.push({ pathname: '/conta/[id]', params: { id: conta.id } })} rotulo={`${titulo}: ${conta.nome}, ${dizer(conta.valor)}, ${situacao}. Abre o detalhe`}>
      <View style={estilos.proxTopo}>
        <Icone nome={conta.st === 'atrasada' ? 'alerta' : 'calendario'} tamanho={15} cor={cor} peso="semibold" cheio={conta.st === 'atrasada'} />
        <Texto cor={cor} style={estilos.proxTitulo}>{titulo}</Texto>
        <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" />
      </View>
      <View style={estilos.proxMeio}>
        <LogoConta c={conta} tamanho={52} anel={c.cartao} />
        <View style={{ flex: 1, gap: 2 }}>
          <Texto v="subtitulo" numberOfLines={1}>{conta.nome}</Texto>
          <Texto v="apoio" numberOfLines={1}>
            {situacao}{conta.st !== 'atrasada' && conta.dias > 1 && conta.dias <= 6 ? ` · ${diaDaSemana(conta.vence)}` : ` · dia ${Number(conta.vence.slice(8, 10))}`}
          </Texto>
        </View>
      </View>
      <Dinheiro valor={conta.valor} tamanho={30} style={{ marginTop: 2 }} />
      <View style={estilos.proxBotoes}>
        <Botao titulo="Marcar como paga" icone="check" tamanho="medio" vibra={false} onPress={() => { pagarConta(conta); }} rotulo={`Marcar ${conta.nome} como paga`} style={{ flex: 1 }} />
        {conta.codigo ? (
          <Tocavel onPress={copiar} escala={0.92} accessibilityLabel="Copiar o código do boleto" style={[estilos.copiar, { backgroundColor: c.escuro ? c.cartao2 : c.cartao, borderColor: c.linhaForte }]}>
            <Icone nome="copiar" tamanho={18} cor={c.texto} peso="semibold" />
          </Tocavel>
        ) : null}
      </View>
    </Cartao>
  );
}

// Tudo pago no mês: o cartão de parabéns no lugar da próxima conta
export function CartaoTudoPago({ mes }: { mes: string }) {
  const c = useCores();
  return (
    <Cartao destaque={c.positivo}>
      <View style={estilos.okLinha}>
        <View style={[estilos.ok, { backgroundColor: comAlfa(c.positivo, c.escuro ? 0.18 : 0.14) }]}>
          <Icone nome="check" tamanho={22} cor={c.positivo} peso="bold" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto v="subtitulo">Tudo pago</Texto>
          <Texto v="apoio">Nenhuma conta pendente em {mesNome(mes)}. O Avina lembra antes das próximas vencerem.</Texto>
        </View>
      </View>
    </Cartao>
  );
}

/* ---------- Os grupos da lista ---------- */

export function GrupoContas({ titulo, contas, cor, recolhivel, aberto: abertoInicial = true }: { titulo: string; contas: ContaMes[]; cor?: string; recolhivel?: boolean; aberto?: boolean }) {
  const c = useCores();
  const oculto = useOculto();
  const reduzir = useReducedMotion();
  const [aberto, setAberto] = useState(abertoInicial);
  if (!contas.length) return null;
  const total = contas.reduce((t, k) => t + k.valor, 0);
  const cabeca = (
    <>
      {cor ? <View style={[estilos.ponto, { backgroundColor: cor }]} /> : null}
      <Texto accessibilityRole="header" numberOfLines={1} cor={cor ?? c.apoio} style={estilos.grupoTitulo}>
        {titulo} <Texto cor={c.fraco} style={estilos.grupoN}>({contas.length})</Texto>
      </Texto>
      <Texto cor={c.apoio} style={estilos.grupoTotal}>{oculto ? 'R$ ••••' : dinheiro(total)}</Texto>
      {recolhivel ? <Icone nome={aberto ? 'setaCima' : 'chevronBaixo'} tamanho={12} cor={c.fraco} peso="bold" /> : null}
    </>
  );
  return (
    <Animated.View layout={reduzir ? undefined : LinearTransition.duration(240)} style={{ gap: Espaco.dois }}>
      {recolhivel ? (
        <Tocavel onPress={() => setAberto(!aberto)} escala={0.98} accessibilityState={{ expanded: aberto }} accessibilityLabel={`${titulo}: ${contas.length}`} accessibilityHint={aberto ? 'Esconde a lista' : 'Mostra a lista'} style={estilos.grupoTopo}>
          {cabeca}
        </Tocavel>
      ) : (
        <View style={estilos.grupoTopo}>{cabeca}</View>
      )}
      {aberto ? (
        <Animated.View entering={reduzir ? undefined : FadeInDown.duration(220)}>
          <CartaoLista style={cor ? { borderColor: comAlfa(cor, c.escuro ? 0.3 : 0.26) } : undefined}>
            {contas.map((k, i) => (
              <Animated.View key={k.id} layout={reduzir ? undefined : LinearTransition.duration(220)}>
                {i ? <Separador recuo={56} /> : null}
                <LinhaConta c={k} />
              </Animated.View>
            ))}
          </CartaoLista>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/* ---------- Assinaturas ---------- */

// O total por mês (e por ano) das contas marcadas como assinatura, com a pilha de logos e a lista
// lista false: só o total (em "Todas", onde as contas já aparecem nos grupos); aoAbrir: tocar mostra a lista
export function CartaoAssinaturas({ r, lista = true, aoAbrir }: { r: ResumoContas; lista?: boolean; aoAbrir?: () => void }) {
  const c = useCores();
  const oculto = useOculto();
  const dizer = useDizerValor();
  if (!r.assinaturas.length) return null;
  const pilha = r.assinaturas.slice(0, 5);
  const falar = `Assinaturas: ${dizer(r.totalAssinaturas)} por mês, ${dizer(r.totalAssinaturas * 12)} por ano, ${r.assinaturas.length} ${r.assinaturas.length === 1 ? 'assinatura' : 'assinaturas'}`;
  return (
    <Cartao padding={0} onPress={aoAbrir} rotulo={aoAbrir ? `${falar}. Mostra as assinaturas` : undefined}>
      <View style={estilos.assinTopo} accessible={!aoAbrir} accessibilityLabel={falar}>
        <View style={[estilos.pilha, { width: 34 + (pilha.length - 1) * 20 }]}>
          {pilha.map((k, i) => (
            <View key={k.id} style={[estilos.pilhaItem, { left: i * 20, zIndex: pilha.length - i, borderColor: c.cartao }]}>
              <Logo marca={k.marca} site={k.site} nome={k.nome} cat={k.cat} tamanho={34} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Texto v="apoio">Assinaturas</Texto>
          <Dinheiro valor={r.totalAssinaturas} tamanho={26} />
          <Texto v="apoio" numberOfLines={1}>por mês · {oculto ? 'R$ ••••' : dinheiro(r.totalAssinaturas * 12, { centavos: false })} por ano</Texto>
        </View>
        {aoAbrir ? <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" /> : null}
      </View>
      {lista ? (
        <View style={estilos.assinLista}>
          {r.assinaturas.map((k) => (
            <View key={k.id}>
              <Separador />
              <LinhaConta c={k} sub={`Dia ${k.dia} · ${oculto ? 'R$ ••••' : dinheiro(k.valor * 12, { centavos: false })} por ano`} />
            </View>
          ))}
          <View style={[estilos.dica, { backgroundColor: c.escuro ? c.cartao2 : c.fundo }]}>
            <Icone nome="faisca" tamanho={15} cor={c.azulTinta} peso="semibold" />
            <Texto v="apoio" style={{ flex: 1 }}>Ainda usa todas? Cancelar uma que ficou esquecida é dinheiro de volta todo mês.</Texto>
          </View>
        </View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  rotulo: { fontSize: 15, lineHeight: 20 },
  proxTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proxTitulo: { flex: 1, fontFamily: Fontes.textoPesado, fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
  proxMeio: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres, marginTop: Espaco.dois },
  proxBotoes: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois, marginTop: Espaco.dois },
  copiar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  okLinha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.tres + 2 },
  ok: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  grupoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, paddingHorizontal: Espaco.um },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  grupoTitulo: { flex: 1, fontFamily: Fontes.textoForte, fontSize: 15, lineHeight: 20 },
  grupoN: { fontFamily: Fontes.texto, fontSize: 14 },
  grupoTotal: { fontFamily: Fontes.textoForte, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  assinTopo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.quatro, padding: Espaco.cinco, paddingBottom: Espaco.quatro },
  pilha: { height: 34 + 4 },
  pilhaItem: { position: 'absolute', top: 0, borderRadius: 19, borderWidth: 2 },
  assinLista: { paddingHorizontal: Espaco.quatro, paddingBottom: Espaco.quatro },
  dica: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2, marginTop: Espaco.dois, padding: Espaco.tres, borderRadius: Raio.pequeno, borderCurve: 'continuous' },
});
