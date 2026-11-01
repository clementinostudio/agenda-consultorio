// O topo do Perfil: a foto grande (com o lápis, que abre a edição do perfil no site), o nome e o e-mail; e os dois
// cartões lado a lado: o plano (só a situação, sem venda) e as conexões com bancos (ou as áreas ligadas).
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Cartao, comAlfa, Icone, LogoBanco, Texto, Tocavel, type NomeIcone } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { useBanco } from '@/hooks/use-banco';
import { dm } from '@/lib/formato';
import { mostrarWeb, type Estado, type Modo } from '@/lib/motor';
import { abrirNoSiteDaqui, voltarAoInicio } from '@/components/bancos/comum';

export function Cabeca({ e }: { e: Estado }) {
  const c = useCores();
  const nome = e.conta?.nome?.trim() || '';
  const foto = e.conta?.foto ?? null;
  const T = 112;
  return (
    <View style={estilos.cabeca}>
      <Tocavel
        onPress={() => abrirNoSiteDaqui({ tela: 'perfil' }, 'ajustes')}
        escala={0.96}
        accessibilityLabel="Editar foto e nome"
        style={{ width: T, height: T }}>
        <Avatar nome={nome || e.conta?.email || '?'} foto={foto} tamanho={T} />
        <View style={[estilos.lapis, { backgroundColor: c.cartao3, borderColor: c.fundo }]}>
          <Icone nome="editar" tamanho={15} cor={c.texto} peso="semibold" />
        </View>
      </Tocavel>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Texto v="titulo" accessibilityRole="header" numberOfLines={2} style={estilos.nome}>{nome || 'Sua conta'}</Texto>
        {e.conta?.email ? <Texto v="apoio" numberOfLines={1} style={{ fontSize: 14 }}>{e.conta.email}</Texto> : null}
      </View>
    </View>
  );
}

/* ---------- Os dois cartões ---------- */

// "Pro" (com "ativo até 12/12"), "Grátis" ou "Completo" (sem limite). Só a situação: nada de preço nem de assinar.
function situacaoPlano(p: Estado['plano']) {
  if (!p) return { titulo: 'Completo', sub: 'Plano' };
  if (p.pro) return { titulo: 'Pro', sub: p.ate ? `Ativo até ${dm(p.ate)}` : 'Plano ativo' };
  return { titulo: 'Grátis', sub: 'Plano' };
}

function Mini({ topo, titulo, sub, onPress, rotulo }: { topo: ReactNode; titulo: string; sub: string; onPress?: () => void; rotulo: string }) {
  const c = useCores();
  return (
    <Cartao onPress={onPress} rotulo={rotulo} padding={Espaco.quatro + 2} style={estilos.mini}>
      <View style={estilos.miniTopo}>
        {topo}
        <View style={{ flex: 1 }} />
        {onPress ? <Icone nome="chevron" tamanho={13} cor={c.fraco} peso="bold" /> : null}
      </View>
      <View style={{ gap: 1 }}>
        <Texto numberOfLines={1} maxFontSizeMultiplier={1.3} style={estilos.miniTitulo}>{titulo}</Texto>
        <Texto v="apoio" numberOfLines={1}>{sub}</Texto>
      </View>
    </Cartao>
  );
}

function Medalha({ icone, cor }: { icone: NomeIcone; cor: string }) {
  const c = useCores();
  return (
    <View style={[estilos.medalha, { backgroundColor: comAlfa(cor, c.escuro ? 0.15 : 0.1) }]}>
      <Icone nome={icone} tamanho={18} cor={cor} cheio />
    </View>
  );
}

const AREAS: Record<Modo, { nome: string; icone: NomeIcone }> = {
  consultorio: { nome: 'Consultório', icone: 'consultorio' },
  pessoal: { nome: 'Pessoal', icone: 'carteira' },
  loja: { nome: 'Loja', icone: 'loja' },
};

export function Resumo({ e }: { e: Estado }) {
  const c = useCores();
  const b = useBanco();
  const plano = situacaoPlano(e.plano);
  const bancos = b.resumo?.bancos ?? [];
  const n = bancos.length;
  return (
    <View style={estilos.resumo}>
      <Mini
        topo={<Medalha icone={plano.titulo === 'Pro' ? 'estrela' : 'escudo'} cor={plano.titulo === 'Pro' ? c.azulTinta : c.menta} />}
        titulo={plano.titulo}
        sub={plano.sub}
        rotulo={`Plano ${plano.titulo}${plano.sub !== 'Plano' ? `. ${plano.sub}` : ''}`}
      />
      {e.bancoLigado ? (
        <Mini
          topo={n ? (
            <View style={{ flexDirection: 'row' }}>
              {bancos.slice(0, 4).map((x, i) => (
                <View key={x.id} style={[estilos.logoPilha, { marginLeft: i ? -8 : 0, borderColor: c.cartao, zIndex: 10 - i }]}>
                  <LogoBanco banco={x.nome} tamanho={34} />
                </View>
              ))}
            </View>
          ) : <Medalha icone="banco" cor={c.azulTinta} />}
          titulo={n ? (n === 1 ? '1 banco' : `${n} bancos`) : 'Nenhum banco'}
          sub={n ? 'Conexões' : 'Conectar banco'}
          onPress={() => router.push('/bancos')}
          rotulo={n ? `Conexões: ${n === 1 ? '1 banco' : `${n} bancos`}. Abre os bancos` : 'Conexões: nenhum banco. Abre os bancos para conectar'}
        />
      ) : (
        <Mini
          topo={
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {e.modos.slice(0, 3).map((m) => <Medalha key={m} icone={AREAS[m]?.icone ?? 'areas'} cor={c.azulTinta} />)}
              {!e.modos.length ? <Medalha icone="areas" cor={c.azulTinta} /> : null}
            </View>
          }
          titulo={e.modos.length === 1 ? '1 área' : `${e.modos.length} áreas`}
          sub={e.modos.length ? e.modos.map((m) => AREAS[m]?.nome ?? m).join(', ') : 'Áreas do Avina'}
          onPress={() => { voltarAoInicio(); mostrarWeb('area'); }}
          rotulo={`Áreas ligadas: ${e.modos.map((m) => AREAS[m]?.nome ?? m).join(', ') || 'nenhuma'}. Abre as áreas do Avina`}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabeca: { alignItems: 'center', gap: Espaco.quatro },
  lapis: { position: 'absolute', right: 0, bottom: 2, width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  nome: { textAlign: 'center', fontSize: 26, lineHeight: 32 },
  resumo: { flexDirection: 'row', gap: Espaco.tres },
  mini: { flex: 1, minHeight: 136, justifyContent: 'space-between' },
  miniTopo: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 36 },
  miniTitulo: { fontFamily: Fontes.tituloForte, fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  medalha: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  logoPilha: { borderRadius: 20, borderWidth: 2, overflow: 'hidden' },
});
