// Assinatura do Avina: planos, pagamento, garantia de 7 dias, pausar, cancelar e indicação.
// Sem teste grátis: quem quer conhecer usa a demonstração; quem assina tem 7 dias para desistir com o dinheiro de volta.
// Por enquanto é só demonstração: nada é cobrado e tudo fica guardado neste aparelho.
// Quando ligar o Asaas, quem muda o "status" é o aviso de pagamento do servidor, não estes botões.
import React, { useState, useEffect } from "react";
import { I, Marca, Seg, Field, Ilustra, todayISO, addDays, fromISO, pad, brlReal, MES_LONGO, vibrar, copiarTexto, lerJSON } from "../App.jsx";
import { normalizar } from "../marcas.js";
import { ENDERECO_APP } from "../nuvem.js";

const GARANTIA_DIAS = 7;  // direito de arrependimento (compra pela internet)
const LIMITE_INDICACOES = 12; // meses ganhos por indicação, por ano
const PLANOS = {
  anual: { nome: "Anual", preco: 299, ciclo: "ano", meses: 12, selo: "2 meses grátis" },
  mensal: { nome: "Mensal", preco: 29.9, ciclo: "mês", meses: 1 },
};
const INCLUI = ["Agenda, pacientes e cobranças sem limite", "Gastos, contas e transporte da vida pessoal", "Avisos no celular e anotações por voz", "Cópia na nuvem e uso em vários aparelhos"];
const MOTIVOS = ["Ficou caro", "Não estou usando", "Faltou alguma coisa", "Vou usar outro app", "Outro motivo"];
const COLEGAS_DEMO = ["Marina Torres", "João Pedro Alves", "Fernanda Lima", "Lucas Barros"];
const TITULO_ASSIN = { indicar: "Indique um colega", planos: "Escolha seu plano", pagar: "Pagamento", pronto: "Assinatura", forma: "Forma de pagamento", historico: "Pagamentos", pausar: "Pausar assinatura", cancelar: "Cancelar assinatura" };
const voltaAssin = tela => tela === "pagar" ? "planos" : null;

const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addMeses = (iso, n) => { const d = fromISO(iso); d.setMonth(d.getMonth() + n); return isoDe(d); };
const dias = (de, ate) => Math.round((fromISO(ate) - fromISO(de)) / 864e5);
const dataLonga = iso => { const d = fromISO(iso); return `${d.getDate()} de ${MES_LONGO[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ""}`; };
const porMes = p => brlReal(Math.round(p.preco / p.meses * 100) / 100);
const semPlano = () => ({ status: "sem", historico: [] });
// Meses grátis para usar ao assinar: o do código de indicação (só na primeira vez) e os guardados por indicar colegas
const mesesGratis = a => (a.codigoUsado && !a.desde ? 1 : 0) + (a.guardados || 0);
// Garantia: cancelar até 7 dias depois do primeiro pagamento devolve tudo
const naGarantia = a => (a.historico || []).length === 1 && !a.historico[0].devolvido && dias(a.historico[0].data, todayISO()) <= GARANTIA_DIAS;

// Indique um colega: código fixo de cada conta (primeiro nome + 3 números)
const codigoDe = conta => `${(normalizar(conta.nome).split(" ")[0] || "avina").toUpperCase().slice(0, 8)}-${Math.abs([...String(conta.email)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 900 + 100}`;
// Mês ganho por indicar: assinando, a próxima cobrança anda um mês; sem assinatura, o mês fica guardado
function ganharMes(a) {
  const sit = situacaoDe(a);
  if (sit.s === "sem" || sit.s === "acabou") return { ...a, guardados: (a.guardados || 0) + 1 };
  return { ...a, proxima: addMeses(a.proxima, 1), ...(a.status === "cancelada" ? { ate: addMeses(a.ate, 1) } : {}) };
}

function useAssinatura(conta) {
  const chave = `agenda-assinatura:${conta.email}`;
  // quem tinha o "teste grátis" da versão antiga começa sem plano (o código e as indicações continuam)
  const [a, setA] = useState(() => { const v = lerJSON(chave, null); return v && v.status !== "teste" ? v : { ...semPlano(), codigoUsado: v && v.codigoUsado, indicacoes: v && v.indicacoes }; });
  useEffect(() => { try { localStorage.setItem(chave, JSON.stringify(a)); } catch (e) {} }, [a]);
  return [a, setA];
}

// Situação de hoje: a pausa e o cancelamento terminam sozinhos na data
function situacaoDe(a) {
  const hoje = todayISO();
  if (a.status === "sem") return { s: "sem" };
  if (a.status === "pausada" && hoje < a.ate) return { s: "pausada" };
  if (a.status === "cancelada") return hoje < a.ate ? { s: "cancelada" } : { s: "acabou" };
  return { s: "ativa" };
}

function resumoAssinatura(a) {
  const sit = situacaoDe(a), P = PLANOS[a.plano];
  if (sit.s === "sem") return { texto: mesesGratis(a) ? `Você tem ${mesesGratis(a) === 1 ? "1 mês grátis" : `${mesesGratis(a)} meses grátis`} para usar` : "Escolha um plano · garantia de 7 dias" };
  if (sit.s === "acabou") return { texto: "Escolha um plano para continuar", selo: "Acabou" };
  if (sit.s === "ativa" && !(a.historico || []).length) return { texto: `${P.nome} · grátis até ${dataLonga(a.proxima)}` };
  if (sit.s === "pausada") return { texto: `Pausada até ${dataLonga(a.ate)}` };
  if (sit.s === "cancelada") return { texto: `Cancelada · você usa até ${dataLonga(a.ate)}` };
  return { texto: `${P.nome} · renova em ${dataLonga(a.proxima)}` };
}

// Um QR de mentirinha, só para a demonstração (o de verdade vem do Asaas)
function QrFalso() {
  const n = 25; let s = 11, d = "";
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const canto = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!canto(x, y) && rnd() > .5) d += `M${x} ${y}h1v1h-1z`;
  const olho = (x, y) => <g key={`${x}-${y}`}><rect x={x} y={y} width="7" height="7" fill="#111" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#111" /></g>;
  return (
    <svg className="assin-qr" viewBox="-2 -2 29 29" shapeRendering="crispEdges" role="img" aria-label="QR Code do Pix (exemplo)">
      <rect x="-2" y="-2" width="29" height="29" fill="#fff" />
      <path d={d} fill="#111" />
      {olho(0, 0)}{olho(n - 7, 0)}{olho(0, n - 7)}
    </svg>
  );
}

function CamposCartao({ c, setC }) {
  const so = (v, max) => v.replace(/\D/g, "").slice(0, max);
  return (
    <div className="fields">
      <Field label="Número do cartão" icon={<I.money />} htmlFor="c-num"><input id="c-num" inputMode="numeric" autoComplete="cc-number" value={c.num.replace(/(\d{4})(?=\d)/g, "$1 ")} onChange={e => setC({ ...c, num: so(e.target.value, 16) })} placeholder="0000 0000 0000 0000" /></Field>
      <div className="assin-duas">
        <Field label="Validade" htmlFor="c-val"><input id="c-val" inputMode="numeric" autoComplete="cc-exp" value={c.val.length > 2 ? `${c.val.slice(0, 2)}/${c.val.slice(2)}` : c.val} onChange={e => setC({ ...c, val: so(e.target.value, 4) })} placeholder="MM/AA" /></Field>
        <Field label="CVV" htmlFor="c-cvv"><input id="c-cvv" inputMode="numeric" autoComplete="cc-csc" value={c.cvv} onChange={e => setC({ ...c, cvv: so(e.target.value, 4) })} placeholder="123" /></Field>
      </div>
      <Field label="Nome impresso no cartão" icon={<I.user />} htmlFor="c-nome"><input id="c-nome" autoComplete="cc-name" autoCapitalize="characters" value={c.nome} onChange={e => setC({ ...c, nome: e.target.value.toUpperCase() })} placeholder="COMO ESTÁ NO CARTÃO" /></Field>
    </div>
  );
}
const cartaoOk = c => c.num.length >= 13 && c.val.length === 4 && Number(c.val.slice(0, 2)) >= 1 && Number(c.val.slice(0, 2)) <= 12 && c.cvv.length >= 3 && c.nome.trim().length > 2;
const CARTAO_VAZIO = { num: "", val: "", cvv: "", nome: "" };
const formaTxt = a => a.forma === "cartao" ? `Cartão final ${a.final}` : "Pix";

function AssinaturaPagina({ a, setA, tela, setTela, act, conta }) {
  const sit = situacaoDe(a), hoje = todayISO();
  const [codigo, setCodigo] = useState("");
  const [comCodigo, setComCodigo] = useState(false);
  const meuCodigo = codigoDe(conta);
  const [plano, setPlano] = useState(a.plano || "anual");
  const [forma, setForma] = useState(a.forma || "pix");
  const [cartao, setCartao] = useState(CARTAO_VAZIO);
  const [conferindo, setConferindo] = useState(false);
  const [meses, setMeses] = useState(1);
  const [motivo, setMotivo] = useState(null);
  const P = PLANOS[plano], atual = PLANOS[a.plano];
  const gratis = mesesGratis(a);
  // Quem já assina só troca o plano para a próxima renovação (sem cobrar a diferença)
  const trocando = sit.s === "ativa";

  useEffect(() => { setConferindo(false); if (tela === "forma") { setForma(a.forma || "pix"); setCartao(CARTAO_VAZIO); } }, [tela]);

  const assinar = () => {
    // com meses grátis nada é cobrado hoje: a primeira cobrança vem depois deles
    const proxima = gratis ? addMeses(hoje, gratis) : addMeses(hoje, P.meses);
    setA({ ...a, status: "ativa", ate: null, plano, forma, final: forma === "cartao" ? cartao.num.slice(-4) : null, desde: a.desde || hoje, proxima, guardados: 0,
      historico: gratis ? (a.historico || []) : [{ data: hoje, valor: P.preco, plano, forma }, ...(a.historico || [])] });
    setCartao(CARTAO_VAZIO); vibrar("ok"); setTela("pronto");
  };
  const pagarPix = () => { setConferindo(true); setTimeout(assinar, 1600); };

  if (tela === "planos") return (
    <div className="stack assin-pay">
      <i className="assin-logo"><Marca /></i>
      <h2>{sit.s === "sem" ? "Assine o Avina" : "Continue com o Avina"}</h2>
      <ul className="assin-inclui">{INCLUI.map(t => <li key={t}><I.check />{t}</li>)}</ul>
      <div className="assin-planos" role="radiogroup" aria-label="Plano">
        {Object.entries(PLANOS).map(([id, p]) => (
          <button key={id} type="button" role="radio" aria-checked={plano === id} className={"assin-plano" + (plano === id ? " on" : "")} onClick={() => setPlano(id)}>
            {p.selo && <em>{p.selo}</em>}
            <span><b>{p.nome} · {brlReal(p.preco)}</b><small>{p.meses > 1 ? `Só ${porMes(p)} por mês` : "Cobrado todo mês"}</small></span>
            <i className="assin-radio">{plano === id && <I.check />}</i>
          </button>
        ))}
      </div>
      {!trocando && gratis > 0 && <div className="note mint"><I.star /><span>{gratis === 1 ? "Seu primeiro mês é grátis" : `Seus primeiros ${gratis} meses são grátis`}: nada é cobrado hoje.</span></div>}
      {trocando
        ? <>
          <div className="note"><I.repeat /><span>{plano === a.plano ? "Esse já é o seu plano." : `O plano ${P.nome} começa em ${dataLonga(a.proxima)}, quando o atual terminar. Nada é cobrado agora.`}</span></div>
          <button className="btn mode" disabled={plano === a.plano} onClick={() => { setA({ ...a, plano }); act.toast(`Combinado: plano ${P.nome} a partir de ${dataLonga(a.proxima)}`); setTela(null); }}>Trocar para o {P.nome.toLowerCase()}</button>
        </>
        : <button className="btn mode" onClick={() => setTela("pagar")}>Continuar</button>}
      <div className="hint assin-centro">Garantia de 7 dias: não gostou, devolvemos tudo. Depois, cancele quando quiser, sem multa e sem fidelidade.</div>
      {!trocando && !a.desde && (a.codigoUsado
        ? <div className="note mint"><I.check /><span>Código {a.codigoUsado} aplicado.</span></div>
        : comCodigo
          ? <div className="assin-codigo">
            <Field label="Código de indicação" htmlFor="a-cod"><input id="a-cod" autoCapitalize="characters" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="Ex.: ANA-123" /></Field>
            <button className="btn ghost" disabled={!/^[A-Z]{2,8}-\d{3}$/.test(codigo) || codigo === meuCodigo} onClick={() => { setA({ ...a, codigoUsado: codigo }); vibrar("ok"); act.toast("Código aplicado: seu primeiro mês é grátis!"); }}>Aplicar</button>
          </div>
          : <button className="btn text" onClick={() => setComCodigo(true)}>Tenho um código de indicação</button>)}
    </div>
  );

  if (tela === "indicar") {
    const url = `${ENDERECO_APP}?indicacao=${meuCodigo}`;
    const msg = `Estou usando o Avina para a agenda e as cobranças do consultório e tem me poupado muito tempo. Com o meu código ${meuCodigo}, seu primeiro mês é grátis: ${url}`;
    const ind = a.indicacoes || [];
    const noAno = ind.filter(x => dias(x.data, hoje) < 365).length;
    return (
      <div className="stack">
        <div className="indique">
          <Ilustra n="dinheiro" className="perfil-ilustra" />
          <h2>Vocês dois ganham 1 mês grátis</h2>
          <p>Quando um colega assina com o seu código, o primeiro mês dele é grátis, e você também ganha 1 mês.</p>
          <button className="indique-cod" onClick={() => copiarTexto(meuCodigo, act, "Código copiado")}><span><small>Seu código</small><b>{meuCodigo}</b></span><I.copy /></button>
          <a className="btn mode" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener"><I.send /> Enviar no WhatsApp</a>
          <button className="btn ghost" onClick={() => copiarTexto(msg, act, "Convite copiado")}><I.copy /> Copiar o convite</button>
        </div>
        <ul className="indique-regras">
          <li>Vale para colegas que nunca assinaram o Avina.</li>
          <li>Seu mês entra 7 dias depois do primeiro pagamento do colega.</li>
          <li>Se você ainda não assina, o mês fica guardado para quando assinar.</li>
          <li>Até {LIMITE_INDICACOES} meses grátis por ano.</li>
        </ul>
        {ind.length ? (
          <div className="perfil-grupo">
            <h3>Quem assinou · {ind.length} {ind.length === 1 ? "mês ganho" : "meses ganhos"}</h3>
            <div className="perfil-lista">
              {ind.map((x, i) => <div key={i} className="perfil-row"><i><I.user /></i><span><b>{x.nome}</b><small>{dataLonga(x.data)} · {x.fora ? "passou do limite do ano" : "+1 mês para você"}</small></span></div>)}
            </div>
          </div>
        ) : <div className="hint assin-centro">Ninguém assinou com o seu código ainda.</div>}
        <div className="assin-demo">
          <b>Só na demonstração</b>
          <small>Na versão de verdade, o mês entra sozinho 7 dias depois do primeiro pagamento do colega.</small>
          <button className="btn ghost" onClick={() => {
            const novo = { nome: COLEGAS_DEMO[ind.length % COLEGAS_DEMO.length], data: hoje, fora: noAno >= LIMITE_INDICACOES };
            const b = { ...a, indicacoes: [novo, ...ind] };
            setA(novo.fora ? b : ganharMes(b)); vibrar("ok");
            act.toast(novo.fora ? "Você já ganhou os 12 meses deste ano" : sit.s === "sem" || sit.s === "acabou" ? "Um colega assinou: 1 mês grátis guardado para você!" : "Um colega assinou: você ganhou 1 mês grátis!");
          }}>Simular um colega assinando</button>
        </div>
      </div>
    );
  }

  if (tela === "pagar") return (
    <div className="stack">
      <button className="assin-resumo" onClick={() => setTela("planos")}>
        <span><small>Plano {P.nome}</small><b>{brlReal(P.preco)} <small>por {P.ciclo}</small></b></span><em>Trocar</em>
      </button>
      {gratis > 0 && <div className="note mint"><I.star /><span>Hoje: <b>R$ 0,00</b>. A primeira cobrança é em {dataLonga(addMeses(hoje, gratis))}.</span></div>}
      <Field label="Como quer pagar"><Seg value={forma} onChange={setForma} options={[{ v: "pix", l: "Pix" }, { v: "cartao", l: "Cartão" }]} /></Field>
      {forma === "pix" && gratis > 0 ? <>
        <div className="hint">Três dias antes da primeira cobrança, chega um aviso com o Pix pronto para pagar.</div>
        <button className="btn mode" onClick={assinar}><I.check /> Começar {gratis === 1 ? "meu mês grátis" : "meus meses grátis"}</button>
      </> : forma === "pix" ? <>
        <div className="assin-pix">
          <QrFalso />
          <small>Abra o app do seu banco, escolha <b>Pix</b> e leia o código. Ou copie e cole.</small>
          <button className="btn ghost" onClick={() => copiarTexto("00020126580014BR.GOV.BCB.PIX0136demonstracao-alvena-nao-pague5204000053039865802BR", act, "Código Pix copiado")}><I.copy /> Copiar código Pix</button>
        </div>
        <button className="btn mode" disabled={conferindo} onClick={pagarPix}>{conferindo ? <><span className="assin-gira" /> Conferindo o pagamento…</> : <><I.check /> Já paguei</>}</button>
        <div className="hint assin-centro">Na versão de verdade, o app percebe o pagamento sozinho em alguns segundos.</div>
      </> : <>
        <CamposCartao c={cartao} setC={setCartao} />
        <button className="btn mode" disabled={!cartaoOk(cartao)} onClick={assinar}><I.lock /> {gratis ? (gratis === 1 ? "Começar meu mês grátis" : "Começar meus meses grátis") : `Assinar por ${brlReal(P.preco)}`}</button>
        <div className="hint assin-centro">{gratis ? `O cartão só é cobrado em ${dataLonga(addMeses(hoje, gratis))}, e depois` : "A cobrança se repete"} a cada {P.ciclo}. Demonstração: nada é cobrado e o cartão não é guardado.</div>
      </>}
    </div>
  );

  if (tela === "pronto") return (
    <div className="stack assin-pronto">
      <Ilustra n="trofeu" className="perfil-ilustra" />
      <h2>Tudo certo!</h2>
      <p>Sua assinatura <b>{atual.nome}</b> está ativa.<br />{(a.historico || []).length ? "A próxima" : "A primeira"} cobrança é em {dataLonga(a.proxima)}, e a gente avisa 3 dias antes.</p>
      {naGarantia(a) && <div className="note mint"><I.check /><span>Garantia de 7 dias: se não gostar, cancele até {dataLonga(addDays(a.historico[0].data, GARANTIA_DIAS))} e devolvemos tudo.</span></div>}
      <button className="btn mode" onClick={() => setTela(null)}>Pronto</button>
    </div>
  );

  if (tela === "forma") return (
    <div className="stack">
      <Field label="Forma de pagamento"><Seg value={forma} onChange={setForma} options={[{ v: "pix", l: "Pix" }, { v: "cartao", l: "Cartão" }]} /></Field>
      {forma === "cartao" && <CamposCartao c={cartao} setC={setCartao} />}
      <div className="hint">{forma === "pix" ? `Três dias antes de vencer, chega um aviso com o Pix pronto para pagar.` : `Cobrado sozinho no cartão a cada ${atual.ciclo}. Você não precisa fazer nada.`}</div>
      <button className="btn mode" disabled={forma === "cartao" && !cartaoOk(cartao)} onClick={() => { setA({ ...a, forma, final: forma === "cartao" ? cartao.num.slice(-4) : null }); act.toast("Forma de pagamento trocada"); setTela(null); }}>Salvar</button>
    </div>
  );

  if (tela === "historico") return (
    <div className="stack">
      {(a.historico || []).length ? (
        <div className="perfil-lista">
          {a.historico.map((h, i) => (
            <div key={i} className="perfil-row assin-hist">
              <i><I.receipt /></i><span><b>{dataLonga(h.data)}</b><small>Plano {PLANOS[h.plano].nome} · {h.forma === "cartao" ? "Cartão" : "Pix"}</small></span>
              <span className="assin-hist-v"><b className="num">{brlReal(h.valor)}</b><small className={h.devolvido ? "devolvido" : ""}>{h.devolvido ? "Devolvido" : "Pago"}</small></span>
            </div>
          ))}
        </div>
      ) : <div className="hint assin-centro">Nenhum pagamento ainda.</div>}
    </div>
  );

  if (tela === "pausar") {
    const volta = addMeses(hoje, meses);
    return (
      <div className="stack">
        <div className="note"><I.clock /><span>Precisa de um tempo? Pause em vez de cancelar. Nada é cobrado, e seus dados ficam guardados do jeitinho que estão.</span></div>
        <Field label="Pausar por"><Seg value={meses} onChange={setMeses} options={[1, 2, 3].map(m => ({ v: m, l: m === 1 ? "1 mês" : `${m} meses` }))} /></Field>
        <div className="hint">Volta sozinha em <b>{dataLonga(volta)}</b>. Se quiser voltar antes, é só tocar em “Voltar agora”.</div>
        <button className="btn mode" onClick={() => { setA({ ...a, status: "pausada", ate: volta, proxima: addMeses(a.proxima, meses) }); act.toast(`Assinatura pausada até ${dataLonga(volta)}`); setTela(null); }}>Pausar por {meses === 1 ? "1 mês" : `${meses} meses`}</button>
      </div>
    );
  }

  if (tela === "cancelar") return (
    <div className="stack">
      <h3 className="section-title">Antes de ir…</h3>
      <div className="perfil-lista">
        <button className="perfil-row" onClick={() => setTela("pausar")}><i><I.clock /></i><span><b>Pausar em vez de cancelar</b><small>Até 3 meses sem pagar nada</small></span><I.chev /></button>
        {a.plano === "mensal" && <button className="perfil-row" onClick={() => { setPlano("anual"); setTela("planos"); }}><i><I.star /></i><span><b>Mudar para o anual</b><small>Sai por {porMes(PLANOS.anual)} por mês</small></span><I.chev /></button>}
      </div>
      <h3 className="section-title">Conta pra gente o motivo <small>opcional</small></h3>
      <div className="chips-wrap">{MOTIVOS.map(m => <button type="button" key={m} className={"chip-op" + (motivo === m ? " on" : "")} aria-pressed={motivo === m} onClick={() => setMotivo(motivo === m ? null : m)}>{m}</button>)}</div>
      {naGarantia(a)
        ? <div className="note mint"><I.check /><span>Você está nos 7 dias de garantia: devolvemos os <b>{brlReal(a.historico[0].valor)}</b> do mesmo jeito que você pagou. Seus dados ficam guardados se quiser voltar.</span></div>
        : <div className="hint">Você continua usando tudo até <b>{dataLonga(a.proxima)}</b>. Depois disso, seus dados ficam guardados se quiser voltar.</div>}
      <button className="btn danger" onClick={() => {
        const g = naGarantia(a);
        setA(g ? { ...a, status: "cancelada", ate: hoje, motivo, historico: a.historico.map((h, i) => i === 0 ? { ...h, devolvido: true } : h) } : { ...a, status: "cancelada", ate: a.proxima, motivo });
        vibrar("aviso"); act.toast(g ? `Assinatura cancelada. Devolvemos ${brlReal(a.historico[0].valor)}` : "Assinatura cancelada"); setTela(null);
      }}>{naGarantia(a) ? "Cancelar e receber de volta" : "Cancelar assinatura"}</button>
    </div>
  );

  // Tela principal
  return (
    <div className="stack">
      {sit.s === "sem" || sit.s === "acabou" ? (
        <div className={"assin-card" + (sit.s === "acabou" ? " acabou" : "")}>
          <small>Assinatura</small>
          <b>{sit.s === "acabou" ? "Sua assinatura terminou" : "Escolha seu plano"}</b>
          <p>{sit.s === "acabou" ? "Seus dados continuam guardados. Escolha um plano para continuar anotando." : `A partir de ${porMes(PLANOS.anual)} por mês. Garantia de 7 dias: não gostou, devolvemos tudo.`}</p>
          {gratis > 0 && <div className="note mint"><I.star /><span>Você tem {gratis === 1 ? "1 mês grátis" : `${gratis} meses grátis`} para usar: nada é cobrado no começo.</span></div>}
          <button className="btn mode" onClick={() => setTela("planos")}>Escolher meu plano</button>
        </div>
      ) : (
        <div className="assin-card">
          <small>Seu plano</small>
          <div className="assin-card-topo">
            <b>{atual.nome}</b>
            <em className={sit.s}>{{ ativa: "Ativa", pausada: "Pausada", cancelada: "Cancelada" }[sit.s]}</em>
          </div>
          <p className="num">{brlReal(atual.preco)} por {atual.ciclo}</p>
          <p>{sit.s === "ativa" ? ((a.historico || []).length ? `Renova em ${dataLonga(a.proxima)}` : `Grátis até ${dataLonga(a.proxima)}. A primeira cobrança é nesse dia.`) : sit.s === "pausada" ? `Volta sozinha em ${dataLonga(a.ate)}. Nada é cobrado até lá.` : `Você usa tudo até ${dataLonga(a.ate)}. Depois, seus dados ficam guardados.`}</p>
          {sit.s === "pausada" && <button className="btn mode" onClick={() => { setA({ ...a, status: "ativa", ate: null }); act.toast("Que bom ter você de volta"); }}>Voltar agora</button>}
          {sit.s === "cancelada" && <button className="btn mode" onClick={() => { setA({ ...a, status: "ativa", ate: null, motivo: null }); act.toast("Assinatura reativada"); }}>Continuar assinando</button>}
        </div>
      )}

      {(sit.s === "sem" || sit.s === "acabou") && (
        <div className="perfil-grupo">
          <h3>O que vem no Avina</h3>
          <ul className="assin-inclui">{INCLUI.map(t => <li key={t}><I.check />{t}</li>)}</ul>
        </div>
      )}

      {a.plano && sit.s !== "acabou" && sit.s !== "sem" && (
        <div className="perfil-lista">
          <button className="perfil-row" onClick={() => setTela("forma")}><i><I.wallet /></i><span><b>Forma de pagamento</b><small>{formaTxt(a)}</small></span><I.chev /></button>
          <button className="perfil-row" onClick={() => setTela("historico")}><i><I.receipt /></i><span><b>Pagamentos</b><small>{a.historico.length} {a.historico.length === 1 ? "pagamento" : "pagamentos"}</small></span><I.chev /></button>
          {sit.s === "ativa" && <button className="perfil-row" onClick={() => { setPlano(a.plano === "anual" ? "mensal" : "anual"); setTela("planos"); }}><i><I.repeat /></i><span><b>Trocar de plano</b><small>{a.plano === "anual" ? "Mudar para o mensal" : `Anual sai por ${porMes(PLANOS.anual)} por mês`}</small></span><I.chev /></button>}
        </div>
      )}

      <div className="perfil-lista">
        <button className="perfil-row" onClick={() => setTela("indicar")}><i><I.users /></i><span><b>Indique um colega</b><small>{(a.indicacoes || []).length ? `${a.indicacoes.length} ${a.indicacoes.length === 1 ? "mês ganho" : "meses ganhos"} · ganhe mais` : "Vocês dois ganham 1 mês grátis"}</small></span><I.chev /></button>
      </div>

      {sit.s === "ativa" && <>
        <button className="assin-pausar" onClick={() => setTela("pausar")}><I.clock /> Pausar assinatura</button>
        <button className="btn text" onClick={() => setTela("cancelar")}>Cancelar assinatura</button>
      </>}

      <div className="assin-demo">
        <b>Só na demonstração</b>
        <small>Nada é cobrado de verdade. Use o botão para começar do zero.</small>
        <div className="btn-row">
          <button className="btn ghost" onClick={() => setA(semPlano())}>Recomeçar</button>
        </div>
      </div>
    </div>
  );
}

export { AssinaturaPagina, useAssinatura, resumoAssinatura, TITULO_ASSIN, voltaAssin };
