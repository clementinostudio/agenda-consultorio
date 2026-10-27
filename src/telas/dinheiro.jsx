// Dinheiro rendendo (modo Pessoal): caixinhas com meta, "à vista ou parcelado?" e modo viagem.
// Usa as cotações de src/cotacoes.js (CDI, IPCA e câmbio, gratuitos e guardados para funcionar offline).
import React, { useState } from "react";
import { I, Sheet, Field, Toggle, ConfirmButton, brl, brlReal, num, soNumero, fmtNum, uid, todayISO, soma, MES_LONGO, diffDias, ESCONDER, Money, relativo, Ilustra } from "../App.jsx";
import { useCotacoes, MOEDAS, CODIGOS, emReais, fmtMoeda, fmtTaxa, fmtPct, quandoTxt, IOF_CARTAO } from "../cotacoes.js";

/* ---------- contas financeiras ---------- */
const mensal = anual => Math.pow(1 + anual / 100, 1 / 12) - 1;
// IR regressivo de renda fixa (CDB, Tesouro): quanto mais tempo aplicado, menos imposto
const irDoPrazo = meses => (meses <= 6 ? 22.5 : meses <= 12 ? 20 : meses <= 24 ? 17.5 : 15);
const rendeu = (valor, dias, cdi) => valor * (Math.pow(1 + cdi / 100, Math.max(0, dias) / 365) - 1);
const mesesAte = prazo => {
  if (!prazo) return 0;
  const [y, m] = prazo.split("-").map(Number); const h = new Date();
  return (y * 12 + m) - (h.getFullYear() * 12 + h.getMonth() + 1);
};
const nomeMes = prazo => { if (!prazo) return ""; const [y, m] = prazo.split("-").map(Number); return `${MES_LONGO[m - 1].toLowerCase()} de ${y}`; };
const simbolo = m => fmtMoeda(0, m).replace(/[\d\s.,]/g, "").trim() || m;
const oculto = (txt) => (ESCONDER ? "•••" : txt);

// Situação de uma caixinha: quanto foi guardado, quanto rendeu (estimado a 100% do CDI) e quanto falta por mês
export function contaCaixinha(cx, cot) {
  const hoje = todayISO();
  const movs = cx.movs || [];
  const guardado = soma(movs, m => m.valor);
  const rend = Math.max(0, soma(movs, m => rendeu(m.valor, diffDias(m.data, hoje), cot.cdi)));
  const total = guardado + rend;
  const meta = cx.meta || 0;
  const pct = meta > 0 ? Math.min(100, (total / meta) * 100) : 0;
  const n = mesesAte(cx.prazo);
  let porMes = null;
  if (meta > 0 && cx.prazo && n > 0) {
    const i = mensal(cot.cdi);
    const falta = meta - total * Math.pow(1 + i, n);
    porMes = falta <= 0 ? 0 : (falta * i) / (Math.pow(1 + i, n) - 1);
  }
  // quanto rende num mês, com o que já tem (estimado a 100% do CDI)
  const rendeMes = total > 0 ? total * mensal(cot.cdi) : 0;
  return { guardado, rend, total, meta, pct, n, porMes, rendeMes, falta: Math.max(0, meta - total) };
}

/* ---------- ícones pequenos desta parte ---------- */
const Ic = {
  aviao: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 13.5L3 11l1.5-1.5 7.5 1L16.5 6a2.1 2.1 0 0 1 3 3L15 13.5l1 7.5-1.5 1.5-2.5-7.5L9 18v2.5L7.5 22l-1-3.5L3 17.5 4.5 16H7l3.5-2.5z" /></svg>,
  balanca: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7zM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7z" /></svg>,
  troca: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>,
};
const EMOJIS = ["🛟", "✈️", "🏠", "🚗", "🎓", "🎁", "💍", "🐶", "💻", "🏖️", "👶", "🩺"];

/* ---------- bloco "Seu dinheiro" na tela inicial do Pessoal ---------- */
export function DinheiroHome({ db, act }) {
  const cot = useCotacoes();
  const P = db.pessoal; const caixinhas = P.caixinhas || [];
  return (
    <>
      {P.viagem && <ViagemBanner viagem={P.viagem} lanc={P.lanc} cot={cot} act={act} />}
      <div className="panel dinheiro">
        <div className="panel-head"><h3>Seu dinheiro</h3>{caixinhas.length > 0 && <button className="link" onClick={() => act.abrirCaixinha()}>+ Caixinha</button>}</div>
        <div className="din-acts">
          <button className="din-act" onClick={() => act.abrirParcelado()}><i><Ic.balanca /></i><span>À vista ou<br />parcelado?</span></button>
          <button className="din-act" onClick={() => act.abrirViagem()}><i><Ic.aviao /></i><span>{P.viagem ? "Viagem" : "Modo"}<br />{P.viagem ? MOEDAS[P.viagem.moeda].curto.toLowerCase() : "viagem"}</span></button>
          <button className="din-act" onClick={() => act.abrirCaixinha()}><i><I.piggy /></i><span>Nova<br />caixinha</span></button>
        </div>
        {caixinhas.length === 0 ? (
          <button className="cx-vazia com-ilustra" onClick={() => act.abrirCaixinha()}>
            <Ilustra n="dinheiro" className="cx-vazia-img" />
            <b>Guarde para um objetivo</b>
            <span>Crie uma caixinha (viagem, reserva, carro…). Eu mostro quanto guardar por mês e quanto o dinheiro rende a 100% do CDI.</span>
          </button>
        ) : caixinhas.map(cx => {
          const r = contaCaixinha(cx, cot);
          return (
            <button key={cx.id} className="cx-row" onClick={() => act.abrirCaixinha(cx.id)}>
              <span className="cx-emoji" aria-hidden="true">{cx.emoji || "🛟"}</span>
              <span className="cx-mid">
                <span className="cx-nm">{cx.nome}</span>
                <span className="cx-bar"><i style={{ width: `${r.meta ? r.pct : 100}%` }} /></span>
                <span className="cx-sb">{r.meta ? <>{brl(r.total)} de {brl(r.meta)}{r.porMes > 0 ? ` · ${brl(r.porMes)}/mês` : r.porMes === 0 ? " · já chega lá rendendo" : ""}</> : <>{brl(r.total)} guardados{r.rendeMes >= 1 ? ` · rende ${brl(r.rendeMes)}/mês` : ""}</>}</span>
              </span>
              <span className="cx-pct">{r.meta ? `${Math.floor(r.pct)}%` : ""}</span>
            </button>
          );
        })}
        <p className="din-rodape">CDI {fmtPct(cot.cdi)} ao ano · inflação {fmtPct(cot.ipca)} em 12 meses · {cot.quandoIndices ? `Banco Central, ${quandoTxt(cot.quandoIndices)}` : "valores de referência"}</p>
      </div>
    </>
  );
}

/* ---------- modo viagem ---------- */
function gastosDaViagem(viagem, lanc) {
  const l = (lanc || []).filter(x => x.tipo === "saida" && x.moeda === viagem.moeda && x.data >= viagem.desde);
  return { orig: soma(l, x => x.valorOrig || 0), reais: soma(l, x => x.valor), n: l.length };
}
function ViagemBanner({ viagem, lanc, cot, act }) {
  const g = gastosDaViagem(viagem, lanc), M = MOEDAS[viagem.moeda];
  return (
    <button className="viagem-banner" onClick={() => act.abrirViagem()}>
      <span className="vb-flag" aria-hidden="true">{M.bandeira}</span>
      <span className="vb-mid">
        <b>Modo viagem · {M.nome}</b>
        <span>1 {simbolo(viagem.moeda)} = {oculto("R$ " + fmtTaxa(cot.moedas[viagem.moeda] * (viagem.iof === false ? 1 : 1 + IOF_CARTAO / 100)))}{viagem.iof === false ? "" : " com IOF"} · gastos: {oculto(fmtMoeda(g.orig, viagem.moeda))} ({brl(g.reais)})</span>
      </span>
      <I.chev />
    </button>
  );
}

function Conversor({ moeda, iof, cot }) {
  const taxa = (cot.moedas[moeda] || 0) * (iof ? 1 + IOF_CARTAO / 100 : 1);
  const [lado, setLado] = useState("fora");
  const [v, setV] = useState("");
  const n = num(v);
  const res = lado === "fora" ? n * taxa : taxa ? n / taxa : 0;
  return (
    <div className="conversor">
      <label className="conv-campo" htmlFor="conv-v">
        <span>{lado === "fora" ? simbolo(moeda) : "R$"}</span>
        <input id="conv-v" inputMode="decimal" placeholder="0,00" value={v} onChange={e => setV(soNumero(e.target.value))} aria-label="Valor para converter" />
      </label>
      <button type="button" className="conv-troca" onClick={() => { setLado(lado === "fora" ? "real" : "fora"); setV(res ? fmtNum(res) : ""); }} aria-label="Inverter"><Ic.troca /></button>
      <div className="conv-res"><span>{lado === "fora" ? "R$" : simbolo(moeda)}</span><b>{res ? (lado === "fora" ? fmtNum(res) : fmtMoeda(res, moeda).replace(/^[^\d-]+/, "")) : "0,00"}</b></div>
    </div>
  );
}

export function ViagemSheet({ viagem, lanc, act, onClose }) {
  const cot = useCotacoes();
  const [moeda, setMoeda] = useState(viagem ? viagem.moeda : "USD");
  const [iof, setIof] = useState(viagem ? viagem.iof !== false : true);
  if (viagem) {
    const g = gastosDaViagem(viagem, lanc), M = MOEDAS[viagem.moeda];
    return (
      <Sheet title={`${M.bandeira} Viagem · ${M.nome}`} sub={`Desde ${relativo(viagem.desde).toLowerCase()}. Gastos falados ou anotados vão em ${M.curto.toLowerCase()} e eu converto para reais.`} onClose={onClose}>
        <div className="viagem-tot">
          <div><span>Gasto na viagem</span><b>{oculto(fmtMoeda(g.orig, viagem.moeda))}</b></div>
          <div><span>Em reais{viagem.iof === false ? "" : " (com IOF)"}</span><b><Money v={g.reais} /></b></div>
        </div>
        <Conversor moeda={viagem.moeda} iof={viagem.iof !== false} cot={cot} />
        <p className="hint">Cotação comercial de {quandoTxt(cot.quandoMoedas)}: 1 {simbolo(viagem.moeda)} = R$ {fmtTaxa(cot.moedas[viagem.moeda])}{viagem.iof === false ? "" : ` + IOF de ${String(IOF_CARTAO).replace(".", ",")}%`}. O banco ainda pode cobrar um spread por cima.</p>
        <button className="btn ghost" onClick={act.encerrarViagem}><I.check /> Encerrar viagem</button>
      </Sheet>
    );
  }
  return (
    <Sheet title="Modo viagem" sub="Escolha a moeda do lugar. Enquanto estiver ligado, “gastei 20 no táxi” vale nessa moeda e eu converto para reais." onClose={onClose}>
      <div className="moedas-grid" role="radiogroup" aria-label="Moeda da viagem">
        {CODIGOS.map(c => (
          <button key={c} type="button" role="radio" aria-checked={moeda === c} className={"moeda-op" + (moeda === c ? " on" : "")} onClick={() => setMoeda(c)}>
            <span className="mo-flag" aria-hidden="true">{MOEDAS[c].bandeira}</span>
            <span className="mo-nm">{MOEDAS[c].curto}</span>
            <span className="mo-tx">R$ {fmtTaxa(cot.moedas[c] || 0)}</span>
          </button>
        ))}
      </div>
      <Toggle on={iof} onClick={() => setIof(!iof)}>Vou pagar no cartão (soma o IOF de {String(IOF_CARTAO).replace(".", ",")}%)</Toggle>
      <Conversor key={moeda + iof} moeda={moeda} iof={iof} cot={cot} />
      <button className="btn mode" onClick={() => act.iniciarViagem(moeda, iof)}><Ic.aviao /> Começar viagem</button>
    </Sheet>
  );
}

/* ---------- à vista ou parcelado ---------- */
function lerFrase(t) {
  // "1000 à vista ou 10x de 105", "1.200 a vista, 12 x 110", "10x de 99,90 ou 899 a vista"
  const s = t.toLowerCase().replace(/r\$\s*/g, "");
  const parc = s.match(/(\d{1,2})\s*x\s*(?:de\s*)?(\d[\d.]*(?:,\d{1,2})?)/);
  const vista = s.match(/(\d[\d.]*(?:,\d{1,2})?)\s*(?:reais\s*)?(?:a|à)\s*vista/) || s.match(/(?:a|à)\s*vista\s*(?:por|de)?\s*(\d[\d.]*(?:,\d{1,2})?)/);
  const n = x => (x ? fmtNum(num(x)) : "");
  return { vista: vista ? n(vista[1]) : null, n: parc ? Number(parc[1]) : null, parcela: parc ? n(parc[2]) : null };
}
function jurosEmbutidos(aVista, parcela, n, primeiraHoje) {
  const vp = r => { let s = 0; for (let k = primeiraHoje ? 0 : 1; k < n + (primeiraHoje ? 0 : 1); k++) s += parcela / Math.pow(1 + r, k); return s; };
  if (parcela * n <= aVista) return 0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (vp(mid) > aVista) lo = mid; else hi = mid; }
  return ((lo + hi) / 2) * 100;
}
export function ParceladoSheet({ onClose }) {
  const cot = useCotacoes();
  const [frase, setFrase] = useState("");
  const [vista, setVista] = useState("");
  const [n, setN] = useState(10);
  const [parcela, setParcela] = useState("");
  const [hoje, setHoje] = useState(false);
  const aplicar = t => { setFrase(t); const r = lerFrase(t); if (r.vista) setVista(r.vista); if (r.n) setN(Math.min(48, Math.max(1, r.n))); if (r.parcela) setParcela(r.parcela); };
  const av = num(vista), pc = num(parcela);
  const ok = av > 0 && pc > 0 && n > 0;
  let res = null;
  if (ok) {
    const ir = irDoPrazo(n), liq = cot.cdi * (1 - ir / 100), i = mensal(liq);
    let vp = 0; for (let k = hoje ? 0 : 1; k < n + (hoje ? 0 : 1); k++) vp += pc / Math.pow(1 + i, k);
    const total = pc * n, desc = total > 0 ? ((total - av) / total) * 100 : 0;
    const dif = av - vp; // > 0: parcelado sai mais barato em valor de hoje
    res = { ir, liq, vp, total, desc, dif, juros: jurosEmbutidos(av, pc, n, hoje), rende: av - (hoje ? pc : 0) };
  }
  const empate = res && Math.abs(res.dif) < Math.max(5, res.total * 0.005);
  return (
    <Sheet title="À vista ou parcelado?" sub="Compara o desconto à vista com o quanto o seu dinheiro renderia enquanto você paga as parcelas." onClose={onClose}>
      <div className="voice">
        <input value={frase} onChange={e => aplicar(e.target.value)} placeholder='Escreva: "1.000 à vista ou 10x de 105"' enterKeyHint="done" autoComplete="off" aria-label="Descreva a oferta" />
      </div>
      <div className="fields">
        <Field label="Preço à vista (R$)" icon={<I.money />} htmlFor="pv-vista"><input id="pv-vista" inputMode="decimal" placeholder="0,00" value={vista} onChange={e => setVista(soNumero(e.target.value))} /></Field>
        <Field label="Número de parcelas">
          <div className="stepper">
            <button type="button" aria-label="Menos parcelas" onClick={() => setN(Math.max(1, n - 1))}>−</button>
            <b className="num">{n}x</b>
            <button type="button" aria-label="Mais parcelas" onClick={() => setN(Math.min(48, n + 1))}>+</button>
          </div>
        </Field>
        <Field label="Valor de cada parcela (R$)" icon={<I.money />} htmlFor="pv-parc"><input id="pv-parc" inputMode="decimal" placeholder="0,00" value={parcela} onChange={e => setParcela(soNumero(e.target.value))} /></Field>
      </div>
      <Toggle on={hoje} onClick={() => setHoje(!hoje)}>A 1ª parcela é paga na hora da compra</Toggle>
      {!ok && <div className="hint">Preencha o preço à vista e o valor da parcela.</div>}
      {res && (
        <div className={"veredito " + (empate ? "neutro" : res.dif > 0 ? "parcelado" : "avista")}>
          <span className="vd-tag">{empate ? "Tanto faz" : res.dif > 0 ? "Parcelado compensa" : "À vista compensa"}</span>
          <b className="vd-big">{empate ? "Diferença de centavos" : `${brl(Math.abs(res.dif))} de vantagem`}</b>
          <p>
            {empate ? <>O desconto à vista é praticamente igual ao que o dinheiro renderia. Escolha o que deixa o seu mês mais tranquilo.</>
              : res.dif > 0 ? <>Se você deixar os {brl(res.rende)} aplicados e for tirando as parcelas, o rendimento cobre a diferença e ainda sobram {brl(res.dif)} (em dinheiro de hoje).</>
              : <>O desconto à vista é maior do que o seu dinheiro renderia nesse tempo: pagando à vista você economiza {brl(-res.dif)} (em dinheiro de hoje).</>}
          </p>
          <div className="vd-linhas">
            <div><span>Total parcelado</span><b>{brl(res.total)}</b></div>
            <div><span>Desconto à vista</span><b>{res.desc > 0 ? fmtPct(res.desc, 1) : "nenhum"}</b></div>
            <div><span>Juros escondidos no parcelado</span><b>{res.juros > 0 ? `${fmtPct(res.juros)} ao mês` : "nenhum"}</b></div>
            <div><span>Rendimento usado</span><b>{fmtPct(res.liq)} ao ano</b></div>
          </div>
          <p className="vd-nota">Conta feita com 100% do CDI ({fmtPct(cot.cdi)} ao ano, {cot.quandoIndices ? `Banco Central, ${quandoTxt(cot.quandoIndices)}` : "valor de referência"}) já descontado o IR de {String(res.ir).replace(".", ",")}%. Vale para quem já tem o dinheiro: se for tirar da reserva de emergência ou usar o limite, a conta muda.</p>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- caixinhas ---------- */
function CaixinhaForm({ cx, act, onFeito, onClose }) {
  const [nome, setNome] = useState(cx ? cx.nome : "");
  const [emoji, setEmoji] = useState(cx ? cx.emoji || "🛟" : "✈️");
  const [meta, setMeta] = useState(cx && cx.meta ? fmtNum(cx.meta) : "");
  const [prazo, setPrazo] = useState(cx ? cx.prazo || "" : "");
  const [inicial, setInicial] = useState("");
  const ok = nome.trim().length > 0;
  const salvar = () => {
    const movs = cx ? cx.movs || [] : num(inicial) > 0 ? [{ id: uid(), data: todayISO(), valor: num(inicial) }] : [];
    const novo = { ...(cx || {}), id: cx ? cx.id : uid(), nome: nome.trim(), emoji, meta: num(meta), prazo: prazo || null, movs };
    act.salvarCaixinha(novo); onFeito(novo.id);
  };
  return (
    <>
      <div className="emojis" role="radiogroup" aria-label="Ícone">
        {EMOJIS.map(e => <button key={e} type="button" role="radio" aria-checked={emoji === e} className={"emo" + (emoji === e ? " on" : "")} onClick={() => setEmoji(e)}>{e}</button>)}
      </div>
      <div className="fields">
        <Field label="Para quê?" htmlFor="cx-nome"><input id="cx-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Viagem, Reserva de emergência" autoFocus={!cx} /></Field>
        <Field label="Meta (R$, opcional)" icon={<I.target />} htmlFor="cx-meta"><input id="cx-meta" inputMode="decimal" value={meta} onChange={e => setMeta(soNumero(e.target.value))} placeholder="0,00" /></Field>
        <Field label="Até quando? (opcional)" icon={<I.cal />} htmlFor="cx-prazo"><input id="cx-prazo" type="month" value={prazo} min={todayISO().slice(0, 7)} onChange={e => setPrazo(e.target.value)} /></Field>
        {!cx && <Field label="Já tem algo guardado? (R$)" icon={<I.money />} htmlFor="cx-ini"><input id="cx-ini" inputMode="decimal" value={inicial} onChange={e => setInicial(soNumero(e.target.value))} placeholder="0,00" /></Field>}
      </div>
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {cx ? "Salvar" : "Criar caixinha"}</button>
      {cx && <ConfirmButton label="Apagar caixinha" titulo="Apagar esta caixinha?" texto="O histórico de quanto você guardou nela também sai do app." acao="Apagar" onConfirm={() => act.apagarCaixinha(cx.id)} />}
    </>
  );
}

export function CaixinhaSheet({ cx, act, onClose }) {
  const cot = useCotacoes();
  const [editando, setEditando] = useState(!cx);
  const [v, setV] = useState("");
  if (!cx || editando) {
    return (
      <Sheet title={cx ? "Editar caixinha" : "Nova caixinha"} sub={cx ? null : "Um lugar para guardar com objetivo. Eu calculo quanto falta por mês."} onClose={onClose}>
        <CaixinhaForm cx={cx} act={act} onFeito={() => (cx ? setEditando(false) : onClose())} onClose={onClose} />
      </Sheet>
    );
  }
  const r = contaCaixinha(cx, cot);
  const ganhoReal = r.total * ((1 + cot.cdi / 100) / (1 + cot.ipca / 100) - 1);
  const perdaParado = r.total * (cot.ipca / 100);
  const movs = [...(cx.movs || [])].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
  const valor = num(v);
  return (
    <Sheet title={`${cx.emoji || "🛟"} ${cx.nome}`} sub={cx.prazo ? `Meta para ${nomeMes(cx.prazo)}` : "Sem prazo definido"} onClose={onClose}>
      <div className="cx-topo">
        <span>Na caixinha (com rendimento estimado)</span>
        <b className="cx-total"><Money v={r.total} /></b>
        {r.meta > 0 && <><div className="cx-bar grande"><i style={{ width: `${r.pct}%` }} /></div><span className="cx-meta">{Math.floor(r.pct)}% de {brl(r.meta)}{r.falta > 0 ? ` · faltam ${brl(r.falta)}` : " · meta batida! 🎉"}</span></>}
      </div>
      <div className="cx-cards">
        <div className="cx-card"><span>Guardado por você</span><b><Money v={r.guardado} /></b></div>
        <div className="cx-card ok"><span>Rendeu (estimado)</span><b>+<Money v={r.rend} /></b></div>
        {r.rendeMes >= 0.01 && <div className="cx-card ok"><span>Rende por mês</span><b>+<Money v={r.rendeMes} /></b></div>}
        {r.porMes !== null && <div className="cx-card destaque"><span>{r.n <= 0 ? "Prazo" : `Guarde por mês até ${nomeMes(cx.prazo)}`}</span><b>{r.n <= 0 ? "venceu" : r.porMes === 0 ? "nada: já chega lá" : <Money v={r.porMes} />}</b></div>}
      </div>
      <div className="cx-inflacao">
        <p>Rendendo a <b>100% do CDI</b> ({fmtPct(cot.cdi)} ao ano), esse dinheiro ganha cerca de <b>{brl(Math.max(0, ganhoReal))} por ano acima da inflação</b>.</p>
        <p>Se ficasse parado na conta corrente, perderia uns <b>{brl(perdaParado)} por ano</b> para a inflação ({fmtPct(cot.ipca)} em 12 meses).</p>
      </div>
      <div className="cx-mover">
        <label className="conv-campo" htmlFor="cx-v"><span>R$</span><input id="cx-v" inputMode="decimal" placeholder="0,00" value={v} onChange={e => setV(soNumero(e.target.value))} aria-label="Valor" /></label>
        <button className="btn mode" disabled={!(valor > 0)} onClick={() => { act.moverCaixinha(cx.id, valor); setV(""); }}><I.plus /> Guardar</button>
        <button className="btn ghost" disabled={!(valor > 0) || valor > r.guardado + 0.001} onClick={() => { act.moverCaixinha(cx.id, -valor); setV(""); }}><I.minus /> Tirar</button>
      </div>
      <div className="cx-auto">
        <span><b>Separar sozinho de cada entrada</b><small>{cx.autoPct ? `Quando entrar dinheiro (salário, extra), ${cx.autoPct}% vem para cá.` : "Quando entrar dinheiro, uma parte já vem para cá."}</small></span>
        <div className="cx-auto-op" role="radiogroup" aria-label="Porcentagem separada">{[0, 5, 10, 15, 20].map(p => <button key={p} type="button" role="radio" aria-checked={(cx.autoPct || 0) === p} className={(cx.autoPct || 0) === p ? "on" : ""} onClick={() => act.salvarCaixinha({ ...cx, autoPct: p })}>{p ? `${p}%` : "Não"}</button>)}</div>
      </div>
      {movs.length > 0 && (
        <div className="cx-hist">
          <h4>Histórico</h4>
          {movs.map(m => <div key={m.id} className="cx-mov"><span>{relativo(m.data)}{m.auto ? " · automático" : ""}</span><b className={m.valor > 0 ? "pos" : ""}>{m.valor > 0 ? "+" : "−"}{brl(Math.abs(m.valor))}</b></div>)}
        </div>
      )}
      <p className="vd-nota">O rendimento é uma estimativa a 100% do CDI, antes do imposto de renda. Confira o valor real no app do seu banco.</p>
      <button className="btn ghost" onClick={() => setEditando(true)}><I.pencil /> Editar caixinha</button>
    </Sheet>
  );
}
