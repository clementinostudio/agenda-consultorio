// "Hoje no consultório": as sessões de hoje numa linha do tempo (hora, nome, situação e valor), o recebido no mês e
// o que falta receber. Tocar abre a agenda do Consultório no site.
import { StyleSheet, View } from 'react-native';

import { ValorCurto } from '@/components/inicio/comum';
import { Cartao, CartaoTitulo, comAlfa, Icone, Pilula, Separador, Texto, useDizerValor } from '@/components/ui';
import { Espaco, Fontes, useCores, type Paleta } from '@/constants/theme';
import { abrirNoSite, useEstado, type ItemAgenda } from '@/lib/motor';

const SITUACAO: Record<ItemAgenda['status'], { nome: string; cor: (c: Paleta) => string }> = {
  feita: { nome: 'Feita', cor: (c) => c.positivo },
  faltou: { nome: 'Faltou', cor: (c) => c.negativo },
  proxima: { nome: 'Próxima', cor: (c) => c.azulTinta },
  cancelada: { nome: 'Cancelada', cor: (c) => c.fraco },
  outra: { nome: 'Sem marcar', cor: (c) => c.ambar },
};

const MAX = 5;

export function CartaoConsultorio() {
  const dizer = useDizerValor();
  const c = useCores();
  const e = useEstado();
  const k = e?.consultorio;
  if (!k) return null;
  const hoje = k.hoje;
  const feitas = hoje.filter((x) => x.status === 'feita').length;
  const iProxima = hoje.findIndex((x) => x.status === 'proxima');
  const proxima = iProxima >= 0 ? hoje[iProxima] : null;
  // muitas sessões: mostra a partir da última que passou (a próxima fica sempre à vista)
  const de = hoje.length > MAX ? Math.max(0, Math.min(hoje.length - MAX, (iProxima >= 0 ? iProxima : hoje.length) - 1)) : 0;
  const mostrar = hoje.slice(de, de + MAX);
  const resto = hoje.length - mostrar.length;
  const titulo = !hoje.length ? 'Nenhuma sessão hoje' : `${hoje.length} ${hoje.length === 1 ? 'sessão' : 'sessões'} hoje`;
  const sub = !hoje.length ? '' : `${feitas} ${feitas === 1 ? 'feita' : 'feitas'}${proxima ? ` · a próxima às ${proxima.hora}` : ''}`;
  const resumo = sub ? `${titulo}, ${sub}` : titulo;

  return (
    <Cartao
      onPress={() => abrirNoSite({ area: 'consultorio', tela: 'agenda' })}
      rotulo={`Hoje no consultório: ${resumo}. Recebido no mês ${dizer(k.recebidoMes)}, a receber ${dizer(k.aReceber)}. Abre a agenda`}>
      <CartaoTitulo rotulo="Hoje no consultório" icone="consultorio" tocavel />
      <View style={{ gap: 2, marginTop: Espaco.um }}>
        <Texto v="subtitulo" numberOfLines={1}>{titulo}</Texto>
        {sub ? <Texto v="apoio" numberOfLines={1}>{sub}</Texto> : null}
      </View>
      {mostrar.length ? (
        <View style={{ marginTop: Espaco.dois }}>
          {mostrar.map((x, i) => {
            const s = SITUACAO[x.status] ?? SITUACAO.outra;
            const cor = s.cor(c);
            const cheia = x.status === 'feita' || x.status === 'faltou';
            const ultima = i === mostrar.length - 1;
            const passou = x.status !== 'proxima';
            return (
              <View key={`${x.hora}-${i}`} style={estilos.linha}>
                <Texto style={[estilos.hora, { color: passou ? c.apoio : c.texto }]}>{x.hora}</Texto>
                <View style={estilos.trilho}>
                  <View style={[estilos.risco, { backgroundColor: i ? c.linhaForte : 'transparent' }]} />
                  <View style={[estilos.bola, cheia ? { backgroundColor: cor } : { borderWidth: 2, borderColor: cor, backgroundColor: c.cartao }, x === proxima && { boxShadow: `0px 0px 0px 4px ${comAlfa(cor, 0.2)}` }]} />
                  <View style={[estilos.risco, { backgroundColor: ultima ? 'transparent' : c.linhaForte }]} />
                </View>
                <Texto v="forte" numberOfLines={1} style={[estilos.nome, x.status === 'cancelada' && { textDecorationLine: 'line-through', color: c.apoio }]}>{x.nome}</Texto>
                <Pilula texto={s.nome} cor={cor} style={{ alignSelf: 'center' }} />
                <View style={estilos.valor}>
                  {x.valor == null ? <Texto v="apoio">—</Texto> : <ValorCurto valor={x.valor} tamanho={14} cor={passou ? c.apoio : c.texto} />}
                </View>
              </View>
            );
          })}
          {resto > 0 ? <Texto v="apoio" style={{ paddingLeft: 66, marginTop: 2 }}>e mais {resto} {resto === 1 ? 'sessão' : 'sessões'}</Texto> : null}
        </View>
      ) : (
        <View style={[estilos.livre, { backgroundColor: c.cartao2 }]}>
          <Icone nome="calendario" tamanho={18} cor={c.apoio} />
          <Texto v="apoio" style={{ flex: 1 }}>A agenda de hoje está livre.</Texto>
        </View>
      )}
      <Separador style={{ marginTop: Espaco.tres, marginBottom: Espaco.dois }} />
      <View style={estilos.numeros}>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto v="apoio" style={{ fontSize: 12.5 }}>Recebido no mês</Texto>
          <ValorCurto valor={k.recebidoMes} tamanho={19} cor={c.positivo} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto v="apoio" style={{ fontSize: 12.5 }}>A receber</Texto>
          <ValorCurto valor={k.aReceber} tamanho={19} cor={k.aReceber > 0 ? c.ambar : c.texto} />
        </View>
        <View style={{ gap: 2, alignItems: 'flex-end' }}>
          <Texto v="apoio" style={{ fontSize: 12.5 }}>Sessões</Texto>
          <Texto style={estilos.sessoes}>{k.sessoesMes}</Texto>
        </View>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2, minHeight: 44 },
  hora: { width: 44, fontFamily: Fontes.titulo, fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'] },
  trilho: { width: 12, alignSelf: 'stretch', alignItems: 'center' },
  risco: { flex: 1, width: 2, borderRadius: 1 },
  bola: { width: 12, height: 12, borderRadius: 6 },
  nome: { flex: 1, fontSize: 15 },
  valor: { minWidth: 58, alignItems: 'flex-end' },
  livre: { flexDirection: 'row', alignItems: 'center', gap: Espaco.dois + 2, padding: Espaco.tres + 2, borderRadius: 16, marginTop: Espaco.dois },
  numeros: { flexDirection: 'row', alignItems: 'flex-end', gap: Espaco.tres },
  sessoes: { fontFamily: Fontes.tituloForte, fontSize: 19, lineHeight: 25, fontVariant: ['tabular-nums'] },
});
