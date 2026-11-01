// Os bancos conectados (Open Finance): o aviso de quem pede para autorizar de novo, a lista com o "…" de cada um
// (autorizar, desligar), conectar outro banco e trazer os lançamentos.
import { StyleSheet, View } from 'react-native';

import { conectarBanco, desligarBanco, trazerLancamentos } from '@/components/bancos/acoes';
import { CartaoLista, menu, pedeAutorizar } from '@/components/bancos/comum';
import { LinhaConta } from '@/components/bancos/pecas';
import { Botao, BotaoRedondo, Cartao, Icone, Linha, LogoBanco, Secao, Separador, Texto } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { haQuanto } from '@/lib/formato';
import type { BancoConectado } from '@/lib/motor';

// O cartão em âmbar no topo: o banco precisa de uma nova autorização para continuar mandando os dados
export function AvisoAutorizar({ b }: { b: BancoConectado }) {
  const c = useCores();
  return (
    <Cartao destaque={c.ambar} padding={Espaco.quatro}>
      <View style={estilos.aviso}>
        <View style={[estilos.avisoIcone, { backgroundColor: c.cartao2 }]}>
          <Icone nome="alerta" tamanho={18} cor={c.ambar} cheio />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto v="forte">{b.nome} pediu para autorizar de novo</Texto>
          <Texto v="apoio">Sem isso, os saldos e os lançamentos novos desse banco param de chegar.</Texto>
        </View>
      </View>
      <Botao titulo="Autorizar" icone="cadeado" tamanho="pequeno" onPress={() => conectarBanco(b.id)} rotulo={`Autorizar ${b.nome} de novo`} style={{ marginLeft: 52, marginTop: Espaco.um }} />
    </Cartao>
  );
}

async function opcoes(b: BancoConectado) {
  const autorizar = pedeAutorizar(b.status);
  const lista = autorizar ? ['Autorizar de novo', 'Desligar'] : ['Desligar'];
  const i = await menu({ titulo: b.nome, opcoes: lista, perigo: lista.length - 1 });
  if (i == null) return;
  if (lista[i] === 'Autorizar de novo') conectarBanco(b.id);
  else desligarBanco(b);
}

export function BancosConectados({ bancos, pessoal }: { bancos: BancoConectado[]; pessoal: boolean }) {
  const c = useCores();
  return (
    <Secao titulo="Bancos conectados">
      {bancos.length ? (
        <CartaoLista>
          {bancos.map((b, i) => {
            const pede = pedeAutorizar(b.status);
            const quando = haQuanto(b.atualizado);
            return (
              <View key={b.id}>
                {i ? <Separador recuo={56} /> : null}
                <LinhaConta
                  esquerda={<LogoBanco banco={b.nome} />}
                  titulo={b.nome}
                  sub={pede ? undefined : quando ? `Atualizado ${quando}` : 'Conectado'}
                  aviso={pede ? { texto: 'Pede autorização de novo', cor: c.ambar } : undefined}
                  onLongPress={() => opcoes(b)}
                  rotulo={`${b.nome}. ${pede ? 'Pede autorização de novo' : quando ? `Atualizado ${quando}` : 'Conectado'}. Segure para ver as opções`}
                  direita={<BotaoRedondo icone="pontos" variante="solido" tamanho={36} rotulo={`Opções de ${b.nome}`} onPress={() => opcoes(b)} />}
                />
              </View>
            );
          })}
        </CartaoLista>
      ) : null}
      <Botao titulo={bancos.length ? 'Conectar outro banco' : 'Conectar banco'} icone="mais" largo onPress={() => conectarBanco()} style={{ marginTop: Espaco.dois }} />
      {pessoal && bancos.length ? (
        <CartaoLista style={{ marginTop: Espaco.dois }}>
          <Linha
            icone="entrada"
            corIcone={c.azulTinta}
            titulo="Trazer lançamentos do banco"
            sub="Os novos entram direto no Pessoal"
            chevron
            onPress={trazerLancamentos}
          />
        </CartaoLista>
      ) : null}
    </Secao>
  );
}

// O rodapé de todas as abas
export function RodapeBanco() {
  const c = useCores();
  return (
    <View style={estilos.rodape} accessible>
      <Icone nome="escudo" tamanho={16} cor={c.fraco} />
      <Texto v="apoio" cor={c.fraco} style={estilos.rodapeTexto}>Pelo Open Finance. O banco manda os dados cerca de uma vez por dia. Só leitura: nada sai da sua conta.</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.tres },
  avisoIcone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rodape: { flexDirection: 'row', gap: Espaco.dois, alignItems: 'flex-start', paddingHorizontal: Espaco.dois },
  rodapeTexto: { flex: 1, fontFamily: Fontes.texto, fontSize: 12, lineHeight: 17 },
});
