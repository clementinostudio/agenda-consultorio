// As três abas da tela de Bancos: Contas (saldo de cada conta e a parte de cada banco), Cartões (o cartão de
// plástico com a fatura e o limite) e Investimentos (quanto tem e quanto rendeu).
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { CartaoLista } from '@/components/bancos/comum';
import { CartaoCredito, usoDoLimite, vencePerto, textoVence } from '@/components/bancos/cartao-credito';
import { Destaque, LinhaConta, Ponto, ValorTexto } from '@/components/bancos/pecas';
import { BarraSegmentada } from '@/components/graficos';
import { comAlfa, corDoBanco, entradaCascata, LogoBanco, Pilula, Separador, Texto, useDizerValor, Vazio } from '@/components/ui';
import { Espaco, Fontes, useCores } from '@/constants/theme';
import { totaisBanco } from '@/hooks/use-banco';
import { deIso, dinheiro, haQuanto, mesNome, numero, porcento } from '@/lib/formato';
import type { BancoConectado, ContaBanco, Investimento, ResumoBanco } from '@/lib/motor';

const quandoDe = (bancos: BancoConectado[], itemId: string, em?: string) => haQuanto(bancos.find((b) => b.id === itemId)?.atualizado ?? em);

// entra de baixo, em cascata (parado com "reduzir movimento"; com o vidro, sem esmaecer)
function Entra({ i, children }: { i: number; children: ReactNode }) {
  const reduzir = useReducedMotion();
  return <Animated.View entering={reduzir ? undefined : entradaCascata(60 + i * 50, 380)}>{children}</Animated.View>;
}

/* ---------- Contas ---------- */

export function AbaContas({ r }: { r: ResumoBanco }) {
  const dizer = useDizerValor();
  const c = useCores();
  const t = totaisBanco(r);
  const bancos = r.bancos ?? [];
  const contas = [...t.contas].sort((a, z) => z.saldo - a.saldo);
  // a parte de cada banco (soma as contas do mesmo banco)
  const porBanco = new Map<string, number>();
  contas.forEach((k) => porBanco.set(k.banco, (porBanco.get(k.banco) ?? 0) + Math.max(0, k.saldo)));
  const base = [...porBanco.values()].reduce((s, v) => s + v, 0);
  const repetido = (k: ContaBanco) => contas.filter((x) => x.banco === k.banco).length > 1;

  if (!contas.length) {
    return <Vazio icone="banco" titulo="Nenhuma conta por aqui" texto="Os bancos conectados não mandaram nenhuma conta corrente ou poupança." />;
  }
  return (
    <View style={estilos.aba}>
      <Entra i={0}>
        <Destaque rotulo="Saldo em contas" valor={t.emConta} corValor={t.emConta < 0 ? c.negativo : undefined}>
          <Texto v="apoio" style={{ marginTop: 2 }}>{contas.length === 1 ? '1 conta' : `${contas.length} contas`} em {porBanco.size === 1 ? '1 banco' : `${porBanco.size} bancos`}</Texto>
          <BarraSegmentada
            segmentos={[...porBanco.entries()].map(([nome, v]) => ({ id: nome, valor: v, cor: corDoBanco(nome), rotulo: `${nome} ${porcento(base ? v / base : 0)}` }))}
            altura={12}
            style={{ marginTop: Espaco.quatro }}
          />
        </Destaque>
      </Entra>
      <Entra i={1}>
        <CartaoLista>
          {contas.map((k, i) => {
            const quando = quandoDe(bancos, k.itemId, r.em);
            const usando = (k.especialUsado ?? 0) > 0;
            return (
              <View key={k.id}>
                {i ? <Separador recuo={56} /> : null}
                <LinhaConta
                  esquerda={<LogoBanco banco={k.banco} />}
                  titulo={repetido(k) ? `${k.banco} · ${k.nome}` : k.banco}
                  sub={quando ? `Atualizado ${quando}` : k.final ? `Final ${k.final}` : undefined}
                  aviso={usando ? { texto: `Usando ${dinheiro(k.especialUsado ?? 0)} do cheque especial`, cor: c.negativo } : undefined}
                  valor={k.saldo}
                  corValor={k.saldo < 0 ? c.negativo : undefined}
                  abaixoValor={
                    <View style={estilos.parte}>
                      <Ponto cor={corDoBanco(k.banco)} />
                      <Texto v="apoio" maxFontSizeMultiplier={1.3}>{base > 0 ? porcento(Math.max(0, k.saldo) / base) : '—'}</Texto>
                    </View>
                  }
                  rotulo={`${k.banco}, ${k.nome}, final ${k.final}: ${dizer(k.saldo)}${usando ? `, usando ${dizer(k.especialUsado ?? 0)} do cheque especial` : ''}${quando ? `. Atualizado ${quando}` : ''}`}
                />
              </View>
            );
          })}
        </CartaoLista>
      </Entra>
    </View>
  );
}

/* ---------- Cartões ---------- */

export function AbaCartoes({ r }: { r: ResumoBanco }) {
  const c = useCores();
  const t = totaisBanco(r);
  const cartoes = [...t.cartoes].sort((a, z) => z.saldo - a.saldo);
  if (!cartoes.length) {
    return <Vazio icone="cartao" cor={c.roxo} titulo="Nenhum cartão de crédito" texto="Os bancos conectados não mandaram nenhum cartão. Quando mandarem, a fatura e o limite aparecem aqui." />;
  }
  const limite = cartoes.reduce((s, k) => s + (k.limite ?? 0), 0);
  const livre = cartoes.reduce((s, k) => s + (k.livre ?? 0), 0);
  const proximo = cartoes.map((k) => k.vence).filter((v): v is string => !!v).sort()[0];
  return (
    <View style={estilos.aba}>
      <Entra i={0}>
        <Destaque rotulo="Total em faturas" valor={t.faturas}>
          <View style={estilos.pilulas}>
            {proximo && cartoes.length > 1 ? <Pilula texto={textoVence(proximo)} icone="calendario" cor={vencePerto(proximo) ? c.ambar : undefined} /> : null}
            {limite > 0 ? (
              <View style={[estilos.livre, { backgroundColor: comAlfa(c.positivo, c.escuro ? 0.14 : 0.1) }]}>
                <Texto cor={c.positivo} style={estilos.livreTexto}>Livre </Texto>
                <ValorTexto valor={livre} cor={c.positivo} style={estilos.livreTexto} />
              </View>
            ) : null}
          </View>
        </Destaque>
      </Entra>
      {cartoes.map((k, i) => (
        <Entra key={k.id} i={i + 1}>
          <CartaoCredito k={k} />
        </Entra>
      ))}
      {cartoes.some((k) => usoDoLimite(k) == null) ? (
        <Texto v="apoio" style={estilos.nota}>Alguns bancos não mandam o limite do cartão pelo Open Finance.</Texto>
      ) : null}
    </View>
  );
}

/* ---------- Investimentos ---------- */

const NOMES_TIPO: Record<string, string> = {
  CDB: 'CDB', LCI: 'LCI', LCA: 'LCA', LC: 'LC', CRI: 'CRI', CRA: 'CRA', DEBENTURE: 'Debênture', DEBENTURES: 'Debênture',
  TREASURY: 'Tesouro Direto', STOCK: 'Ações', ETF: 'ETF', BDR: 'BDR', REAL_ESTATE_FUND: 'Fundo imobiliário',
  INVESTMENT_FUND: 'Fundo', MULTIMARKET_FUND: 'Fundo multimercado', FIXED_INCOME_FUND: 'Fundo de renda fixa', STOCK_FUND: 'Fundo de ações',
  PENSION: 'Previdência', POUPANCA: 'Poupança', SAVINGS: 'Poupança', COE: 'COE',
  FIXED_INCOME: 'Renda fixa', EQUITY: 'Renda variável', MUTUAL_FUND: 'Fundo', SECURITY: 'Previdência', OTHER: 'Investimento',
};
const tipoDe = (i: Investimento) => (i.subtipo && NOMES_TIPO[i.subtipo]) || NOMES_TIPO[i.tipo] || 'Investimento';
// "vence em mar. de 2029"
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const vencimento = (iso: string) => { const d = deIso(iso); return `vence em ${mesNome(d.getMonth(), true)}. de ${d.getFullYear()}`; };
const pctRendeu = (i: Investimento) => {
  const base = i.aplicado && i.aplicado > 0 ? i.aplicado : i.saldo - (i.rendeu ?? 0);
  return base > 0 && i.rendeu ? i.rendeu / base : null;
};
const fmtPct = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${numero(Math.abs(p) * 100, 1).replace(/,0$/, '')}%`;

export function AbaInvestimentos({ r }: { r: ResumoBanco }) {
  const dizer = useDizerValor();
  const c = useCores();
  const t = totaisBanco(r);
  const lista = [...t.investimentos].sort((a, z) => z.saldo - a.saldo);
  if (!lista.length) {
    return <Vazio icone="investimento" cor={c.ciano} titulo="Nenhum investimento" texto="Os bancos conectados não mandaram investimentos. CDB, Tesouro, fundos e ações aparecem aqui quando vierem." />;
  }
  const paleta = [c.azul, c.roxo, c.ciano, c.menta, c.ambar, c.rosa];
  const corDe = (i: number) => paleta[i % paleta.length];
  const rendeu = lista.reduce((s, i) => s + (i.rendeu ?? 0), 0);
  const base = t.investido - rendeu;
  return (
    <View style={estilos.aba}>
      <Entra i={0}>
        <Destaque rotulo="Investido" valor={t.investido}>
          {rendeu !== 0 ? (
            <View style={[estilos.livre, { alignSelf: 'flex-start', marginTop: Espaco.dois, backgroundColor: comAlfa(rendeu > 0 ? c.positivo : c.negativo, c.escuro ? 0.14 : 0.1) }]}>
              <Texto cor={rendeu > 0 ? c.positivo : c.negativo} style={estilos.livreTexto}>{rendeu > 0 ? 'Rendeu ' : 'Variou '}</Texto>
              <ValorTexto valor={rendeu} sinal cor={rendeu > 0 ? c.positivo : c.negativo} style={estilos.livreTexto} />
              {base > 0 ? <Texto cor={rendeu > 0 ? c.positivo : c.negativo} style={estilos.livreTexto}> ({fmtPct(rendeu / base)})</Texto> : null}
            </View>
          ) : null}
          <BarraSegmentada
            segmentos={lista.map((i, k) => ({ id: i.id, valor: Math.max(0, i.saldo), cor: corDe(k), rotulo: `${i.nome} ${porcento(t.investido ? i.saldo / t.investido : 0)}` }))}
            altura={12}
            style={{ marginTop: Espaco.quatro }}
          />
        </Destaque>
      </Entra>
      <Entra i={1}>
        <CartaoLista>
          {lista.map((i, k) => {
            const p = pctRendeu(i);
            const cor = (i.rendeu ?? 0) >= 0 ? c.positivo : c.negativo;
            return (
              <View key={i.id}>
                {k ? <Separador recuo={56} /> : null}
                <LinhaConta
                  esquerda={<LogoBanco banco={i.banco} />}
                  titulo={i.nome}
                  sub={`${i.banco} · ${tipoDe(i)}`}
                  sub2={i.vence ? maiuscula(vencimento(i.vence)) : undefined}
                  valor={i.saldo}
                  abaixoValor={
                    <View style={estilos.parte}>
                      <Ponto cor={corDe(k)} />
                      {i.rendeu ? (
                        <ValorTexto valor={i.rendeu} sinal cor={cor} style={{ fontFamily: Fontes.textoForte, fontSize: 13, lineHeight: 17 }} />
                      ) : (
                        <Texto v="apoio">{porcento(t.investido ? Math.max(0, i.saldo) / t.investido : 0)}</Texto>
                      )}
                    </View>
                  }
                  rotulo={`${i.nome}, ${i.banco}, ${tipoDe(i)}: ${dizer(i.saldo)}${i.rendeu ? `, ${i.rendeu > 0 ? 'rendeu' : 'variou'} ${dizer(i.rendeu)}${p != null ? ` (${fmtPct(p)})` : ''}` : ''}${i.vence ? `, ${vencimento(i.vence)}` : ''}`}
                />
              </View>
            );
          })}
        </CartaoLista>
      </Entra>
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: Espaco.cinco },
  parte: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.dois, marginTop: Espaco.dois },
  livre: { flexDirection: 'row', alignItems: 'center', height: 24, paddingHorizontal: 10, borderRadius: 999 },
  livreTexto: { fontFamily: Fontes.textoForte, fontSize: 12, lineHeight: 16 },
  nota: { textAlign: 'center', paddingHorizontal: Espaco.quatro },
});
