// Assinatura do Avina: planos, pagamento, garantia de 7 dias, pausar, cancelar e indicação.
// Sem teste grátis: quem quer conhecer usa a demonstração; quem assina tem 7 dias para desistir com o dinheiro de volta.
// Com login e o servidor ligado ao Asaas, é de verdade: os botões chamam o servidor (servidor-avisos/src/asaas.js),
// que fala com o Asaas. Sem login (demonstração), nada é cobrado e tudo fica guardado neste aparelho.
import React, { useState, useEffect } from "react";
import { I, Marca, Seg, Field, Ilustra, Sheet, todayISO, addDays, fromISO, pad, brlReal, MES_LONGO, vibrar, copiarTexto, lerJSON, servidorAvisos } from "../App.jsx";
import { normalizar } from "../marcas.js";
import { ENDERECO_APP, cliente } from "../nuvem.js";
import { PLANOS, PRODUTOS, LIMITE_GRATIS, planoDe, idPlano, produtoDoUso } from "../plano.js";

const GARANTIA_DIAS = 7;  // direito de arrependimento (compra pela internet)
const LIMITE_INDICACOES = 12; // meses ganhos por indicação, por ano
const INCLUI = {
  completo: ["Pacientes sem limite: agenda, cobranças, recibos e imposto", "Lançamentos pessoais sem limite: gastos, contas, caixinhas e a casa", "O líquido do consultório entrando no seu dinheiro pessoal", "Avisos no celular, voz e cópia na nuvem"],
  consultorio: ["Pacientes sem limite: agenda, cobranças, recibos e imposto", "Link de agendamento para o paciente marcar sozinho", "Lembretes de sessão, faltas e reajuste", "Avisos no celular, voz e cópia na nuvem"],
  pessoal: ["Lançamentos sem limite todo mês", "Contas, caixinhas, transporte e a casa a dois", "Quanto dá para gastar hoje e a previsão do mês", "Avisos no celular, voz e cópia na nuvem"],
};
const GRATIS_TXT = `Grátis: até ${LIMITE_GRATIS.pacientes} pacientes e ${LIMITE_GRATIS.lancMes} lançamentos por mês.`;
const nomeCompleto = p => p ? `${p.nome} ${p.meses > 1 ? "anual" : "mensal"}` : "Avina Pro";
const MOTIVOS = ["Ficou caro", "Não estou usando", "Faltou alguma coisa", "Vou usar outro app", "Outro motivo"];
const COLEGAS_DEMO = ["Marina Torres", "João Pedro Alves", "Fernanda Lima", "Lucas Barros"];
const TITULO_ASSIN = { indicar: "Indique um colega", planos: "Escolha seu plano", pagar: "Pagamento", pronto: "Assinatura", forma: "Forma de pagamento", historico: "Pagamentos", pausar: "Pausar assinatura", cancelar: "Cancelar assinatura" };
// voltar de qualquer tela leva para a tela da assinatura (no pagamento, "Trocar" leva aos planos)
const voltaAssin = () => null;

const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addMeses = (iso, n) => { const d = fromISO(iso); d.setMonth(d.getMonth() + n); return isoDe(d); };
const dias = (de, ate) => Math.round((fromISO(ate) - fromISO(de)) / 864e5);
const dataLonga = iso => { const d = fromISO(iso); return `${d.getDate()} de ${MES_LONGO[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ""}`; };
const porMes = p => brlReal(Math.round(p.preco / p.meses * 100) / 100);
const semPlano = () => ({ status: "sem", historico: [] });
// Meses grátis para usar ao assinar: o do código de indicação (só na primeira vez) e os guardados por indicar colegas
const mesesGratis = a => (a.codigoUsado && !a.desde ? 1 : 0) + (a.guardados || 0);
// Garantia: cancelar até 7 dias depois do primeiro pagamento devolve tudo
// (de verdade, o servidor já manda a garantia calculada: só o primeiro pagamento da assinatura atual)
const garantiaDe = a => a.real ? a.garantia || null
  : (a.historico || []).length === 1 && !a.historico[0].devolvido && dias(a.historico[0].data, todayISO()) <= GARANTIA_DIAS ? { valor: a.historico[0].valor, ate: addDays(a.historico[0].data, GARANTIA_DIAS) } : null;
const naGarantia = a => !!garantiaDe(a);

// Indique um colega: código fixo de cada conta (primeiro nome + 3 números)
const codigoDe = conta => `${(normalizar(conta.nome).split(" ")[0] || "avina").toUpperCase().slice(0, 8)}-${Math.abs([...String(conta.email)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 900 + 100}`;
// Mês ganho por indicar: assinando, a próxima cobrança anda um mês; sem assinatura, o mês fica guardado
function ganharMes(a) {
  const sit = situacaoDe(a);
  if (sit.s === "sem" || sit.s === "acabou") return { ...a, guardados: (a.guardados || 0) + 1 };
  return { ...a, proxima: addMeses(a.proxima, 1), ...(a.status === "cancelada" ? { ate: addMeses(a.ate, 1) } : {}) };
}

function useAssinatura(conta, aoMudar) {
  const chave = `agenda-assinatura:${conta.email}`;
  // quem tinha o "teste grátis" da versão antiga começa sem plano (o código e as indicações continuam)
  const [a, setA] = useState(() => { const v = lerJSON(chave, null); return v && v.status !== "teste" ? v : { ...semPlano(), codigoUsado: v && v.codigoUsado, indicacoes: v && v.indicacoes }; });
  useEffect(() => { try { localStorage.setItem(chave, JSON.stringify(a)); } catch (e) {} }, [a]);
  // De verdade: conta com login + servidor com a chave do Asaas. No computador (npm run dev), dá para testar sem login
  // com localStorage "avina-asaas-teste" = 1 (o servidor de teste aceita o e-mail da conta no lugar do login).
  const teste = import.meta.env.DEV && !conta.uid && !!lerJSON("avina-asaas-teste", false);
  const podeReal = !!(conta.uid || teste) && !!servidorAvisos();
  const [real, setReal] = useState(null);
  const [sandbox, setSandbox] = useState(false);
  const [cortesiaAte, setCortesiaAte] = useState(null);
  // o app inteiro precisa saber do plano (limites da versão grátis e o selo PRO)
  useEffect(() => { if (aoMudar && real) aoMudar({ estado: real, cortesiaAte }); }, [real, cortesiaAte]);
  const chamar = async (rota, corpo = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (conta.uid) {
      const { data } = await (await cliente()).auth.getSession();
      if (!data.session) throw new Error("Entre de novo na sua conta para continuar");
      headers.Authorization = `Bearer ${data.session.access_token}`;
    } else headers["X-Teste-Uid"] = conta.email;
    let r;
    try { r = await fetch(`${servidorAvisos()}/assinatura/${rota}`, { method: "POST", headers, body: JSON.stringify(corpo) }); }
    catch (e) { throw new Error("Sem internet agora. Tente de novo em instantes."); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.erro) throw new Error(j.erro || "O servidor não respondeu. Tente de novo.");
    if (j.estado) setReal(j.estado);
    return j;
  };
  useEffect(() => {
    if (!podeReal) return;
    chamar("ver").then(j => { if (j.configurado === false) setReal(null); setSandbox(!!j.sandbox); setCortesiaAte(j.cortesiaAte || null); }).catch(() => {});
  }, [podeReal]);
  return { a: real || a, real: !!real, sandbox, cortesiaAte, setA, chamar };
}

// Situação de hoje: a pausa e o cancelamento terminam sozinhos na data
function situacaoDe(a) {
  const hoje = todayISO();
  if (a.status === "sem") return { s: "sem" };
  if (a.status === "aguardando" || a.status === "acabou") return { s: a.status };
  if (a.status === "pausada" && hoje < a.ate) return { s: "pausada" };
  if (a.status === "cancelada") return hoje < a.ate ? { s: "cancelada" } : { s: "acabou" };
  return { s: "ativa" };
}

function resumoAssinatura(a) {
  const sit = situacaoDe(a), P = planoDe(a.plano);
  if (sit.s === "sem") return { texto: mesesGratis(a) ? `Você tem ${mesesGratis(a) === 1 ? "1 mês grátis" : `${mesesGratis(a)} meses grátis`} para usar` : "Escolha um plano · garantia de 7 dias" };
  if (sit.s === "acabou") return { texto: "Escolha um plano para continuar", selo: "Acabou" };
  if (sit.s === "aguardando") return { texto: "Falta pagar para começar", selo: "Pagar" };
  if (sit.s === "ativa" && a.pendente && a.pendente.atrasada) return { texto: `Cobrança de ${dataLonga(a.pendente.vencimento)} em aberto`, selo: "Pagar" };
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
const formaTxt = a => a.forma === "cartao" ? (a.final ? `Cartão final ${a.final}` : "Cartão de crédito") : "Pix";
const soNumeros = s => String(s || "").replace(/\D/g, "");
const fmtCpf = s => soNumeros(s).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
function cpfValido(c) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

// Pagamento de verdade: assina (CPF e nome vão para o Asaas) e mostra o Pix aqui, ou o link da página segura do Asaas
// para o cartão. Enquanto espera, confere a cada 5 segundos se o pagamento caiu.
function PagarReal({ s, plano, forma, setForma, act, setTela, voltar }) {
  const a = s.a, P = planoDe(plano);
  const cobranca = a.pendente && (a.status === "aguardando" || a.status === "ativa") ? a.pendente : null;
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [pix, setPix] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const esperando = !!cobranca;
  const formaVale = cobranca ? cobranca.forma : forma;
  useEffect(() => {
    if (!esperando) return;
    const t = setInterval(() => { s.chamar("ver").then(j => { if (j.estado && j.estado.status === "ativa" && !(j.estado.pendente && j.estado.pendente.id === cobranca.id)) { clearInterval(t); vibrar("ok"); setTela("pronto"); } }).catch(() => {}); }, 5000);
    return () => clearInterval(t);
  }, [esperando, cobranca && cobranca.id]);
  // já existe cobrança em aberto com Pix: busca o QR
  useEffect(() => { if (cobranca && formaVale === "pix" && !pix) s.chamar("pix").then(j => setPix(j.pix)).catch(e => act.toast(e.message)); }, [cobranca && cobranca.id]);
  const assinar = async () => {
    setOcupado(true);
    try { const j = await s.chamar("assinar", { plano, forma, cpf, nome }); if (j.pix) setPix(j.pix); vibrar("ok"); }
    catch (e) { act.toast(e.message); }
    finally { setOcupado(false); }
  };
  const desistir = async () => { setOcupado(true); try { await s.chamar("cancelar", {}); act.toast("Pronto: nada foi cobrado"); voltar(); } catch (e) { act.toast(e.message); } finally { setOcupado(false); } };

  if (cobranca) return (
    <div className="stack">
      <div className="assin-resumo"><span><small>{nomeCompleto(planoDe(a.plano) || P)}</small><b>{brlReal(cobranca.valor)}</b></span><em>{cobranca.atrasada ? "Venceu" : "A pagar"}</em></div>
      {formaVale === "pix" ? (
        <div className="assin-pix">
          {pix ? <img className="assin-qr" src={`data:image/png;base64,${pix.imagem}`} alt="QR Code do Pix" /> : <div className="assin-qr assin-qr-vazio"><span className="assin-gira" /></div>}
          <small>Abra o app do seu banco, escolha <b>Pix</b> e leia o código. Ou copie e cole.</small>
          <button className="btn ghost" disabled={!pix} onClick={() => copiarTexto(pix.copiaecola, act, "Código Pix copiado")}><I.copy /> Copiar código Pix</button>
        </div>
      ) : (
        <div className="assin-pix">
          <I.lock />
          <small>O cartão é digitado na página segura do Asaas, que cuida das cobranças. O número do cartão não passa pelo Avina.</small>
          <a className="btn mode" href={cobranca.link} target="_blank" rel="noopener"><I.lock /> Pagar com cartão</a>
        </div>
      )}
      <div className="assin-espera"><span className="assin-gira" /> Esperando o pagamento… a tela muda sozinha quando cair.</div>
      {formaVale === "pix" && <a className="btn text" href={cobranca.link} target="_blank" rel="noopener">Prefiro pagar na página do Asaas</a>}
      {a.status === "aguardando" && <button className="btn text" disabled={ocupado} onClick={desistir}>Desistir de assinar</button>}
    </div>
  );

  const okCpf = cpfValido(soNumeros(cpf)), okNome = nome.trim().split(/\s+/).length >= 2;
  return (
    <div className="stack">
      <button className="assin-resumo" onClick={() => setTela("planos")}>
        <span><small>{nomeCompleto(P)}</small><b>{brlReal(P.preco)} <small>por {P.ciclo}</small></b></span><em>Trocar</em>
      </button>
      <div className="fields">
        <Field label="Nome completo" icon={<I.user />} htmlFor="a-nome"><input id="a-nome" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} placeholder="Como no documento" /></Field>
        <Field label="CPF" icon={<I.key />} htmlFor="a-cpf"><input id="a-cpf" inputMode="numeric" value={fmtCpf(cpf)} onChange={e => setCpf(soNumeros(e.target.value).slice(0, 11))} placeholder="000.000.000-00" /></Field>
      </div>
      {soNumeros(cpf).length === 11 && !okCpf && <div className="error">Confira o CPF: ele não parece certo.</div>}
      <div className="hint">O CPF é pedido pelo Asaas, que emite as cobranças. Fica só com eles.</div>
      <Field label="Como quer pagar"><Seg value={forma} onChange={setForma} options={[{ v: "pix", l: "Pix" }, { v: "cartao", l: "Cartão" }]} /></Field>
      <button className="btn mode" disabled={ocupado || !okCpf || !okNome} onClick={assinar}>
        {ocupado ? <><span className="assin-gira" /> Só um instante…</> : forma === "pix" ? <><I.check /> Gerar o Pix de {brlReal(P.preco)}</> : <><I.lock /> Continuar para o cartão</>}
      </button>
      <div className="hint assin-centro">{forma === "pix" ? `Depois, a cada ${P.ciclo}, chega um aviso com o Pix pronto para pagar.` : `O cartão é cobrado sozinho a cada ${P.ciclo}.`} Garantia de 7 dias: não gostou, devolvemos tudo.</div>
    </div>
  );
}

function AssinaturaPagina({ s, tela, setTela, act, conta }) {
  const { a, setA, real } = s;
  const sit = situacaoDe(a), hoje = todayISO();
  const [ocupado, setOcupado] = useState(false);
  // De verdade: chama o servidor; se der certo, mostra o aviso e volta (o estado novo já veio na resposta)
  const fazer = async (rota, corpo, ok, depois = null) => {
    setOcupado(true);
    try { const j = await s.chamar(rota, corpo); vibrar("ok"); act.toast(typeof ok === "function" ? ok(j) : ok); setTela(depois); }
    catch (e) { act.toast(e.message); }
    finally { setOcupado(false); }
  };
  const [codigo, setCodigo] = useState("");
  const [comCodigo, setComCodigo] = useState(false);
  const meuCodigo = codigoDe(conta);
  // plano escolhido: o atual, ou o pacote que combina com o uso do app (só pessoal ou consultório) no anual
  const [plano, setPlano] = useState(() => a.plano ? idPlano(a.plano) : `${produtoDoUso(conta.perfil)}_anual`);
  const [forma, setForma] = useState(a.forma || "pix");
  const [cartao, setCartao] = useState(CARTAO_VAZIO);
  const [conferindo, setConferindo] = useState(false);
  const [meses, setMeses] = useState(1);
  const [motivo, setMotivo] = useState(null);
  const P = planoDe(plano), atual = planoDe(a.plano) || P, produto = P.produto;
  const produtoPadrao = produtoDoUso(conta.perfil);
  const gratis = real ? 0 : mesesGratis(a);
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
      <h2>{sit.s === "sem" ? "Assine o Avina Pro" : "Continue com o Avina Pro"}</h2>
      <Seg big value={produto} onChange={v => setPlano(`${v}_${plano.endsWith("_mensal") ? "mensal" : "anual"}`)} options={Object.entries(PRODUTOS).map(([v, x]) => ({ v, l: x.nome }))} />
      <ul className="assin-inclui">{INCLUI[produto].map(t => <li key={t}><I.check />{t}</li>)}</ul>
      <div className="assin-planos" role="radiogroup" aria-label="Plano">
        {["anual", "mensal"].map(c => {
          const id = `${produto}_${c}`, p = PLANOS[id];
          return (
            <button key={id} type="button" role="radio" aria-checked={plano === id} className={"assin-plano" + (plano === id ? " on" : "")} onClick={() => setPlano(id)}>
              {p.selo && <em>{p.selo}</em>}
              <span><b>{c === "anual" ? "Anual" : "Mensal"} · {brlReal(p.preco)}</b><small>{p.meses > 1 ? `Só ${porMes(p)} por mês` : "Cobrado todo mês"}</small></span>
              <i className="assin-radio">{plano === id && <I.check />}</i>
            </button>
          );
        })}
      </div>
      {!trocando && gratis > 0 && <div className="note mint"><I.star /><span>{gratis === 1 ? "Seu primeiro mês é grátis" : `Seus primeiros ${gratis} meses são grátis`}: nada é cobrado hoje.</span></div>}
      {trocando
        ? <>
          <div className="note"><I.repeat /><span>{plano === idPlano(a.plano) ? "Esse já é o seu plano." : `O ${nomeCompleto(P)} começa em ${dataLonga(a.proxima)}, quando o atual terminar. Nada é cobrado agora.`}</span></div>
          <button className="btn mode" disabled={plano === idPlano(a.plano) || ocupado} onClick={() => {
            const msg = `Combinado: ${nomeCompleto(P)} a partir de ${dataLonga(a.proxima)}`;
            if (real) return fazer("trocar", { plano }, msg);
            setA({ ...a, plano }); act.toast(msg); setTela(null);
          }}>Trocar para o {nomeCompleto(P)}</button>
        </>
        : <button className="btn mode" onClick={() => setTela("pagar")}>Continuar</button>}
      <div className="hint assin-centro">Garantia de 7 dias: não gostou, devolvemos tudo. Depois, cancele quando quiser, sem multa e sem fidelidade.</div>
      {!trocando && !a.desde && !real && (a.codigoUsado
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
          <li>Vale para contas novas, de quem nunca assinou o Avina.</li>
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

  if (tela === "pagar" && real) return <PagarReal s={s} plano={plano} forma={forma} setForma={setForma} act={act} setTela={setTela} voltar={() => setTela(null)} />;

  if (tela === "pagar") return (
    <div className="stack">
      <button className="assin-resumo" onClick={() => setTela("planos")}>
        <span><small>{nomeCompleto(P)}</small><b>{brlReal(P.preco)} <small>por {P.ciclo}</small></b></span><em>Trocar</em>
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
      <p>Seu <b>{nomeCompleto(atual)}</b> está ativo.<br />{(a.historico || []).length ? "A próxima" : "A primeira"} cobrança é em {dataLonga(a.proxima)}, e a gente avisa 3 dias antes.</p>
      {naGarantia(a) && <div className="note mint"><I.check /><span>Garantia de 7 dias: se não gostar, cancele até {dataLonga(garantiaDe(a).ate)} e devolvemos tudo.</span></div>}
      <button className="btn mode" onClick={() => setTela(null)}>Pronto</button>
    </div>
  );

  if (tela === "forma") return (
    <div className="stack">
      <Field label="Forma de pagamento"><Seg value={forma} onChange={setForma} options={[{ v: "pix", l: "Pix" }, { v: "cartao", l: "Cartão" }]} /></Field>
      {forma === "cartao" && !real && <CamposCartao c={cartao} setC={setCartao} />}
      <div className="hint">{forma === "pix" ? `Três dias antes de vencer, chega um aviso com o Pix pronto para pagar.` : real ? `Na próxima cobrança, você digita o cartão na página segura do Asaas. Depois, ele é cobrado sozinho a cada ${atual.ciclo}.` : `Cobrado sozinho no cartão a cada ${atual.ciclo}. Você não precisa fazer nada.`}</div>
      <button className="btn mode" disabled={(forma === "cartao" && !real && !cartaoOk(cartao)) || ocupado || (real && forma === a.forma)} onClick={() => {
        if (real) return fazer("forma", { forma }, "Forma de pagamento trocada");
        setA({ ...a, forma, final: forma === "cartao" ? cartao.num.slice(-4) : null }); act.toast("Forma de pagamento trocada"); setTela(null);
      }}>Salvar</button>
    </div>
  );

  if (tela === "historico") return (
    <div className="stack">
      {(a.historico || []).length ? (
        <div className="perfil-lista">
          {a.historico.map((h, i) => (
            <div key={i} className="perfil-row assin-hist">
              <i><I.receipt /></i><span><b>{dataLonga(h.data)}</b><small>{nomeCompleto(planoDe(h.plano))} · {h.forma === "cartao" ? "Cartão" : "Pix"}</small></span>
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
        <button className="btn mode" disabled={ocupado} onClick={() => {
          if (real) return fazer("pausar", { meses }, `Assinatura pausada até ${dataLonga(volta)}`);
          setA({ ...a, status: "pausada", ate: volta, proxima: addMeses(a.proxima, meses) }); act.toast(`Assinatura pausada até ${dataLonga(volta)}`); setTela(null);
        }}>Pausar por {meses === 1 ? "1 mês" : `${meses} meses`}</button>
      </div>
    );
  }

  if (tela === "cancelar") return (
    <div className="stack">
      <h3 className="section-title">Antes de ir…</h3>
      <div className="perfil-lista">
        <button className="perfil-row" onClick={() => setTela("pausar")}><i><I.clock /></i><span><b>Pausar em vez de cancelar</b><small>Até 3 meses sem pagar nada</small></span><I.chev /></button>
        {idPlano(a.plano || "").endsWith("_mensal") && <button className="perfil-row" onClick={() => { setPlano(`${atual.produto}_anual`); setTela("planos"); }}><i><I.star /></i><span><b>Mudar para o anual</b><small>Sai por {porMes(PLANOS[`${atual.produto}_anual`])} por mês</small></span><I.chev /></button>}
      </div>
      <h3 className="section-title">Conta pra gente o motivo <small>opcional</small></h3>
      <div className="chips-wrap">{MOTIVOS.map(m => <button type="button" key={m} className={"chip-op" + (motivo === m ? " on" : "")} aria-pressed={motivo === m} onClick={() => setMotivo(motivo === m ? null : m)}>{m}</button>)}</div>
      {naGarantia(a)
        ? <div className="note mint"><I.check /><span>Você está nos 7 dias de garantia: devolvemos os <b>{brlReal(garantiaDe(a).valor)}</b> do mesmo jeito que você pagou. Seus dados ficam guardados se quiser voltar.</span></div>
        : <div className="hint">Você continua usando tudo até <b>{dataLonga(a.proxima)}</b>. Depois disso, seus dados ficam guardados se quiser voltar.</div>}
      <button className="btn danger" disabled={ocupado} onClick={() => {
        if (real) return fazer("cancelar", { motivo }, j => j.devolvido ? `Assinatura cancelada. Devolvemos ${brlReal(j.devolvido)}` : "Assinatura cancelada");
        const g = naGarantia(a);
        setA(g ? { ...a, status: "cancelada", ate: hoje, motivo, historico: a.historico.map((h, i) => i === 0 ? { ...h, devolvido: true } : h) } : { ...a, status: "cancelada", ate: a.proxima, motivo });
        vibrar("aviso"); act.toast(g ? `Assinatura cancelada. Devolvemos ${brlReal(garantiaDe(a).valor)}` : "Assinatura cancelada"); setTela(null);
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
          <p>{sit.s === "acabou" ? "Seus dados continuam guardados. Escolha um plano para continuar anotando." : `A partir de ${porMes(PLANOS.pessoal_anual)} por mês. Garantia de 7 dias: não gostou, devolvemos tudo.`}</p>
          {sit.s === "sem" && <p className="assin-gratis">{GRATIS_TXT}</p>}
          {s.cortesiaAte && hoje < s.cortesiaAte && <div className="note mint"><I.star /><span>Como você já usava o Avina, o Pro está liberado de presente até {dataLonga(s.cortesiaAte)}.</span></div>}
          {gratis > 0 && <div className="note mint"><I.star /><span>Você tem {gratis === 1 ? "1 mês grátis" : `${gratis} meses grátis`} para usar: nada é cobrado no começo.</span></div>}
          <button className="btn mode" onClick={() => setTela("planos")}>Escolher meu plano</button>
        </div>
      ) : sit.s === "aguardando" ? (
        <div className="assin-card acabou">
          <small>{nomeCompleto(atual)}</small>
          <b>Falta pagar</b>
          <p>{brlReal(a.pendente ? a.pendente.valor : atual.preco)} para começar. Assim que o pagamento cair, a assinatura fica ativa sozinha.</p>
          <button className="btn mode" onClick={() => setTela("pagar")}>{a.forma === "cartao" ? "Pagar com cartão" : "Pagar com Pix"}</button>
        </div>
      ) : (
        <div className="assin-card">
          <small>Seu plano · <span className="pro-selo">PRO</span></small>
          <div className="assin-card-topo">
            <b>{atual.nome}</b>
            <em className={sit.s}>{{ ativa: "Ativa", pausada: "Pausada", cancelada: "Cancelada" }[sit.s]}</em>
          </div>
          <p className="num">{atual.meses > 1 ? "Anual" : "Mensal"} · {brlReal(atual.preco)} por {atual.ciclo}</p>
          <p>{sit.s === "ativa" ? ((a.historico || []).length ? `Renova em ${dataLonga(a.proxima)}` : `Grátis até ${dataLonga(a.proxima)}. A primeira cobrança é nesse dia.`) : sit.s === "pausada" ? `Volta sozinha em ${dataLonga(a.ate)}. Nada é cobrado até lá.` : `Você usa tudo até ${dataLonga(a.ate)}. Depois, seus dados ficam guardados.`}</p>
          {sit.s === "ativa" && a.pendente && a.pendente.atrasada && <>
            <div className="note amber"><I.alert /><span>A cobrança de {dataLonga(a.pendente.vencimento)} ainda não foi paga.</span></div>
            <button className="btn mode" onClick={() => setTela("pagar")}>Pagar agora</button>
          </>}
          {sit.s === "pausada" && <button className="btn mode" disabled={ocupado} onClick={() => { if (real) return fazer("voltar", {}, "Que bom ter você de volta"); setA({ ...a, status: "ativa", ate: null }); act.toast("Que bom ter você de volta"); }}>Voltar agora</button>}
          {sit.s === "cancelada" && <button className="btn mode" disabled={ocupado} onClick={() => { if (real) return fazer("voltar", {}, "Assinatura reativada"); setA({ ...a, status: "ativa", ate: null, motivo: null }); act.toast("Assinatura reativada"); }}>Continuar assinando</button>}
        </div>
      )}

      {(sit.s === "sem" || sit.s === "acabou") && (
        <div className="perfil-grupo">
          <h3>O que vem no Avina Pro</h3>
          <ul className="assin-inclui">{INCLUI[produtoPadrao].map(t => <li key={t}><I.check />{t}</li>)}</ul>
        </div>
      )}

      {((a.plano && sit.s !== "acabou" && sit.s !== "sem") || (a.historico || []).length > 0) && (
        <div className="perfil-lista">
          {a.plano && sit.s !== "acabou" && sit.s !== "sem" && <button className="perfil-row" onClick={() => setTela("forma")}><i><I.wallet /></i><span><b>Forma de pagamento</b><small>{formaTxt(a)}</small></span><I.chev /></button>}
          {(a.historico || []).length > 0 && <button className="perfil-row" onClick={() => setTela("historico")}><i><I.receipt /></i><span><b>Pagamentos</b><small>{a.historico.length} {a.historico.length === 1 ? "pagamento" : "pagamentos"}</small></span><I.chev /></button>}
          {sit.s === "ativa" && <button className="perfil-row" onClick={() => { setPlano(idPlano(a.plano)); setTela("planos"); }}><i><I.repeat /></i><span><b>Trocar de plano</b><small>Anual ou mensal, um pacote ou os dois</small></span><I.chev /></button>}
        </div>
      )}

      {!real && <div className="perfil-lista">
        <button className="perfil-row" onClick={() => setTela("indicar")}><i><I.users /></i><span><b>Indique um colega</b><small>{(a.indicacoes || []).length ? `${a.indicacoes.length} ${a.indicacoes.length === 1 ? "mês ganho" : "meses ganhos"} · ganhe mais` : "Vocês dois ganham 1 mês grátis"}</small></span><I.chev /></button>
      </div>}

      {sit.s === "ativa" && <>
        <button className="assin-pausar" onClick={() => setTela("pausar")}><I.clock /> Pausar assinatura</button>
        <button className="btn text" onClick={() => setTela("cancelar")}>Cancelar assinatura</button>
      </>}

      {real
        ? s.sandbox && <div className="assin-demo"><b>Asaas em modo de teste</b><small>As cobranças são de mentirinha (sandbox): nenhum dinheiro de verdade passa por aqui.</small></div>
        : <div className="assin-demo">
          <b>Só na demonstração</b>
          <small>Nada é cobrado de verdade. Use o botão para começar do zero.</small>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => setA(semPlano())}>Recomeçar</button>
          </div>
        </div>}
    </div>
  );
}

// Passou do limite da versão grátis: mostra o que o Pro libera (nada do que já está anotado se perde)
function ProSheet({ motivo, sugerido, onClose, act }) {
  const pac = motivo === "pac";
  // quem usa as duas áreas vê o pacote com as duas; senão, só a área que travou
  const produto = sugerido === "completo" ? "completo" : pac ? "consultorio" : "pessoal", P = PLANOS[`${produto}_anual`];
  return (
    <Sheet title={pac ? `Você chegou a ${LIMITE_GRATIS.pacientes} pacientes` : `Você chegou a ${LIMITE_GRATIS.lancMes} lançamentos este mês`}
      sub={pac ? `Na versão grátis, dá para acompanhar até ${LIMITE_GRATIS.pacientes} pacientes ativos.` : `Na versão grátis, dá para anotar até ${LIMITE_GRATIS.lancMes} lançamentos por mês. No mês que vem, o contador zera.`} onClose={onClose}>
      <div className="pro-topo"><i className="assin-logo"><Marca /></i><b>Avina Pro</b><span className="pro-selo">PRO</span></div>
      <ul className="assin-inclui">{INCLUI[produto].map(t => <li key={t}><I.check />{t}</li>)}</ul>
      <div className="note mint"><I.star /><span>{P.nome}: {porMes(P)} por mês no plano anual. Garantia de 7 dias: não gostou, devolvemos tudo.</span></div>
      <button className="btn mode" onClick={() => { onClose(); setTimeout(() => act.openSettings("assinatura"), 250); }}>Conhecer o Avina Pro</button>
      <button className="btn text" onClick={onClose}>Agora não</button>
    </Sheet>
  );
}

export { AssinaturaPagina, ProSheet, useAssinatura, resumoAssinatura, TITULO_ASSIN, voltaAssin };
