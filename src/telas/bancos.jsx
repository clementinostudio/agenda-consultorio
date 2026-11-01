// Painel "No banco agora": saldos das contas, cartões (fatura e limite) e investimentos, pelo Open Finance (src/banco.js).
// Só aparece para quem tem a opção liberada e algum banco conectado.
// Também daqui: o selo do banco que vai no canto da logo de um lançamento que veio do Open Finance.
import React, { useEffect, useMemo, useState } from "react";
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

export function BancosPainel({ caixinhas, act }) {
  const [r, setR] = useState(() => { const g = resumoGuardado(); return g && g.dados && g.dados.ligado ? g.dados : null; });
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState(null);
  const carregar = async forcar => { setCarregando(true); const d = await resumoBanco(forcar); setR(d); setCarregando(false); };
  useEffect(() => { carregar(false); }, []);

  // caixinhas ligadas a um investimento: o valor do banco substitui a estimativa
  useEffect(() => {
    if (!r || !r.investimentos || r.erro) return;
    const mud = {};
    (caixinhas || []).forEach(cx => {
      const inv = cx.banco && r.investimentos.find(i => i.id === cx.banco.inv);
      if (inv && (inv.saldo !== cx.banco.valor || inv.aplicado !== cx.banco.aplicado)) mud[cx.id] = { ...cx.banco, valor: inv.saldo, aplicado: inv.aplicado, em: r.em };
    });
    if (Object.keys(mud).length) act.bancoNasCaixinhas(mud);
  }, [r]);

  // a parte de cada banco no total em conta (para a barra colorida)
  const contas = useMemo(() => (r && r.contas ? r.contas.filter(c => c.tipo === "conta") : []), [r]);
  const porBanco = useMemo(() => {
    const m = new Map();
    contas.forEach(c => { const n = nomeBanco(c.banco) || c.nome; m.set(n, (m.get(n) || 0) + Math.max(0, c.saldo)); });
    return [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [contas]);

  if (!r || !r.ligado || !(r.bancos || []).length) return null;
  const cartoes = r.contas.filter(c => c.tipo === "cartao"), inv = r.investimentos || [];
  const emConta = contas.reduce((s, c) => s + c.saldo, 0), positivo = porBanco.reduce((s, x) => s + x[1], 0);
  const faturas = cartoes.reduce((s, c) => s + Math.max(0, c.saldo), 0);
  const limite = cartoes.reduce((s, c) => s + (c.limite > 0 ? c.limite : 0), 0);
  const usadoTotal = cartoes.reduce((s, c) => s + (c.limite > 0 && c.livre != null ? Math.max(0, c.limite - c.livre) : 0), 0);
  const investido = inv.reduce((s, i) => s + i.saldo, 0), rendeuTotal = inv.reduce((s, i) => s + (i.rendeu || 0), 0);
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
    <section className="panel bancos ps-bk">
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
              {usado != null ? <Anel p={usado} tam={48} esp={3} cor={usado > .8 ? "var(--rose)" : "var(--mode)"} className="ps-bk-anel logo">{logo(c)}</Anel> : logo(c)}
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
