// Painel "No banco agora": saldos das contas, cartões (fatura e limite) e investimentos, pelo Open Finance (src/banco.js).
// Só aparece para quem tem a opção liberada e algum banco conectado.
// Também daqui: o selo do banco que vai no canto da logo de um lançamento que veio do Open Finance.
import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { I, brl, dm, todayISO, diffDias, uid, MarcaLogo, Money } from "../App.jsx";
import { acharMarca, monograma } from "../marcas.js";
import { resumoBanco, resumoGuardado } from "../banco.js";
import { Anel } from "./visual.jsx";
import "../pessoal.css";

// "MeuPluggy" é o nome da ponte, não do banco: nesse caso vale o nome da conta
export const nomeBanco = b => (typeof b === "string" && !/meu\s*pluggy/i.test(b) ? b.trim() : "");
// (guardada por nome: achar a marca é caro, e o selo aparece em cada linha da lista)
const marcas = new Map();
const marcaUm = n => { if (!marcas.has(n)) marcas.set(n, (acharMarca(n) || {}).id || null); return marcas.get(n); };
const marcaDe = (...nomes) => { for (const n of nomes) { const m = n && marcaUm(n); if (m) return m; } return null; };

// Cor de cada banco (a da marca), para a barra de "Saldo em contas". Os escuros demais (C6, XP) ganham um cinza
// que aparece nos dois temas; banco fora da lista fica com a cor das iniciais dele.
const COR_BANCO = {
  nubank: "#820AD1", itau: "#EC7000", bradesco: "#CC092F", santander: "#EC0000", bb: "#F2C500", caixa: "#1C6FD1",
  inter: "#FF7A00", c6: "#7C7C84", picpay: "#21C25E", mercadopago: "#00A6E6", pagbank: "#12B886", neon: "#00A3FF",
  next: "#00C853", sicredi: "#3FA110", sicoob: "#00A091", btg: "#2F5FB3", xp: "#C9A400", rico: "#FF5A00",
  original: "#00A868", pan: "#00AEEF", will: "#E6C200", "porto cartao": "#0067B1", paypal: "#1F7AE0", wise: "#5FB82E",
};
export const corBanco = nome => COR_BANCO[marcaDe(nome)] || monograma(nome || "?").cor;

// Selo redondo do banco no canto inferior direito da logo (lançamento que veio do Open Finance)
export function SeloBanco({ banco }) {
  const nome = nomeBanco(banco);
  if (!nome) return null;
  return <span className="ps-selo" title={nome}><MarcaLogo marca={marcaDe(nome)} nome={nome} className="ps-selo-in" /></span>;
}

// "agora", "há 12 min", "há 2 h", "ontem", "há 3 dias"
function haQuanto(iso) {
  const t = Date.parse(iso || "");
  if (!t) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 6e4));
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}
const pct = (v, total) => (total > 0 ? Math.round((v / total) * 100) : 0);
const fmtPct = p => `${p.toFixed(1).replace(".", ",").replace(",0", "")}%`;

// O resumo do banco, um só para a tela toda: o carrossel do Início e este painel leem o mesmo, e abrir os dois
// juntos faz um pedido só. (resumoBanco já guarda 15 minutos no aparelho: pedir de novo ao abrir não vai à internet)
let BANCO = { r: (g => (g && g.dados && g.dados.ligado ? g.dados : null))(resumoGuardado()), carregando: false };
let EM_VOO = null, LIDO = 0;
const OUVINTES_BANCO = new Set();
const mudarBanco = n => {
  // o mesmo resumo de antes (lido de novo do aparelho): nada redesenha
  if (n.r !== undefined && n.r && BANCO.r && n.r.em === BANCO.r.em && !n.r.erro === !BANCO.r.erro && (n.carregando === undefined || n.carregando === BANCO.carregando)) return;
  if (n.r === null && !BANCO.r && (n.carregando === undefined || n.carregando === BANCO.carregando)) return;
  BANCO = { ...BANCO, ...n }; OUVINTES_BANCO.forEach(f => f());
};
// forcar: o "Atualizar" do painel (mostra "Atualizando…" e vai ao banco mesmo com o resumo guardado)
export function carregarBanco(forcar) {
  if (EM_VOO && !forcar) return EM_VOO;
  LIDO = Date.now();
  if (forcar) mudarBanco({ carregando: true });
  return (EM_VOO = resumoBanco(forcar).then(d => mudarBanco({ r: d && d.ligado ? d : null, carregando: false }), () => mudarBanco({ carregando: false })).finally(() => { EM_VOO = null; }));
}
const ouvirBanco = f => { OUVINTES_BANCO.add(f); return () => OUVINTES_BANCO.delete(f); };
// { r, carregando }: r só existe com a opção liberada para a conta (ligado); sem banco conectado, r.bancos vem vazio
export function useResumoBanco() {
  const v = useSyncExternalStore(ouvirBanco, () => BANCO);
  // cada cartão que usa o resumo pede ao abrir; dentro de um minuto, vale o que já foi lido (a não ser que o resumo
  // guardado tenha sido esquecido ou trocado: banco conectado ou desligado em Importar)
  useEffect(() => {
    const g = resumoGuardado(), r = BANCO.r;
    if (Date.now() - LIDO > 6e4 || !g || (r && (!g.dados || g.dados.em !== r.em))) carregarBanco(false);
  }, []);
  return v;
}
// Totais do banco (os mesmos números no carrossel do Início e no painel)
export function totaisBanco(r) {
  const contas = r && r.contas ? r.contas.filter(c => c.tipo === "conta") : [], cartoes = r && r.contas ? r.contas.filter(c => c.tipo === "cartao") : [], inv = (r && r.investimentos) || [];
  const limite = cartoes.reduce((s, c) => s + (c.limite > 0 ? c.limite : 0), 0);
  const usado = cartoes.reduce((s, c) => s + (c.limite > 0 && c.livre != null ? Math.max(0, c.limite - c.livre) : 0), 0);
  return {
    contas, cartoes, inv, limite, usado,
    emConta: contas.reduce((s, c) => s + c.saldo, 0), faturas: cartoes.reduce((s, c) => s + Math.max(0, c.saldo), 0),
    investido: inv.reduce((s, i) => s + i.saldo, 0), rendeu: inv.reduce((s, i) => s + (i.rendeu || 0), 0),
    vence: cartoes.map(c => c.vence).filter(Boolean).sort()[0] || null,
  };
}
// Caixinhas ligadas a um investimento: o valor do banco substitui a estimativa. Roda no carrossel do Início do Pessoal
// (que está sempre lá), e não só no painel: o cartão do banco pode estar desligado em "Personalizar início"
export function useCaixinhasNoBanco(caixinhas, act) {
  const { r } = useResumoBanco();
  useEffect(() => {
    if (!r || !r.investimentos || r.erro) return;
    const mud = {};
    (caixinhas || []).forEach(cx => {
      const inv = cx.banco && r.investimentos.find(i => i.id === cx.banco.inv);
      if (inv && (inv.saldo !== cx.banco.valor || inv.aplicado !== cx.banco.aplicado)) mud[cx.id] = { ...cx.banco, valor: inv.saldo, aplicado: inv.aplicado, em: r.em };
    });
    if (Object.keys(mud).length) act.bancoNasCaixinhas(mud);
  }, [r]);
}
// O carrossel do Início abre o painel na aba certa (Faturas → Cartões, Investido → Investimentos)
export const ABRIR_ABA_BANCO = "avina-banco-aba";

export function BancosPainel({ caixinhas, act, id }) {
  const { r, carregando } = useResumoBanco();
  const [aba, setAba] = useState(null);
  const carregar = forcar => carregarBanco(forcar);
  useEffect(() => { const f = e => setAba(e.detail); window.addEventListener(ABRIR_ABA_BANCO, f); return () => window.removeEventListener(ABRIR_ABA_BANCO, f); }, []);


  // a parte de cada banco no total em conta (para a barra colorida)
  const contas = useMemo(() => (r && r.contas ? r.contas.filter(c => c.tipo === "conta") : []), [r]);
  const porBanco = useMemo(() => {
    const m = new Map();
    contas.forEach(c => { const n = nomeBanco(c.banco) || c.nome; m.set(n, (m.get(n) || 0) + Math.max(0, c.saldo)); });
    return [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [contas]);

  if (!r || !r.ligado || !(r.bancos || []).length) return null;
  const { cartoes, inv, emConta, faturas, limite, usado: usadoTotal, investido, rendeu: rendeuTotal } = totaisBanco(r);
  const positivo = porBanco.reduce((s, x) => s + x[1], 0);
  const hoje = todayISO();
  const atualizado = c => haQuanto(((r.bancos || []).find(b => b.id === c.itemId) || {}).atualizado || r.em);
  const ligada = id => (caixinhas || []).find(cx => cx.banco && cx.banco.inv === id);
  const virarCaixinha = (i, alvo) => {
    const banco = { inv: i.id, nome: i.nome, valor: i.saldo, aplicado: i.aplicado, em: r.em };
    if (alvo === "nova") act.salvarCaixinha({ id: uid(), nome: i.nome.slice(0, 40), emoji: "🏦", movs: [], banco });
    else { const cx = caixinhas.find(x => x.id === alvo); if (cx) act.salvarCaixinha({ ...cx, banco }); }
  };
  const pede = (r.bancos || []).filter(b => b.status === "LOGIN_ERROR" || b.status === "OUTDATED");
  const abas = [contas.length && ["contas", "Contas"], cartoes.length && ["cartoes", cartoes.length === 1 ? "Cartão" : "Cartões"], inv.length && ["inv", "Investimentos"]].filter(Boolean);
  const vendo = abas.some(a => a[0] === aba) ? aba : (abas[0] || [])[0];
  const logo = c => <MarcaLogo marca={marcaDe(c.banco, c.nome)} nome={nomeBanco(c.banco) || c.nome} className="txn-av" />;

  return (
    <section className="panel bancos ps-bk" id={id}>
      <div className="panel-head">
        <h3>No banco agora</h3>
        <button className="link ps-bk-at" onClick={() => carregar(true)} disabled={carregando}>{carregando ? "Atualizando…" : `Atualizado ${haQuanto(r.em) || "agora"}`}</button>
      </div>
      {abas.length > 1 && <div className="ps-bk-abas" role="tablist" aria-label="O que ver">
        {abas.map(([k, l]) => <button key={k} role="tab" aria-selected={vendo === k} className={vendo === k ? "on" : ""} onClick={() => setAba(k)}>{l}</button>)}
      </div>}

      {vendo === "contas" && <div className="ps-bk-corpo" key="contas">
        <span className="ps-bk-rot">Saldo em contas</span>
        <b className={"ps-bk-total" + (emConta < 0 ? " neg" : "")}><Money v={emConta} /></b>
        {porBanco.length > 0 && <div className="ps-bk-barra" role="img" aria-label={porBanco.map(([n, v]) => `${n} ${pct(v, positivo)}%`).join(", ")}>
          {porBanco.map(([n, v], k) => <i key={n} style={{ flexGrow: v, background: corBanco(n), "--i": k }} />)}
        </div>}
        {contas.map(c => (
          <div key={c.id} className="ps-bk-linha">
            {logo(c)}
            <span className="ps-bk-mid">
              <span className="ps-bk-nm">{nomeBanco(c.banco) || c.nome}{c.final ? <small> ·{c.final}</small> : null}</span>
              <span className="ps-bk-sb">Atualizado {atualizado(c)}{c.especialUsado > 0 ? ` · usando ${brl(c.especialUsado)} do cheque especial` : ""}</span>
            </span>
            <span className="ps-bk-dir">
              <b className={c.saldo < 0 ? "neg" : ""}>{brl(c.saldo)}</b>
              {positivo > 0 && c.saldo > 0 && <small>{pct(c.saldo, positivo)}%</small>}
            </span>
          </div>
        ))}
      </div>}

      {vendo === "cartoes" && <div className="ps-bk-corpo" key="cartoes">
        <div className="ps-bk-topo">
          <span><span className="ps-bk-rot">Total em faturas</span><b className="ps-bk-total"><Money v={faturas} /></b></span>
          {limite > 0 && <Anel p={usadoTotal / limite} tam={58} esp={6} cor={usadoTotal / limite > .8 ? "var(--rose)" : "var(--mode)"} className="ps-bk-anel"><b>{pct(usadoTotal, limite)}%</b></Anel>}
        </div>
        {limite > 0 && <span className="ps-bk-sb">{brl(usadoTotal)} usados de {brl(limite)} de limite · {brl(Math.max(0, limite - usadoTotal))} livres</span>}
        {cartoes.map(c => {
          const d = c.vence ? diffDias(hoje, c.vence) : null;
          const usado = c.limite > 0 && c.livre != null ? Math.min(1, Math.max(0, 1 - c.livre / c.limite)) : null;
          const perto = d != null && d >= 0 && d <= 5 && c.saldo > 0;
          return (
            <div key={c.id} className="ps-bk-linha">
              {/* o anel em volta da logo é o limite usado do cartão */}
              {usado != null ? <Anel p={usado} tam={48} esp={3} cor={usado > .8 ? "var(--rose)" : "var(--mode)"} className="ps-bk-anel ps-bk-anel-logo">{logo(c)}</Anel> : logo(c)}
              <span className="ps-bk-mid">
                <span className="ps-bk-nm">{nomeBanco(c.banco) ? `${nomeBanco(c.banco)} ${c.nome !== nomeBanco(c.banco) ? c.nome : ""}`.trim() : c.nome}{c.final ? <small> ·{c.final}</small> : null}</span>
                <span className="ps-bk-sb">
                  <em className={perto ? "perto" : ""}>{c.vence ? `Vence ${d === 0 ? "hoje" : d === 1 ? "amanhã" : d > 1 && d <= 7 ? `em ${d} dias` : `dia ${dm(c.vence)}`}` : "Fatura aberta"}</em>{c.livre != null ? ` · livre ${brl(c.livre)}` : ""}
                </span>
              </span>
              <span className="ps-bk-dir"><b>{brl(c.saldo)}</b><small>{usado != null ? `${Math.round(usado * 100)}% do limite` : "fatura"}</small></span>
            </div>
          );
        })}
      </div>}

      {vendo === "inv" && <div className="ps-bk-corpo" key="inv">
        <span className="ps-bk-rot">Investido</span>
        <b className="ps-bk-total"><Money v={investido} /></b>
        {rendeuTotal !== 0 && <span className={"ps-bk-rendeu" + (rendeuTotal < 0 ? " neg" : "")}>{rendeuTotal > 0 ? "Rendeu +" : "Variou "}{brl(rendeuTotal)}{investido - rendeuTotal > 0 ? ` (${rendeuTotal > 0 ? "+" : ""}${fmtPct((rendeuTotal / (investido - rendeuTotal)) * 100)})` : ""}</span>}
        {inv.map(i => {
          const cx = ligada(i.id), livres = (caixinhas || []).filter(x => !x.banco);
          const base = i.aplicado > 0 ? i.aplicado : i.saldo - (i.rendeu || 0);
          return (
            <div key={i.id} className="ps-bk-linha">
              <span className="ps-at-av">
                {cx ? <span className="txn-av ps-bk-cx" aria-hidden="true">{cx.emoji || "🛟"}</span> : <MarcaLogo marca={marcaDe(i.banco)} nome={nomeBanco(i.banco) || i.nome} className="txn-av" />}
                {cx && <SeloBanco banco={i.banco} />}
              </span>
              <span className="ps-bk-mid">
                <span className="ps-bk-nm">{i.nome}</span>
                <span className="ps-bk-sb">
                  {nomeBanco(i.banco) || "Investimento"}
                  {i.rendeu ? <> · <em className={i.rendeu > 0 ? "sobe" : "neg"}>{i.rendeu > 0 ? "rendeu +" : "variou "}{brl(i.rendeu)}{base > 0 ? ` (${i.rendeu > 0 ? "+" : ""}${fmtPct((i.rendeu / base) * 100)})` : ""}</em></> : null}
                  {cx ? <> · na caixinha <b>{cx.nome}</b></> : null}
                </span>
              </span>
              <span className="ps-bk-dir"><b>{brl(i.saldo)}</b>{investido > 0 && <small>{pct(i.saldo, investido)}%</small>}</span>
              {!cx && <span className="ps-bk-ligar">
                <select className="bk-ligar" value="" onChange={e => e.target.value && virarCaixinha(i, e.target.value)} aria-label="Usar numa caixinha">
                  <option value="">Usar numa caixinha…</option>
                  <option value="nova">Criar uma caixinha com ele</option>
                  {livres.map(x => <option key={x.id} value={x.id}>Ligar à {x.nome}</option>)}
                </select>
              </span>}
            </div>
          );
        })}
      </div>}

      {pede.length > 0 && <button className="note bk-aviso" onClick={act.importarDoBanco}><I.alert /><span>{pede.map(b => b.nome).join(", ")} pediu para autorizar de novo. Toque para abrir.</span></button>}
      {r.erro && <div className="note"><I.alert /><span>Não consegui atualizar agora ({r.erro}). Mostrando os últimos valores.</span></div>}
      <button className="btn ghost bk-trazer" onClick={act.importarDoBanco}><I.down /> Trazer lançamentos novos</button>
      <p className="din-rodape">Pelo Open Finance. O banco manda os dados uma vez por dia, mais ou menos. Desligar: Importar → Direto do banco.</p>
    </section>
  );
}
