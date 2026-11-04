// Parte do app carregada sob demanda (só quando é aberta). Gerado a partir do App.jsx.
import React, { Suspense, useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useDeferredValue, memo } from "react";
import PORQUINHO from "../assets/porquinho.webp";
import { createPortal, flushSync } from "react-dom";
import { useCotacoes, MOEDAS, CODIGOS, emReais, fmtMoeda, fmtTaxa, IOF_CARTAO } from "../cotacoes.js";
import { ViagemAviso } from "./dinheiro.jsx";
import { Carrossel, CartoesInicio, Grande } from "./inicio-cartoes.jsx";
import { CatBolinha, useContagem, Topo, Comparacao, menosMovimento } from "./visual.jsx";
import { SeloBanco, nomeBanco } from "./bancos.jsx";
import { resumoPessoal, GraficoLinha, BarraCategorias, LinhaCategoria, MES_ABREV, diaMes, eixoDoMes, marcaDoNome, LancRow, acumuladoMes, diasDoMes } from "./resumo.jsx";
import "../pessoal.css";
import { buscarMarcas, palpitesDeSite, logoDoSite, marcaPorId as marcaId, normalizar } from "../marcas.js";
import { logoPropria, lerArquivo } from "../App.jsx";
import { todayISO, addDays, MES_LONGO, TopoInicio, saudacao, WeatherChip, Talk, ESCONDER, I, Money, brl, AreaChart, pad, soma, TopBar, CORES, catDe, catVars, CatIcon, fromISO, MarcaLogo, acharMarca, fmtNum, interpretarFala, CAT_ENTRADA, CATEGORIAS, num, Sheet, brlReal, Seg, soNumero, Field, uid, ConfirmButton, Toggle, iniciais, itensDoDia, PERFIL, situacaoConta, diffDias, vencimento, ESTILO, contaDinheiro, CalBadge, liquidoMes, tetosAlerta, Ilustra, ProximaConquista, servidorAvisos, Confirmar, vibrar } from "../App.jsx";
import { saldos as saldosCasa } from "../casa.js";

/* ---------- Logo enquanto digita: sugere as empresas parecidas (mesmo com erro de digitação),
   tenta achar o site de quem não está na lista e deixa usar uma foto como logo ---------- */
// escolha: null (automático) | { marca, nome, cat } | { site } | { nenhuma: true }
const escolhaInicial = it => !it ? null : it.semLogo ? { nenhuma: true } : it.marca ? { marca: it.marca, nome: (marcaId(it.marca) || {}).nome } : it.logoSite ? { site: it.logoSite } : null;
function escolhaEfetiva(texto, escolha) {
  if (escolha) return escolha.nenhuma ? null : escolha;
  const top = buscarMarcas(texto, 1)[0];
  return top && top.p >= 86 ? { marca: top.m.id, nome: top.m.nome, cat: top.m.cat, auto: true } : null;
}
const camposLogo = (texto, escolha) => {
  if (escolha && escolha.nenhuma) return { marca: null, logoSite: null, semLogo: true };
  const ef = escolhaEfetiva(texto, escolha);
  return { marca: ef && ef.marca ? ef.marca : null, logoSite: ef && ef.site ? ef.site : null, semLogo: false };
};
// reduz a foto para um quadrado pequeno (fica leve para guardar)
async function fotoParaLogo(file) {
  const url = await lerArquivo(file);
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
  const lado = Math.min(img.naturalWidth, img.naturalHeight), T = 128;
  const c = document.createElement("canvas"); c.width = c.height = T;
  c.getContext("2d").drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, T, T);
  return c.toDataURL("image/jpeg", .85);
}
// Palpite de site: só aparece se o Google tiver um ícone de verdade para ele (o serviço novo dá erro quando não tem)
function SitePalpite({ site, ativo, onEscolher }) {
  const [ok, setOk] = useState(false);
  if (!ok) return <img className="ms-teste" src={logoDoSite(site, 1)} alt="" referrerPolicy="no-referrer" onLoad={e => { if (e.currentTarget.naturalWidth >= 16) setOk(true); }} />;
  return (
    <button type="button" className={"ms-op" + (ativo ? " on" : "")} onClick={onEscolher}>
      <MarcaLogo site={site} nome={site} className="ms-logo" /><span>{site}</span>
    </button>
  );
}
function SugestoesMarca({ texto, escolha, onEscolha, onFoto }) {
  const sug = useMemo(() => buscarMarcas(texto, 5), [texto]);
  const palpites = useMemo(() => (sug.length && sug[0].p >= 86 ? [] : palpitesDeSite(texto)), [texto, sug]);
  const ef = escolhaEfetiva(texto, escolha);
  const fotoRef = useRef(null);
  const temFoto = !!logoPropria((ef && ef.nome) || texto);
  if (normalizar(texto).length < 2) return null;
  const escolher = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    try { onFoto((ef && ef.nome) || texto.trim(), await fotoParaLogo(f)); } catch (err) {}
  };
  return (
    <div className="marca-sug" aria-label="Escolha a logo">
      {sug.map(({ m }) => {
        const on = !!(ef && ef.marca === m.id);
        return (
          <button type="button" key={m.id} className={"ms-op" + (on ? " on" : "")} aria-pressed={on} onClick={() => onEscolha({ marca: m.id, nome: m.nome, cat: m.cat })}>
            <MarcaLogo marca={m.id} cat={catDe(m.cat)} className="ms-logo" /><span>{m.nome}</span>
          </button>
        );
      })}
      {palpites.map(site => <SitePalpite key={site} site={site} ativo={!!(ef && ef.site === site)} onEscolher={() => onEscolha({ site })} />)}
      <button type="button" className="ms-op ms-foto" onClick={() => fotoRef.current && fotoRef.current.click()}>
        <span className="ms-logo ms-cam" aria-hidden="true">📷</span><span>{temFoto ? "Trocar foto" : "Usar foto"}</span>
      </button>
      <input ref={fotoRef} type="file" accept="image/*" hidden onChange={escolher} />
      {(ef || (escolha && escolha.nenhuma)) && <button type="button" className={"ms-op ms-nenhuma" + (escolha && escolha.nenhuma ? " on" : "")} onClick={() => onEscolha({ nenhuma: true })}>Sem logo</button>}
    </div>
  );
}


// Fluxo do mês: o que entrou e o que saiu, em duas barras na mesma escala
function FluxoMes({ entrou, saiu, aPagar }) {
  const max = Math.max(entrou, saiu, 1), sobra = entrou - saiu;
  return (
    <div className="ps-fluxo">
      <div className="ps-fluxo-l"><span>Entrou</span><span className="ps-fluxo-t"><i style={{ width: `${(entrou / max) * 100}%` }} /></span><b className="mais">+{brl(entrou)}</b></div>
      <div className="ps-fluxo-l sai"><span>Saiu</span><span className="ps-fluxo-t"><i style={{ width: `${(saiu / max) * 100}%`, "--i": 1 }} /></span><b className="menos">−{brl(saiu)}</b></div>
      <div className="ps-fluxo-pe"><span>{sobra >= 0 ? "Sobra" : "Faltam"} <b className={sobra < 0 ? "menos" : ""}>{brl(Math.abs(sobra))}</b></span>{aPagar > 0 && <span>Contas a pagar <b>{brl(aPagar)}</b></span>}</div>
    </div>
  );
}

/* ---------- datas das atividades ---------- */
const DIA_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
// Título de cada dia na lista: Hoje, Ontem, o dia da semana (nos últimos 6 dias) e "17 de out." nos mais antigos
function tituloDia(iso, hoje) {
  if (iso === hoje) return "Hoje";
  const d = diffDias(iso, hoje);
  if (d === 1) return "Ontem";
  if (d === -1) return "Amanhã";
  if (d > 1 && d <= 6) return DIA_SEMANA[fromISO(iso).getDay()];
  return diaMes(iso, hoje, ".");
}
// texto em que a busca procura (guardado por lançamento: com mil linhas, digitar não refaz tudo)
const textoBusca = new WeakMap();
function buscavel(l) {
  let t = textoBusca.get(l);
  if (t === undefined) { t = normalizar(`${l.desc || ""} ${catDe(l.cat).nome} ${nomeBanco(l.banco)} ${fmtNum(l.valor)}`); textoBusca.set(l, t); }
  return t;
}

// Previsão do mês: simula dia a dia até o fim do mês, a partir do saldo de hoje.
// Entra: o salário (se ainda não caiu) e as sessões marcadas (se o consultório conta como entrada).
// Sai: as contas fixas que faltam, no dia do vencimento, e o gasto do dia a dia no ritmo de agora.
// Contas pesadas guardadas por versão dos dados: o db é trocado inteiro a cada mudança (nunca alterado no lugar), então
// a conta feita para um db vale até a próxima mudança, no mesmo dia e com o mesmo perfil. (O Início chamava a previsão
// quatro vezes e as assinaturas três a cada desenho, e o relógio redesenha a cada 30 s.)
const GUARDADAS = new WeakMap();
function guardado(db, nome, fazer) {
  const dia = todayISO();
  let g = GUARDADAS.get(db);
  if (!g || g.dia !== dia || g.perfil !== PERFIL) { g = { dia, perfil: PERFIL, v: {} }; GUARDADAS.set(db, g); }
  if (!(nome in g.v)) g.v[nome] = fazer();
  return g.v[nome];
}

function previsaoMes(db) { return guardado(db, "previsao", () => previsaoAgora(db)); }
function previsaoAgora(db) {
  const P = db.pessoal, hoje = todayISO(), ch = hoje.slice(0, 7), diaHoje = Number(hoje.slice(8, 10));
  const ultimo = new Date(Number(ch.slice(0, 4)), Number(ch.slice(5)), 0).getDate();
  const r = resumoPessoal(db, ch);
  let saldo = r.sobra;
  // ritmo do dia a dia: o deste mês, puxado pelo do mês passado nos primeiros dias (para não oscilar)
  const pm = new Date(Number(ch.slice(0, 4)), Number(ch.slice(5)) - 2, 1), ant = `${pm.getFullYear()}-${pad(pm.getMonth() + 1)}`;
  const varMes = soma(r.saidas, l => l.valor), varAnt = soma(P.lanc.filter(l => l.tipo === "saida" && l.data.startsWith(ant)), l => l.valor);
  const diasAnt = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate();
  const peso = varAnt > 0 ? 7 : 0;
  const ritmo = (varMes + (varAnt / diasAnt) * peso) / (diaHoje + peso);
  const R = P.renda && P.renda.valor > 0 && !(P.renda.lancados || {})[ch] ? P.renda : null;
  const pac = id => db.patients.find(p => p.id === id);
  const liq = p => p.price - (p.subletType === "percent" ? p.price * p.sublet / 100 : p.sublet);
  const contas = P.contas.filter(c => !(c.pagas && c.pagas[ch]));
  const atrasadas = contas.filter(c => vencimento(c, ch) < hoje);
  saldo -= soma(atrasadas, c => c.valor);
  const serie = [saldo];
  let diaNeg = saldo < 0 ? diaHoje : null, entraConsult = 0, saiContas = soma(atrasadas, c => c.valor);
  for (let d = diaHoje + 1; d <= ultimo; d++) {
    const iso = `${ch}-${pad(d)}`;
    if (R && Math.min(R.dia || 5, ultimo) === d) saldo += R.valor;
    if (P.incluirConsultorio && PERFIL.consultorio !== false) { const v = soma(itensDoDia(db, iso).filter(x => x.kind === "next" || x.kind === "proj"), x => liq(x.patient)); saldo += v; entraConsult += v; }
    contas.forEach(c => { if (vencimento(c, ch) === iso) { saldo -= c.valor; saiContas += c.valor; } });
    saldo -= ritmo;
    serie.push(saldo);
    if (saldo < 0 && diaNeg == null) diaNeg = d;
  }
  if (R && Math.min(R.dia || 5, ultimo) <= diaHoje) saldo += R.valor; // o salário de hoje ainda não lançado
  return { fim: saldo, diaNeg: saldo < 0 || diaNeg ? diaNeg : null, ritmo, renda: R ? R.valor : 0, diaRenda: R ? R.dia : null, contas: saiContas, consult: entraConsult, ultimo, diaHoje, serie };
}


function CartaoPrevisao({ db }) {
  const p = previsaoMes(db);
  const hoje = todayISO(), ch = hoje.slice(0, 7), mes = MES_ABREV[fromISO(hoje).getMonth()];
  const feito = useMemo(() => serieSaldo(db, `${ch}-01`, hoje), [db, ch, hoje]);
  if (p.diaHoje >= p.ultimo) return null;
  const ruim = p.fim < 0 || p.diaNeg;
  // o que já aconteceu (linha cheia) e, de hoje até o fim do mês, a previsão (tracejada) que sai do ponto de hoje
  const agora = feito[feito.length - 1] || 0;
  const previsto = [agora, ...p.serie.slice(1)];
  const valorDia = i => (i < p.diaHoje ? feito[i] : previsto[i - p.diaHoje + 1]);
  return (
    <section className={"panel previsao ps-prev" + (ruim ? " ruim" : "")}>
      <div className="panel-head"><h3>Previsão do mês</h3></div>
      <p className="previsao-t">{p.fim >= 0 && !p.diaNeg
        ? <>Nesse ritmo, <b>sobram {brl(p.fim)}</b> no dia {p.ultimo}.</>
        : p.diaNeg && p.diaNeg <= p.diaHoje ? <>O mês já está no vermelho. Nesse ritmo, <b>termina faltando {brl(-Math.min(0, p.fim))}</b>.</>
        : <>Nesse ritmo, <b>falta dinheiro a partir do dia {p.diaNeg || p.ultimo}</b>{p.fim < 0 ? <> ({brl(-p.fim)} no fim do mês)</> : null}.</>}</p>
      <GraficoLinha key={ch} n={p.ultimo} altura={110} cor={ruim ? "var(--amber)" : "var(--mode)"}
        series={[{ v: feito, tipo: "cheia" }, { v: previsto, de: p.diaHoje - 1, tipo: "previsao" }]}
        eixo={eixoDoMes(p.ultimo, p.diaHoje - 1, mes)} legenda={[{ t: "até hoje" }, { t: "previsão", tipo: "previsao" }]}
        dica={i => <><small>{i + 1} de {mes}{i >= p.diaHoje ? " · previsto" : ""}</small>{brl(valorDia(i))}</>}
        rotulo={`Sobra do mês até hoje e a previsão até o dia ${p.ultimo}: ${brl(p.fim)}`} />
      <div className="previsao-itens ps-prev-itens">
        {p.renda > 0 && <span className="mais"><i />+{brl(p.renda)} salário (dia {p.diaRenda})</span>}
        {p.consult > 0 && <span className="mais"><i />+{brl(p.consult)} sessões marcadas</span>}
        {p.contas > 0 && <span className="menos"><i />−{brl(p.contas)} contas que faltam</span>}
        <span className="menos"><i />−{brl(p.ritmo)} por dia no dia a dia</span>
      </div>
      {ruim && <div className="hint">Dá para segurar: um teto em Gastos ajuda a ver onde cortar.</div>}
    </section>
  );
}

// Quanto dá para gastar hoje: o que sobra para o dia a dia até o fim do mês (contas já descontadas),
// dividido pelos dias que faltam, contando hoje
function podeGastar(db) {
  const p = previsaoMes(db), hoje = todayISO();
  const gastoHoje = soma(db.pessoal.lanc.filter(l => l.tipo === "saida" && l.data === hoje), l => l.valor);
  const restam = p.ultimo - p.diaHoje;
  const livre = p.fim + p.ritmo * restam + gastoHoje;
  const porDia = Math.max(0, livre / (restam + 1));
  return { hoje: porDia - gastoHoje, porDia, gastoHoje, livre, restam, fim: p.fim, ultimo: p.ultimo };
}

// "Posso gastar 300 no sábado?": a resposta sai daqui, sem internet
function respostaGastar(db, frase) {
  const P = db.pessoal;
  if (!P.lanc.length && !(P.renda && P.renda.valor)) return "Ainda não tenho seus números. Anote a entrada do mês e alguns gastos que eu consigo responder.";
  const g = podeGastar(db), t = normalizar(frase);
  const m = t.match(/(\d+(?:[.,]\d{1,2})?)\s*(mil)?/);
  if (!m) return g.livre <= 0 ? `Hoje o melhor é segurar: nesse ritmo, o mês fecha faltando ${brlReal(-g.fim)}.` : `Hoje você pode gastar até ${brlReal(Math.max(0, g.hoje))}. Até o dia ${g.ultimo}, o ideal é ${brlReal(g.porDia)} por dia.`;
  const v = Number(m[1].replace(",", ".")) * (m[2] ? 1000 : 1);
  const sobra = g.fim - v, depois = Math.max(0, (g.livre - v) / (g.restam + 1));
  if (sobra >= 0) return `Pode. Nesse ritmo, ainda sobram ${brlReal(sobra)} no dia ${g.ultimo}.${v > g.porDia * 3 ? ` Só que depois disso o ideal cai para ${brlReal(depois)} por dia.` : ""}`;
  if (g.livre - v >= 0) return `Dá, mas fica no limite: para fechar o mês no azul, o resto do dia a dia teria que caber em ${brlReal(depois)} por dia até o dia ${g.ultimo}.`;
  return `Melhor não agora: mesmo sem nenhum outro gasto, faltariam ${brlReal(v - g.livre)} para fechar o mês.`;
}

// "Hoje você pode gastar": um cartão do carrossel do Início (logo depois do "Sobrou"). Tocar pergunta à Bolinha.
function grandeHoje(db, act) {
  const P = db.pessoal;
  if (!P.lanc.length && !(P.renda && P.renda.valor)) return null;
  const g = podeGastar(db), passou = g.hoje < 0, ruim = g.livre <= 0;
  const rotulo = ruim ? "Mês apertado" : passou ? "Hoje já passou do ideal" : "Hoje você pode gastar";
  const v = ruim ? 0 : passou ? -g.hoje : g.hoje;
  const texto = ruim ? `O que entra até o dia ${g.ultimo} não cobre as contas no ritmo de agora. Segure o que der.`
    : passou ? `Tudo bem: amanhã volta a ${brl(g.porDia)} por dia.`
    : g.gastoHoje > 0 ? `Já foram ${brl(g.gastoHoje)} hoje. Até o dia ${g.ultimo}, o ideal é ${brl(g.porDia)} por dia.`
    : `Até o dia ${g.ultimo}, ${brl(g.porDia)} por dia, com as contas pagas.`;
  const chat = servidorAvisos();
  return { id: "hoje", el: (
    <Grande rotulo={rotulo} icone={I.target} cor={ruim ? "var(--rose)" : passou ? "var(--amber)" : "#FF9A4C"} onClick={chat ? act.abrirChat : () => act.setTab("p-gastos")}
      falar={`${rotulo}: ${brl(v)}. ${texto}${chat ? " Toque para perguntar à Bolinha" : ""}`}>
      <b className={"ini-g-v" + (passou || ruim ? " neg" : "")}><Money v={v} /></b>
      <span className="ini-g-apoio">{texto}</span>
      <span className="ini-g-pe">
        {!ruim && <span className="ini-trilho grosso" style={{ "--bc": passou ? "var(--amber)" : "#FF9A4C" }}><i style={{ width: `${Math.min(100, Math.round(g.gastoHoje / (g.porDia || 1) * 100))}%` }} /></span>}
        {chat && <span className="ini-g-pergunta"><I.chat />Pergunte: “posso gastar 200 no sábado?”</span>}
      </span>
    </Grande>
  ) };
}

// Assinaturas esquecidas: o mesmo gasto, com o mesmo valor, em meses diferentes (geralmente vindo do extrato)
const MARCAS_ASSINATURA = new Set(["netflix", "spotify", "deezer", "youtube", "primevideo", "disney", "max", "globoplay", "paramount", "crunchyroll", "appletv", "applemusic", "amazonmusic", "tidal", "telecine", "premiere", "mubi", "kindle", "audible", "skeelo", "skymais", "claro tv"]);
function assinaturasAchadas(db, { usadas = false } = {}) { return guardado(db, usadas ? "assin-usadas" : "assin", () => assinaturasAgora(db, usadas)); }
function assinaturasAgora(db, usadas) {
  const P = db.pessoal, hoje = fromISO(todayISO());
  const meses = [0, 1, 2, 3].map(i => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
  const vistas = P.assinVistas || {};
  const contas = P.contas.map(c => ({ m: c.marca || (acharMarca(c.nome) || {}).id, n: normalizar(c.nome) }));
  const g = new Map();
  P.lanc.forEach(l => {
    const ch = l.data.slice(0, 7);
    if (l.tipo !== "saida" || !meses.includes(ch)) return;
    const k = l.marca || normalizar(l.desc || "").split(" ").slice(0, 3).join(" ");
    if (!k || k.length < 3) return;
    const it = g.get(k) || { k, marca: l.marca || null, nome: (l.marca && (marcaId(l.marca) || {}).nome) || l.desc, cat: l.cat, porMes: {}, ultimo: l.data };
    (it.porMes[ch] = it.porMes[ch] || []).push(l.valor);
    if (l.data > it.ultimo) it.ultimo = l.data;
    g.set(k, it);
  });
  return [...g.values()].filter(it => {
    const ms = Object.keys(it.porMes).sort();
    if (ms.length < 2 || ms.some(m => it.porMes[m].length > 2)) return false;
    const vals = ms.map(m => it.porMes[m][it.porMes[m].length - 1]), ref = vals[vals.length - 1];
    const conhecida = MARCAS_ASSINATURA.has(it.marca);
    if (ref < 3 || ref > 400 || vals.some(v => Math.abs(v - ref) > ref * (conhecida ? .25 : .05))) return false;
    if (!conhecida && ["mercado", "transporte", "combustivel"].includes(it.cat)) return false;
    if (contas.some(c => (it.marca && c.m === it.marca) || c.n === normalizar(it.nome))) return false;
    if (usadas ? vistas[it.k] !== "usa" : vistas[it.k]) return false;
    it.valor = ref; it.dia = Number(it.ultimo.slice(8, 10));
    return true;
  }).sort((a, b) => b.valor - a.valor);
}

function AssinaturasAchadas({ db, act }) {
  const lista = assinaturasAchadas(db);
  if (!lista.length) return null;
  const total = soma(lista, x => x.valor);
  return (
    <div className="panel assin-achadas">
      <div className="panel-head"><h3>Parecem assinaturas</h3><span className="hint" style={{ padding: 0 }}>{brl(total * 12)}/ano</span></div>
      <p className="hint" style={{ padding: "0 0 8px" }}>Achei estes gastos com o mesmo valor todo mês. Ainda usa?</p>
      {lista.map(x => (
        <div key={x.k} className="assin-achada">
          <MarcaLogo marca={x.marca} nome={x.nome} cat={catDe(x.cat)} className="txn-av" />
          <span className="mid"><span className="nm">{x.nome}</span><span className="sb">{brl(x.valor)} por mês · <b>{brl(x.valor * 12)} por ano</b></span></span>
          <div className="assin-achada-bts">
            <button className="chip-btn" onClick={() => act.assinaturaVista(x, "nao")}>Não uso</button>
            <button className="chip-btn on" onClick={() => act.assinaturaVista(x, "usa")}>Uso</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Saldo acumulado dia a dia (entradas − saídas − contas pagas, mais o consultório se conta como entrada).
// Uma passada pelos lançamentos, separando por dia (com milhares de lançamentos, não filtra tudo a cada dia).
function serieSaldo(db, ini, fim) {
  const P = db.pessoal, porDia = new Map(), out = [];
  const somar = (d, v) => porDia.set(d, (porDia.get(d) || 0) + v);
  P.lanc.forEach(l => { if (l.data >= ini && l.data <= fim) somar(l.data, l.tipo === "entrada" ? l.valor : -l.valor); });
  P.contas.forEach(c => Object.values(c.pagas || {}).forEach(d => { if (typeof d === "string" && d >= ini && d <= fim) somar(d, -c.valor); }));
  if (P.incluirConsultorio) (db.sessions || []).forEach(x => { if (x.date >= ini && x.date <= fim && contaDinheiro(x)) somar(x.date, x.price - x.sublet); });
  let acc = 0;
  for (let d = ini; d <= fim; d = addDays(d, 1)) { acc += porDia.get(d) || 0; out.push(acc); }
  return out;
}

function conversaPessoal(db, act) {
  const t = todayISO(), chave = t.slice(0, 7), P = db.pessoal;
  const falas = [];
  if (P.lanc.length === 0 && P.contas.length === 0) {
    falas.push({ txt: <>Aqui você anota o que gasta e as contas da casa. Comece por uma conta fixa, como aluguel ou luz: eu aviso antes de vencer.</>, acao: { l: "Adicionar conta", ic: <I.plus />, fn: () => act.novaConta() } });
    return falas;
  }
  P.contas.forEach(c => {
    const s = situacaoConta(c, chave);
    if (s.st === "atrasada" || s.st === "hoje" || (s.st === "breve" && diffDias(t, vencimento(c, chave)) <= 1)) {
      falas.push({ txt: s.st === "atrasada" ? <>A conta de <b>{c.nome}</b> {s.txt.toLowerCase()} e ainda não está marcada como paga.</> : <><b>{c.nome}</b> {s.txt.toLowerCase()}: {brl(c.valor)}.</>, acao: { l: "Já paguei", ic: <I.check />, fn: () => act.pagarConta(c.id) } });
    }
  });
  const tet = tetosAlerta(db, chave)[0];
  if (tet) falas.push({ txt: tet.pct >= 1 ? <>Você passou do teto de <b>{catDe(tet.cat).nome}</b>: {brl(tet.gasto)} de {brl(tet.teto)} no mês.</> : <><b>{catDe(tet.cat).nome}</b> já está em {Math.round(tet.pct * 100)}% do teto do mês ({brl(tet.gasto)} de {brl(tet.teto)}).</>, acao: { l: "Ver gastos", ic: <I.chart />, fn: () => act.setTab("p-gastos") } });
  const pv = previsaoMes(db);
  if (pv.diaHoje < pv.ultimo && (pv.fim < 0 || pv.diaNeg)) falas.unshift({ txt: pv.diaNeg && pv.diaNeg <= pv.diaHoje ? <>Atenção: o mês já está no vermelho e, nesse ritmo, <b>termina faltando {brl(-Math.min(0, pv.fim))}</b>. Vale segurar os gastos do dia a dia.</> : <>Atenção: nesse ritmo, <b>falta dinheiro a partir do dia {pv.diaNeg || pv.ultimo}</b>. Vale segurar os gastos do dia a dia.</>, acao: { l: "Ver gastos", ic: <I.chart />, fn: () => act.setTab("p-gastos") } });
  const r = resumoPessoal(db, chave);
  falas.push({ txt: <>Neste mês entrou <b>{brl(r.entrou)}</b>{r.consult > 0 ? <> (sendo {brl(r.consult)} do consultório)</> : null} e saiu <b>{brl(r.saiu)}</b>. {r.sobra >= 0 ? <>Sobram {brl(r.sobra)}.</> : <>Está {brl(-r.sobra)} no vermelho.</>}</> });
  const top = Object.entries(r.porCat).sort((a, b) => b[1] - a[1])[0];
  if (top) falas.push({ txt: <>O que mais pesou até agora foi <b>{catDe(top[0]).nome}</b>: {brl(top[1])}.</>, acao: { l: "Ver gastos", ic: <I.chart />, fn: () => act.setTab("p-gastos") } });
  const fa = act.falaAssinatura && act.falaAssinatura();
  if (fa) falas.unshift(fa);
  const achadas = assinaturasAchadas(db);
  if (achadas.length) falas.unshift({ txt: <>Achei {achadas.length === 1 ? <><b>{achadas[0].nome}</b>, que se repete</> : <><b>{achadas.length} gastos</b> que se repetem</>} todo mês com o mesmo valor: {brl(soma(achadas, x => x.valor) * 12)} por ano. Ainda usa?</>, acao: { l: "Ver", ic: <I.bill />, fn: () => act.setTab("p-contas") } });
  const ass = P.contas.filter(c => c.assinatura);
  if (ass.length) falas.push({ txt: <>Suas {ass.length} assinaturas somam {brl(soma(ass, c => c.valor))} por mês, ou {brl(soma(ass, c => c.valor) * 12)} por ano.</>, acao: { l: "Ver assinaturas", ic: <I.bill />, fn: () => act.setTab("p-contas") } });
  return falas.slice(0, ESTILO === "curto" ? 2 : 4);
}


function BillRow({ c, chave, act }) {
  const s = situacaoConta(c, chave), cat = catDe(c.cat);
  const mid = c.semLogo ? null : c.marca || (acharMarca(c.nome) || {}).id;
  const temLogo = !c.semLogo && !!(mid || c.logoSite || logoPropria(c.nome));
  const chip = s.st === "paga" ? "mint" : s.st === "atrasada" ? "rose" : s.st === "hoje" || s.st === "breve" ? "amber" : "ghost";
  return (
    <div className="txn">
      {temLogo ? <span className="bill-logo"><MarcaLogo marca={mid} site={c.logoSite} nome={c.nome} cat={cat} className="txn-av" /><i className="bill-dia" aria-hidden="true">{Number(vencimento(c, chave).slice(8))}</i></span> : <CalBadge iso={vencimento(c, chave)} />}
      <button className="mid" style={{ textAlign: "left" }} onClick={() => act.editConta(c.id)}>
        <span className="nm">{c.nome}</span>
        <span className="sb"><span className={"chip " + chip}>{s.txt}</span><span>{cat.nome}</span></span>
      </button>
      <span className="amt"><Money v={c.valor} /></span>
      <button className={"box " + (s.st === "paga" ? "done" : s.st === "atrasada" || s.st === "hoje" ? "late" : "up")} onClick={() => s.st === "paga" ? act.despagarConta(c.id) : act.pagarConta(c.id)} aria-label={s.st === "paga" ? `Desmarcar ${c.nome}` : `Marcar ${c.nome} como paga`}>
        {s.st === "paga" && <I.check />}
      </button>
    </div>
  );
}

/* ---------- tela inicial: o topo, o carrossel e os cartões que a pessoa escolhe (src/telas/inicio-cartoes.jsx) ---------- */
// O que pede atenção (o resumo, a viagem, a casa) fica antes dos cartões; a previsão e a próxima conquista, depois.
function PessoalHome({ db, conta, now, act, tema, avisos }) {
  const falas = conversaPessoal(db, act);
  const agora = (
    <div className="ini-agora">
      <ViagemAviso db={db} act={act} />
      <div className="acts narrow-only">
        <button className="act" onClick={act.falarGasto}><i><I.mic /></i>Falar</button>
        <button className="act" onClick={() => act.novoLanc("saida")}><i><I.minus /></i>Gasto</button>
        <button className="act" onClick={() => act.novoLanc("entrada")}><i><I.plus /></i>Entrada</button>
        <button className="act" onClick={() => act.novaConta()}><i><I.bill /></i>Conta fixa</button>
      </div>
      <Talk falas={falas} />
      {servidorAvisos() && <div className="small-acts"><button className="chip-btn" onClick={act.abrirChat}><I.chat />Perguntar à Bolinha</button></div>}
      <CasaCartao casa={act.casa} onAbrir={act.abrirCasa} />
    </div>
  );
  return (
    <div className="page ini">
      <TopoInicio conta={conta} act={act} tema={tema} modo="pessoal" now={now} />
      {avisos}
      <WeatherChip cidade={conta.perfil && conta.perfil.cidade} act={act} />
      <Carrossel db={db} modo="pessoal" act={act} extras={[grandeHoje(db, act)]} />
      <CartoesInicio db={db} modo="pessoal" act={act} now={now}
        antes={[{ id: "agora", el: agora, h: 200 + falas.length * 90 + (act.casa && act.casa.casa ? 80 : 0) }]}
        depois={[{ id: "previsao", el: <CartaoPrevisao db={db} />, h: 330 }, { id: "conquista", el: <ProximaConquista act={act} trilhas={["dinheiro", "app"]} />, h: 110 }]} />
    </div>
  );
}

// Para onde foi o dinheiro: compara com o mês anterior (no mês corrente, só até o mesmo dia, para ser justo)
function ParaOndeFoi({ db, chave, act }) {
  const hoje = todayISO(), corrente = chave === hoje.slice(0, 7);
  const [a, m] = chave.split("-").map(Number), pd = new Date(a, m - 2, 1);
  const ant = `${pd.getFullYear()}-${pad(pd.getMonth() + 1)}`;
  const dia = corrente ? Number(hoje.slice(8, 10)) : 31;
  const ate = iso => typeof iso !== "string" || Number(iso.slice(8, 10)) <= dia;
  const porCat = ch => {
    const out = {};
    db.pessoal.lanc.forEach(l => { if (l.tipo === "saida" && l.data.startsWith(ch) && ate(l.data)) out[l.cat] = (out[l.cat] || 0) + l.valor; });
    db.pessoal.contas.forEach(c => { const pg = c.pagas && c.pagas[ch]; if (pg && ate(pg)) out[c.cat] = (out[c.cat] || 0) + c.valor; });
    return out;
  };
  const agora = porCat(chave), antes = porCat(ant);
  const tA = Object.values(agora).reduce((s, v) => s + v, 0), tB = Object.values(antes).reduce((s, v) => s + v, 0);
  if (tB < 1 || tA < 1) return null;
  const difs = [...new Set([...Object.keys(agora), ...Object.keys(antes)])].map(id => ({ id, a: agora[id] || 0, b: antes[id] || 0, d: (agora[id] || 0) - (antes[id] || 0) }));
  const subiu = difs.filter(x => x.d >= 20 && x.d >= x.b * .15).sort((x, y) => y.d - x.d).slice(0, 3);
  const caiu = difs.filter(x => x.d <= -20).sort((x, y) => x.d - y.d)[0];
  const delta = tA - tB, pct = Math.round(delta / tB * 100);
  const nomeAnt = MES_LONGO[pd.getMonth()];
  return (
    <section className="panel pof">
      <Ilustra n="carrinho" className="pof-ilu" />
      <div className="panel-head"><h3>Para onde foi o dinheiro</h3></div>
      <p className={"pof-resumo " + (delta > 0 ? "mais" : "menos")}>
        {Math.abs(delta) < 10 ? <>Quase igual a {nomeAnt}{corrente ? ` até o dia ${dia}` : ""}.</>
          : <><b>{brl(Math.abs(delta))} {delta > 0 ? "a mais" : "a menos"}</b> que em {nomeAnt}{corrente ? ` até o dia ${dia}` : ""} ({delta > 0 ? "+" : "−"}{Math.abs(pct)}%).</>}
      </p>
      {subiu.map(x => { const cat = catDe(x.id); return (
        <button key={x.id} className="pof-linha" style={catVars(cat)} onClick={() => x.id === "transporte" ? act.abrirTransporte() : act.abrirTeto(x.id)}>
          <span className="ci"><CatIcon cat={cat} /></span>
          <span className="mid"><b>{cat.nome}</b><small>{x.b > 0 ? `de ${brl(x.b)} para ${brl(x.a)}` : `${brl(x.a)}, nada em ${nomeAnt}`}</small></span>
          <b className="pof-up">+{brl(x.d)}</b>
        </button>
      ); })}
      {caiu && <div className="pof-caiu"><I.check /><span>Economizou <b>{brl(-caiu.d)}</b> em {catDe(caiu.id).nome.toLowerCase()}.</span></div>}
      {!subiu.length && !caiu && <div className="hint">Nenhuma categoria mudou muito. Ritmo parecido com {nomeAnt}.</div>}
    </section>
  );
}


// altura que um dia ocupa na lista antes de ser desenhado (título + linhas; a do banco tem uma linha a mais):
// fora da tela o navegador não desenha o dia (content-visibility), e a rolagem não pula
const alturaGrupo = g => 46 + soma(g.itens, l => (nomeBanco(l.banco) ? 84 : 66));
// quantas linhas a lista desenha de cada vez (as outras entram ao chegar perto do fim; mil lançamentos não travam)
const LOTE = 60;

function GastosTab({ db, act, tema }) {
  const [off, setOff] = useState(0);
  const [filtro, setFiltro] = useState("tudo");
  const [cat, setCat] = useState(null); // categoria escolhida (na lista de categorias ou nos filtros)
  const [banco, setBanco] = useState(null); // só o que veio deste banco
  const [busca, setBusca] = useState("");
  const [todasCats, setTodasCats] = useState(false);
  const termo = normalizar(useDeferredValue(busca)); // digitar não espera a lista
  const base = new Date(), hoje = todayISO();
  const m = new Date(base.getFullYear(), base.getMonth() + off, 1), pm = new Date(m.getFullYear(), m.getMonth() - 1, 1);
  const chave = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, chAnt = `${pm.getFullYear()}-${pad(pm.getMonth() + 1)}`;
  const P = db.pessoal, lancs = P.lanc;
  const r = useMemo(() => resumoPessoal(db, chave), [db, chave]);
  const tetos = P.limites || {};
  // categorias com gasto no mês + as que têm teto (mesmo sem gasto ainda)
  const cats = [...Object.entries(r.porCat), ...Object.keys(tetos).filter(id => tetos[id] > 0 && !r.porCat[id]).map(id => [id, 0])].sort((a, b) => b[1] - a[1]);
  const totalCat = soma(cats, c => c[1]) || 1;
  // o ritmo do mês: no mês atual, compara com o anterior até o mesmo dia
  const atual = off === 0, hojeD = Number(hoje.slice(8, 10));
  // o gráfico tem os dias do mês mostrado; o mês passado entra até o mesmo dia (o dia 31 de outubro não vira "31 de nov")
  const nM = diasDoMes(m), nA = diasDoMes(pm);
  const serieA = useMemo(() => acumuladoMes(db, chave, nM).slice(0, atual ? hojeD : nM), [lancs, P.contas, chave, atual, hojeD]);
  const serieB = useMemo(() => acumuladoMes(db, chAnt, nA), [lancs, P.contas, chAnt]);
  const antAte = serieB[Math.min(atual ? hojeD : nA, nA) - 1] || 0, agoraAte = serieA[serieA.length - 1] || 0;
  const mudarMes = k => { setOff(k); setCat(null); vibrar("toque"); };

  // a lista: do mês (ou, buscando, de todos os meses), com os filtros, agrupada por dia
  const doMes = useMemo(() => lancs.filter(l => l.data.startsWith(chave)), [lancs, chave]);
  const lista = useMemo(() => {
    let x = termo ? lancs.filter(l => buscavel(l).includes(termo)) : doMes;
    if (cat) x = x.filter(l => l.tipo === "saida" && l.cat === cat);
    else if (filtro !== "tudo") x = x.filter(l => l.tipo === filtro);
    if (banco) x = x.filter(l => nomeBanco(l.banco) === banco);
    return [...x].sort((a, b) => b.data.localeCompare(a.data));
  }, [lancs, doMes, termo, cat, filtro, banco]);
  const grupos = useMemo(() => {
    const g = [];
    lista.forEach(l => { let u = g[g.length - 1]; if (!u || u.d !== l.data) g.push(u = { d: l.data, itens: [], saiu: 0 }); u.itens.push(l); if (l.tipo === "saida") u.saiu += l.valor; });
    return g;
  }, [lista]);
  // filtros: os bancos de onde vieram lançamentos e as categorias com gasto no mês
  const bancos = useMemo(() => [...new Set(lancs.map(l => nomeBanco(l.banco)).filter(Boolean))].slice(0, 4), [lancs]);
  const catsChip = useMemo(() => { const t = {}; doMes.forEach(l => { if (l.tipo === "saida") t[l.cat] = (t[l.cat] || 0) + l.valor; }); return Object.keys(t).sort((a, b) => t[b] - t[a]); }, [doMes]);
  const algumFiltro = !!(cat || banco || filtro !== "tudo");
  const limpar = () => { setCat(null); setBanco(null); setFiltro("tudo"); vibrar("toque"); };

  // desenha aos poucos: um lote agora e mais ao chegar perto do fim
  const [mostra, setMostra] = useState(LOTE);
  useEffect(() => { setMostra(LOTE); }, [chave, termo, cat, filtro, banco]);
  const fimRef = useRef(null);
  useEffect(() => {
    const el = fimRef.current;
    if (!el || mostra >= lista.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setMostra(k => k + LOTE * 2); }, { rootMargin: "900px 0px" });
    io.observe(el); return () => io.disconnect();
  }, [mostra, lista.length]);
  const visiveis = [];
  for (let resta = mostra, k = 0; k < grupos.length && resta > 0; k++) { const g = grupos[k]; visiveis.push(resta >= g.itens.length ? g : { ...g, itens: g.itens.slice(0, resta) }); resta -= g.itens.length; }

  // Seleção para apagar vários de uma vez
  const [sel, setSel] = useState(null); // null = modo normal; Set de ids = selecionando
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => { setSel(null); }, [off, filtro, cat, banco, termo]);
  const marcar = useCallback(id => setSel(s => { const n = new Set(s || []); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const segurar = useCallback(id => { vibrar("toque"); setSel(s => new Set([...(s || []), id])); }, []);
  // act muda a cada desenho do app: pela referência, a linha (memo) não precisa redesenhar por isso
  const actRef = useRef(act); actRef.current = act;
  const abrir = useCallback(id => actRef.current.editLanc(id), []);
  const todos = sel && lista.length > 0 && lista.every(l => sel.has(l.id));
  const nomeMes = MES_LONGO[m.getMonth()], ano = m.getFullYear() !== base.getFullYear() ? ` de ${m.getFullYear()}` : "";
  const mesAb = MES_ABREV[m.getMonth()], antAb = MES_ABREV[pm.getMonth()];
  const ct = cat && catDe(cat), teto = cat ? tetos[cat] || 0 : 0, gastoCat = cat ? r.porCat[cat] || 0 : 0;
  const temGraf = (serieA.length > 1 && agoraAte > 0) || serieB[nA - 1] > 0;
  const comConsult = r.consult > 0 && filtro !== "saida" && !cat && !banco && !termo;
  const catsVer = todasCats || cats.length <= 5 ? cats : cats.filter((c, k) => k < 4 || c[0] === cat);
  return (
    <div className="page g4">
      <TopBar eyebrow={`${nomeMes} de ${m.getFullYear()}`} title="Gastos" act={act} tema={tema} />
      <div className="cols">
        <div className="col">
          <Topo rotulo={<>Saiu em <b>{nomeMes}</b>{ano}</>} valor={r.saiu} nav={{ ant: () => mudarMes(off - 1), prox: () => mudarMes(off + 1), podeProx: true }}
            apoio={<Comparacao agora={atual ? agoraAte : r.saiu} antes={atual ? antAte : serieB[nA - 1] || 0} nomeAnt={MES_LONGO[pm.getMonth()]} ateDia={atual ? hojeD : null} />}>
            {temGraf ? <div className="ps-topo-g"><GraficoLinha key={chave} n={nM} altura={128}
              series={[...(serieB[nA - 1] > 0 ? [{ v: serieB.slice(0, nM), tipo: "fantasma" }] : []), ...(serieA.length > 1 ? [{ v: serieA, tipo: "cheia" }] : [])]}
              eixo={eixoDoMes(nM, atual ? hojeD - 1 : null, mesAb)}
              legenda={[{ t: nomeMes }, ...(serieB[nA - 1] > 0 ? [{ t: MES_LONGO[pm.getMonth()], tipo: "fantasma" }] : [])]}
              dica={i => <><small>{i + 1} de {mesAb}</small>{i < serieA.length ? brl(serieA[i]) : "—"}{serieB[i] != null && serieB[nA - 1] > 0 && <em>{antAb}: {brl(serieB[i])}</em>}</>}
              rotulo={`Gastos acumulados em ${nomeMes}: ${brl(r.saiu)}`} /></div> : null}
            <FluxoMes entrou={r.entrou} saiu={r.saiu} aPagar={r.aPagar} />
          </Topo>

          {cats.length > 0 && <section className="ps-card ps-cats" aria-label="Gastos por categoria">
            <div className="ps-card-h"><span>Por categoria</span><button className="link" onClick={() => act.abrirTeto()}>{Object.values(tetos).some(v => v > 0) ? "Tetos" : "Definir tetos"}</button></div>
            <BarraCategorias cats={cats.filter(c => c[1] > 0)} total={totalCat} />
            <div className="ps-cats-lista">
              {catsVer.map(([id, v]) => <LinhaCategoria key={id} id={id} v={v} total={totalCat} teto={tetos[id] > 0 ? tetos[id] : 0} on={cat === id} apaga={!!cat && cat !== id}
                onClick={() => { setCat(cat === id ? null : id); setFiltro("tudo"); vibrar("toque"); }} />)}
            </div>
            {cats.length > 5 && <button type="button" className="link ps-card-pe" onClick={() => setTodasCats(!todasCats)}>{todasCats ? "Ver menos" : `Ver as ${cats.length} categorias`}</button>}
          </section>}

          {cat && <section className="g4-foco">
            <CatBolinha cat={ct} p={teto ? gastoCat / teto : 1} tam={44} />
            <span className="mid"><b>{ct.nome}: {brl(gastoCat)} em {nomeMes}</b><small>{teto ? (gastoCat > teto ? `Passou ${brl(gastoCat - teto)} do teto de ${brl(teto)}` : `${Math.round((gastoCat / teto) * 100)}% do teto de ${brl(teto)}`) : "Sem teto. Com um teto, eu aviso quando chegar perto."}</small></span>
            <span className="g4-foco-acts">
              {cat === "transporte" ? <button className="c2-btn forte" onClick={act.abrirTransporte}>Abrir</button> : <button className="c2-btn forte" onClick={() => act.abrirTeto(cat)}>{teto ? "Mudar teto" : "Pôr teto"}</button>}
              <button className="icon-btn" onClick={() => setCat(null)} aria-label="Ver todas as categorias"><I.x /></button>
            </span>
          </section>}

          <ParaOndeFoi db={db} chave={chave} act={act} />
        </div>
        <div className="col">
          <div className="panel g4-lanc ps-ativ">
            {sel ? (
              <div className="panel-head sel-head">
                <h3>{sel.size ? `${sel.size} ${sel.size === 1 ? "selecionado" : "selecionados"}` : "Toque para selecionar"}</h3>
                <span className="panel-acts">
                  <button className="link" onClick={() => setSel(todos ? new Set() : new Set(lista.map(l => l.id)))}>{todos ? "Desmarcar tudo" : "Selecionar tudo"}</button>
                  <button className="link" onClick={() => setSel(null)}>Cancelar</button>
                </span>
              </div>
            ) : (
              <div className="g4-lanc-topo ps-ativ-topo">
                <h3>{termo ? "Busca" : cat ? ct.nome : <>{nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} <span>{m.getFullYear()}</span></>}</h3>
                <span className="panel-acts">
                  {lista.length > 0 && <button className="link" onClick={() => setSel(new Set())}><I.check /> Selecionar</button>}
                  <button className="link" onClick={act.importar}><I.upload /> Importar</button>
                  <button className="link" onClick={() => act.novoLanc("saida")}>+ Novo</button>
                </span>
              </div>
            )}
            <label className="ps-busca">
              <I.search />
              <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar" enterKeyHint="search" autoComplete="off" aria-label="Buscar nos lançamentos de todos os meses" />
              {busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar a busca"><I.x /></button>}
            </label>
            <div className="ps-chips" role="group" aria-label="Filtros">
              <button type="button" className={"ps-chip" + (!algumFiltro ? " on" : "")} aria-pressed={!algumFiltro} onClick={limpar}>Tudo</button>
              {[["saida", "Saídas"], ["entrada", "Entradas"]].map(([v, l]) => <button key={v} type="button" className={"ps-chip" + (!cat && filtro === v ? " on" : "")} aria-pressed={!cat && filtro === v}
                onClick={() => { setCat(null); setFiltro(!cat && filtro === v ? "tudo" : v); vibrar("toque"); }}>{l}</button>)}
              {bancos.map(b => <button key={b} type="button" className={"ps-chip" + (banco === b ? " on" : "")} aria-pressed={banco === b} onClick={() => { setBanco(banco === b ? null : b); vibrar("toque"); }}><SeloBanco banco={b} />{b}</button>)}
              {catsChip.map(id => { const c = catDe(id); return <button key={id} type="button" className={"ps-chip" + (cat === id ? " on" : "")} style={catVars(c)} aria-pressed={cat === id} onClick={() => { setCat(cat === id ? null : id); setFiltro("tudo"); vibrar("toque"); }}><span className="ps-chip-cor" aria-hidden="true" />{c.nome}</button>; })}
            </div>
            {termo && <div className="ps-ativ-info">{lista.length ? `${lista.length} ${lista.length === 1 ? "lançamento" : "lançamentos"} em todos os meses` : `Nada com “${busca.trim()}”${algumFiltro ? " nesses filtros" : ""}.`}</div>}
            {comConsult && (
              <div className="ps-at">
                <span className="ps-at-av"><span className="txn-av cat" style={catVars({ cor: "azul" })}><I.logo /></span></span>
                <span className="ps-at-mid"><span className="ps-at-nm">Consultório</span><span className="ps-at-sb">Líquido das sessões</span></span>
                <span className="ps-at-v entra">+{brl(r.consult)}</span>
              </div>
            )}
            {grupos.length === 0 && !comConsult && !termo && <div className="empty com-ilustra"><Ilustra n="arquivo" /><b>{algumFiltro ? "Nada nesses filtros" : "Nada por aqui neste mês"}</b>{algumFiltro ? <button className="ghost-chip" onClick={limpar}><I.x /> Tirar os filtros</button> : <><span className="empty-tx">Anote falando ou traga tudo do banco de uma vez.</span><button className="ghost-chip" onClick={act.importar}><I.upload /> Importar extrato</button></>}</div>}
            {visiveis.map(g => (
              <section key={g.d} className="ps-grupo" aria-label={tituloDia(g.d, hoje)} style={{ containIntrinsicSize: `auto ${alturaGrupo(g)}px` }}>
                <div className="ps-dia"><h4>{tituloDia(g.d, hoje)}</h4>{g.saiu > 0 && g.itens.length > 1 && <small>−{brl(g.saiu)}</small>}</div>
                {g.itens.map(l => <LancRow key={l.id} l={l} onAbrir={abrir} sel={!!sel} marcado={!!sel && sel.has(l.id)} onMarcar={marcar} onSegurar={segurar} hoje={hoje} oculto={ESCONDER} />)}
              </section>
            ))}
            {mostra < lista.length && <div ref={fimRef} className="ps-ativ-mais"><button className="link" onClick={() => setMostra(k => k + LOTE * 2)}>Mostrar mais ({lista.length - mostra})</button></div>}
          </div>
        </div>
      </div>
      {sel && (
        <div className="sel-barra" role="toolbar" aria-label="Ações da seleção">
          <span>{sel.size ? `${sel.size} ${sel.size === 1 ? "lançamento" : "lançamentos"} · ${brl(soma(lista.filter(l => sel.has(l.id)), l => l.valor))}` : "Nada selecionado"}</span>
          {act.casa && act.casa.casa && <button className="sel-casa" disabled={!sel.size} onClick={() => { act.trazerParaCasa([...sel]); setSel(null); }}><I.users /> Casa</button>}
          <button className="sel-apagar" disabled={!sel.size} onClick={() => setConfirmar(true)}><I.trash /> Apagar</button>
        </div>
      )}
      {confirmar && sel && <Confirmar titulo={`Apagar ${sel.size} ${sel.size === 1 ? "lançamento" : "lançamentos"}?`} texto="Eles saem do extrato e dos totais do mês. Logo depois aparece a opção de desfazer." acao="Apagar" icon={<I.trash />}
        onSim={() => { act.apagarLancs([...sel]); setSel(null); }} onFim={() => setConfirmar(false)} />}
    </div>
  );
}

// A régua do mês: cada conta no dia em que vence (paga fica apagada, com um visto), e a marca de hoje
function ReguaContas({ contas, chave, hoje }) {
  const [a, mm] = chave.split("-").map(Number), n = new Date(a, mm, 0).getDate(), dh = Number(hoje.slice(8, 10));
  const pos = d => `${((Math.min(d, n) - 1) / (n - 1)) * 100}%`;
  // a largura de verdade da régua: decide quantos dias cabem entre duas logos sem uma cortar a outra
  const ref = useRef(null);
  const [W, setW] = useState(280);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    setW(el.clientWidth || 280);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || 280));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const minDias = 46 / (W / (n - 1)); // 46 px entre os centros: a logo (32) e o "+2"
  // contas que vencem perto umas das outras viram uma pilha só: na frente a logo da que mais importa
  // (atrasada, depois a que falta pagar) e um "+2" com quantas mais (logos lado a lado se cortavam)
  const ord = contas.map(c => ({ c, d: Number(vencimento(c, chave).slice(8, 10)), paga: !!(c.pagas && c.pagas[chave]) })).sort((x, y) => x.d - y.d);
  let grupos = ord.map(x => ({ itens: [x], meio: x.d }));
  for (let k = 1; k < grupos.length;) {
    const g0 = grupos[k - 1], g1 = grupos[k];
    if (g1.meio - g0.meio < minDias) { const itens = [...g0.itens, ...g1.itens]; grupos.splice(k - 1, 2, { itens, meio: itens.reduce((s, x) => s + x.d, 0) / itens.length }); k = Math.max(1, k - 1); }
    else k++;
  }
  const peso = x => (x.paga ? 2 : x.d < dh ? 0 : 1);
  return (
    <div className="g4-regua" aria-hidden="true" ref={ref}>
      <div className="g4-regua-linha"><i style={{ width: pos(dh) }} /></div>
      {grupos.map((g, gi) => { const meio = g.meio, abertas = g.itens.filter(x => !x.paga), todasPagas = !abertas.length, atrasada = abertas.some(x => x.d < dh);
        const { c } = [...g.itens].sort((a, b) => peso(a) - peso(b) || a.d - b.d)[0], mid = c.semLogo ? null : c.marca || (acharMarca(c.nome) || {}).id;
        return (
        <span key={gi} className={"g4-regua-c" + (g.itens.length > 1 ? " varias" : "") + (todasPagas ? " paga" : atrasada ? " atrasada" : "")} style={{ left: pos(meio), "--k": 0 }} title={g.itens.map(x => `${x.c.nome} (dia ${x.d})`).join(", ")}>
          <span className="g4-regua-pilha"><MarcaLogo key={c.id} marca={mid} site={c.logoSite} nome={c.nome} cat={catDe(c.cat)} className="txn-av" /></span>
          {g.itens.length > 1 && <em>+{g.itens.length - 1}</em>}
          {todasPagas && <i><I.check /></i>}
          <small>{g.itens.length > 1 && g.itens[0].d !== g.itens[g.itens.length - 1].d ? `${g.itens[0].d}–${g.itens[g.itens.length - 1].d}` : g.itens[0].d}</small>
        </span>
      ); })}
      <span className="g4-regua-hoje" style={{ left: pos(dh) }}><b>hoje</b></span>
      <div className="g4-regua-dias"><span>1</span><span>{n}</span></div>
    </div>
  );
}

function ContasTab({ db, act, tema }) {
  const t = todayISO(), chave = t.slice(0, 7);
  const [verPagas, setVerPagas] = useState(false);
  const contas = [...db.pessoal.contas].sort((a, b) => a.dia - b.dia);
  const abertas = contas.filter(c => !(c.pagas && c.pagas[chave]));
  const pagas = contas.filter(c => c.pagas && c.pagas[chave]);
  const usadas = assinaturasAchadas(db, { usadas: true });
  const assin = contas.filter(c => c.assinatura);
  const totAssin = soma(assin, c => c.valor) + soma(usadas, x => x.valor);
  const total = soma(contas, c => c.valor), pago = soma(pagas, c => c.valor), falta = soma(abertas, c => c.valor);
  // as que faltam, pela urgência
  const semana = addDays(t, 7);
  const atrasadas = abertas.filter(c => vencimento(c, chave) < t), logo = abertas.filter(c => vencimento(c, chave) >= t && vencimento(c, chave) <= semana), depois = abertas.filter(c => vencimento(c, chave) > semana);
  const Grupo = ({ titulo, lista, cls }) => lista.length > 0 && (
    <div className={"panel g4-grupo " + (cls || "")}>
      <div className="panel-head"><h3>{titulo}</h3><small className="num">{brl(soma(lista, c => c.valor))}</small></div>
      {lista.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}
    </div>
  );
  return (
    <div className="page g4" style={{ maxWidth: 820 }}>
      <TopBar eyebrow={`${MES_LONGO[fromISO(t).getMonth()]} · ${pagas.length} de ${contas.length} pagas`} title="Contas fixas" act={act} tema={tema}
        extra={<><button className="icon-btn" onClick={act.lerBoleto} aria-label="Ler boleto"><I.scan /></button><button className="icon-btn" onClick={() => act.novaConta()} aria-label="Nova conta"><I.plus /></button></>} />
      <div className="stack">
        <Topo rotulo={<>Falta pagar em <b>{MES_LONGO[fromISO(t).getMonth()]}</b></>} valor={falta}
          apoio={contas.length ? <span>{brl(pago)} de {brl(total)} já pagos</span> : <span>Nenhuma conta fixa ainda</span>}>
          {contas.length > 0 && <div className="g4-prog" role="img" aria-label={`${Math.round((pago / (total || 1)) * 100)}% pago`}><i style={{ width: `${(pago / (total || 1)) * 100}%` }} /></div>}
          {contas.length > 0 && <ReguaContas contas={contas} chave={chave} hoje={t} />}
        </Topo>
        {contas.length === 0 && <button className="btn mode" onClick={() => act.novaConta()}><I.plus /> Adicionar primeira conta</button>}
        {contas.length > 0 && abertas.length === 0 && <div className="panel"><div className="empty com-ilustra"><Ilustra n="cafe" /><b>Tudo pago</b>Nenhuma conta pendente neste mês.</div></div>}
        <Grupo titulo="Atrasadas" lista={atrasadas} cls="atrasadas" />
        <Grupo titulo="Nos próximos 7 dias" lista={logo} />
        <Grupo titulo="Mais para a frente" lista={depois} />
        {pagas.length > 0 && <div className="panel g4-grupo pagas">
          <button className="panel-head g4-pagas-b" onClick={() => setVerPagas(!verPagas)} aria-expanded={verPagas}><h3>Pagas <span>({pagas.length})</span></h3><small className="num">{brl(pago)} <I.chev /></small></button>
          {verPagas && pagas.map(c => <BillRow key={c.id} c={c} chave={chave} act={act} />)}
        </div>}
        <AssinaturasAchadas db={db} act={act} />
        {(assin.length > 0 || usadas.length > 0) && (
          <div className="panel g4-assin">
            <div className="g4-assin-topo">
              <span className="c3-pilha" aria-hidden="true">{[...assin.map(c => ({ k: c.id, marca: c.semLogo ? null : c.marca || (acharMarca(c.nome) || {}).id, site: c.logoSite, nome: c.nome, cat: c.cat })), ...usadas.map(x => ({ k: x.k, marca: x.marca, nome: x.nome, cat: x.cat }))].slice(0, 5).map((x, i) => <span key={x.k} style={{ "--k": i }}><MarcaLogo marca={x.marca} site={x.site} nome={x.nome} cat={catDe(x.cat)} className="txn-av" /></span>)}</span>
              <span className="g4-assin-n"><small>Assinaturas</small><b className="num"><Money v={totAssin} /></b><small>por mês · {brl(totAssin * 12)} por ano</small></span>
            </div>
            {usadas.map(x => (
              <div key={x.k} className="assin-achada">
                <MarcaLogo marca={x.marca} nome={x.nome} cat={catDe(x.cat)} className="txn-av" />
                <span className="mid"><span className="nm">{x.nome}</span><span className="sb">Vem no extrato · {brl(x.valor * 12)} por ano</span></span>
                <span className="amt"><Money v={x.valor} /></span>
              </div>
            ))}
            {assin.map(c => (
              <button key={c.id} className="txn" onClick={() => act.editConta(c.id)}>
                <MarcaLogo marca={c.semLogo ? null : c.marca || (acharMarca(c.nome) || {}).id} site={c.semLogo ? null : c.logoSite} nome={c.nome} cat={catDe(c.cat)} className="txn-av" />
                <span className="mid"><span className="nm">{c.nome}</span><span className="sb">{c.moeda ? `${ESCONDER ? "•••" : fmtMoeda(c.valorOrig, c.moeda)}${c.iof !== false ? " + IOF" : ""} · ` : ""}Todo dia {c.dia} · {brl(c.valor * 12)} por ano</span></span>
                <span className="amt"><Money v={c.valor} /></span>
              </button>
            ))}
            <p className="hint" style={{ padding: "4px 0 12px" }}>Ainda usa todas? Cancelar uma que você esqueceu é dinheiro de volta todo mês.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// campos que outras telas guardam no lançamento (transporte, extrato, voz): editar aqui não pode apagar
// (banco: de onde veio pelo Open Finance; casaId: o gasto também está na casa; rendaMes: o salário lançado sozinho)
const extrasDe = l => { if (!l) return {}; const o = {}; ["sub", "litros", "precoLitro", "combustivel", "km", "manut", "importId", "via", "banco", "casaId", "rendaMes", "obs"].forEach(k => { if (l[k] !== undefined) o[k] = l[k]; }); return o; };
// Início pessoal: a casa compartilhada (ou o convite para criar uma)
function CasaCartao({ casa, onAbrir }) {
  if (!casa || ["carregando", "indisponivel", "erro"].includes(casa.estado) && !casa.casa) return null;
  if (!casa.casa) return (
    <button className="casa-cartao vazio" onClick={onAbrir}>
      <span className="casa-cartao-ic"><I.users /></span>
      <span className="tx"><b>Divide as contas com alguém?</b><small>Dinheiro a dois ou em família: quem pagou o quê e quem deve quanto.</small></span>
      <I.chev />
    </button>
  );
  const { dividas } = saldosCasa(casa.lanc, casa.acertos, casa.membros);
  const minha = dividas.find(d => d.de === casa.eu || d.para === casa.eu);
  const nome = id => ((casa.membros.find(m => m.id === id) || {}).nome || "Alguém");
  const ch = todayISO().slice(0, 7), mes = casa.lanc.filter(l => (l.data || "").startsWith(ch)).reduce((s, l) => s + l.valor, 0);
  return (
    <button className="casa-cartao" onClick={onAbrir}>
      <span className="casa-cartao-av">{casa.membros.slice(0, 3).map(m => <i key={m.id}>{m.foto ? <img src={m.foto} alt="" /> : iniciais(m.nome || "?")}</i>)}</span>
      <span className="tx"><b>{casa.casa.nome}</b><small>{casa.membros.length < 2 ? "Convide quem divide as contas com você" : minha ? (minha.de === casa.eu ? `Você deve ${brl(minha.valor)} para ${nome(minha.para)}` : `${nome(minha.de)} te deve ${brl(minha.valor)}`) : `Tudo acertado · ${brl(mes)} da casa este mês`}</small></span>
      <I.chev />
    </button>
  );
}

function LancSheet({ inicial, pre, tipo: tipo0, viagem, casa, onVoz, onFoto, onSave, onDelete, onClose, onLogo }) {
  const [dividir, setDividir] = useState(false);
  const fotoRef = useRef(null);
  const cot = useCotacoes();
  const [tipo, setTipo] = useState(inicial ? inicial.tipo : pre ? pre.tipo : tipo0);
  const orig = inicial || pre || null;
  const [moeda, setMoeda] = useState(orig && orig.moeda ? orig.moeda : !inicial && viagem ? viagem.moeda : "BRL");
  const [iof, setIof] = useState(orig && orig.moeda ? orig.iof !== false : viagem ? viagem.iof !== false : true);
  const [valor, setValor] = useState(orig && orig.moeda && orig.valorOrig ? fmtNum(orig.valorOrig) : inicial ? fmtNum(inicial.valor) : pre && pre.valor ? fmtNum(pre.valor) : "");
  const [cat, setCat] = useState(inicial ? inicial.cat : pre ? pre.cat : null);
  const [desc, setDesc] = useState(inicial ? inicial.desc : pre ? pre.desc : "");
  const [escolha, setEscolha] = useState(() => escolhaInicial(inicial));
  const efDesc = escolhaEfetiva(desc, escolha);
  useEffect(() => { if (!cat && tipo === "saida" && efDesc && efDesc.cat && CATEGORIAS.some(c => c.id === efDesc.cat)) setCat(efDesc.cat); }, [efDesc && efDesc.cat]);
  const [data, setData] = useState(inicial ? inicial.data : pre ? pre.data || addDays(todayISO(), -(pre.off || 0)) : todayISO());
  const [frase, setFrase] = useState("");
  const [entendi, setEntendi] = useState(null);
  const aplicar = txt => {
    setFrase(txt);
    if (!txt.trim()) { setEntendi(null); return; }
    const r = interpretarFala(txt);
    setTipo(r.tipo); setCat(r.cat); setData(addDays(todayISO(), -r.off));
    if (r.moeda) { setMoeda(r.moeda); setIof(!!r.iof || r.tipo === "entrada"); if (r.valorOrig) setValor(fmtNum(r.valorOrig)); }
    else { if (!viagem) setMoeda("BRL"); if (r.valor) setValor(fmtNum(r.valor)); }
    if (r.desc) { setDesc(r.desc); setEscolha(null); }
    setEntendi(r);
  };
  const lista = tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
  const v = num(valor);
  const fora = moeda !== "BRL";
  // edição de um gasto antigo: mantém a cotação do dia em que ele foi feito
  const cotUsada = fora ? (inicial && inicial.moeda === moeda && inicial.cotacao ? inicial.cotacao : cot.moedas[moeda]) : 1;
  const iofOn = fora && iof && tipo === "saida";
  const emR = fora ? emReais(v, moeda, iofOn, cotUsada) : v;
  const simb = fora ? fmtMoeda(0, moeda).replace(/[\d\s.,]/g, "") : "R$";
  const ok = v > 0 && cat && lista.some(c => c.id === cat);
  return (
    <Sheet title={inicial ? "Editar lançamento" : tipo === "entrada" ? "Nova entrada" : "Novo gasto"} onClose={onClose}>
      {!inicial && <>
        <div className="voice">
          <input id="l-frase" value={frase} onChange={e => aplicar(e.target.value)} placeholder='Fale ou escreva: "gastei 32 na padaria"' enterKeyHint="done" autoComplete="off" aria-label="Descreva o gasto em uma frase" />
          {onFoto && <button type="button" className="mic foto" onClick={() => fotoRef.current && fotoRef.current.click()} aria-label="Foto do comprovante"><I.camera /></button>}
          <button type="button" className="mic" onClick={onVoz} aria-label="Falar"><I.mic /></button>
          {onFoto && <input ref={fotoRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onFoto(f); }} />}
        </div>
        {pre && pre.daFoto && <div className="voice-ok"><I.check /><span>Li a foto: {pre.tipo === "entrada" ? "entrada" : "gasto"} de {brlReal(pre.valor)}{pre.desc ? ` em ${pre.desc}` : ""}. Confira e salve.</span></div>}
        {entendi && entendi.valor > 0 && <div className="voice-ok"><I.check /><span>Entendi: {entendi.tipo === "entrada" ? "entrada" : "gasto"} de {entendi.moeda ? `${fmtMoeda(entendi.valorOrig, entendi.moeda)} (${brlReal(entendi.valor)})` : brlReal(entendi.valor)} em {catDe(entendi.cat).nome}{entendi.off ? (entendi.off === 1 ? ", ontem" : ", anteontem") : ", hoje"}. Confira e salve.</span></div>}
      </>}
      <Seg big value={tipo} onChange={x => { setTipo(x); setCat(null); }} options={[{ v: "saida", l: "Gasto" }, { v: "entrada", l: "Entrada" }]} />
      {/* o campo tem a largura do número (medida por uma cópia escondida): o "R$" fica colado nele, e os dois juntos no centro */}
      <label className={"big-amt ps-valor" + (tipo === "entrada" ? " in" : "")} htmlFor="l-valor"><span>{simb}</span>
        <span className="ps-valor-campo" style={{ "--n": Math.max(4, (valor || "0,00").length) }}><span className="ps-valor-medida" aria-hidden="true">{valor || "0,00"}</span>
          <input id="l-valor" type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" autoFocus={!inicial} placeholder="0,00" value={valor} onChange={e => setValor(soNumero(e.target.value))} aria-label="Valor" /></span>
      </label>
      {inicial && nomeBanco(inicial.banco) && <div className="ps-lanc-banco"><span className="ps-at-av"><MarcaLogo marca={(acharMarca(nomeBanco(inicial.banco)) || {}).id} nome={nomeBanco(inicial.banco)} className="txn-av" /></span><span><b>{nomeBanco(inicial.banco)}</b><small>Veio do banco pelo Open Finance. Mudar aqui não muda lá.</small></span></div>}
      <div className="moeda-linha">
        <select className="moeda-sel" value={moeda} onChange={e => setMoeda(e.target.value)} aria-label="Moeda">
          <option value="BRL">🇧🇷 Real</option>
          {CODIGOS.map(c => <option key={c} value={c}>{MOEDAS[c].bandeira} {MOEDAS[c].nome}</option>)}
        </select>
        {fora && <span className="moeda-conv">{v > 0 ? <>≈ <b>{brlReal(emR)}</b></> : <>1 {simb} = R$ {fmtTaxa(cotUsada)}</>}</span>}
      </div>
      {fora && tipo === "saida" && <Toggle on={iof} onClick={() => setIof(!iof)}>Pago no cartão (soma IOF de {String(IOF_CARTAO).replace(".", ",")}%)</Toggle>}
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {lista.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => setCat(c.id)}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}
          </button>
        ))}
      </div>
      <div className="fields">
        <Field label="Descrição (opcional)" icon={escolhaEfetiva(desc, escolha) || logoPropria(desc) ? <MarcaLogo marca={(escolhaEfetiva(desc, escolha) || {}).marca} site={(escolhaEfetiva(desc, escolha) || {}).site} nome={desc} cat={catDe(cat || "outros")} className="campo-logo" /> : null} htmlFor="l-desc"><input id="l-desc" value={desc} onChange={e => { setDesc(e.target.value); setEscolha(null); }} placeholder={tipo === "entrada" ? "Ex.: Freela" : "Ex.: Padaria, Carrefour, Netflix"} autoComplete="off" /></Field>
        <SugestoesMarca texto={desc} escolha={escolha} onFoto={onLogo} onEscolha={e => { setEscolha(e); if (e.nome) setDesc(e.nome); if (e.cat && tipo === "saida" && CATEGORIAS.some(c => c.id === e.cat)) setCat(e.cat); }} />
        <Field label="Quando" htmlFor="l-data"><input id="l-data" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} /></Field>
      </div>
      {casa && inicial && inicial.casaId && <div className="hint">Este gasto também está na casa.</div>}
      {casa && !(inicial && inicial.casaId) && tipo === "saida" && <Toggle on={dividir} onClick={() => setDividir(!dividir)}>Dividir com a casa ({casa.membros.length} pessoas{v > 0 ? `, ${brl(v / casa.membros.length)} cada` : ""})</Toggle>}
      {!ok && <div className="hint">{!(v > 0) ? "Digite o valor e escolha uma categoria." : "Escolha uma categoria."}</div>}
      <button className="btn mode" disabled={!ok} onClick={() => onSave({ ...(dividir && casa && tipo === "saida" ? { dividirCasa: true } : {}), ...extrasDe(inicial), id: inicial ? inicial.id : uid(), tipo, valor: emR, cat, desc: desc.trim(), data, ...camposLogo(desc, escolha), ...(fora ? { moeda, valorOrig: v, cotacao: cotUsada, iof: iofOn } : {}) })}><I.check /> {inicial ? "Salvar" : tipo === "entrada" ? "Anotar entrada" : "Anotar gasto"}</button>
      {inicial && <ConfirmButton label="Apagar lançamento" titulo="Apagar este lançamento?" texto="Ele sai do seu extrato e dos totais do mês." acao="Apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

// pre: dados vindos de um boleto lido ({ nome, valor, dia, cat, codigo })
function ContaSheet({ inicial, pre, onSave, onDelete, onClose, onLogo, onBoleto, onCopiar }) {
  const cot = useCotacoes();
  const [nome, setNome] = useState(inicial ? inicial.nome : pre && pre.nome ? pre.nome : "");
  const codigo = (inicial && inicial.codigo) || (pre && pre.codigo) || "";
  const [escolha, setEscolha] = useState(() => escolhaInicial(inicial));
  const [catTocada, setCatTocada] = useState(!!inicial);
  const efNome = escolhaEfetiva(nome, escolha);
  useEffect(() => { if (!catTocada && efNome && efNome.cat && CATEGORIAS.some(c => c.id === efNome.cat)) setCat(efNome.cat); }, [efNome && efNome.cat, catTocada]);
  const [moeda, setMoeda] = useState(inicial && inicial.moeda ? inicial.moeda : "BRL");
  const [iof, setIof] = useState(inicial ? inicial.iof !== false : true);
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.moeda && inicial.valorOrig ? inicial.valorOrig : inicial.valor) : pre && pre.valor ? fmtNum(pre.valor) : "");
  const [dia, setDia] = useState(inicial ? inicial.dia : pre && pre.dia ? pre.dia : 10);
  const [cat, setCat] = useState(inicial ? inicial.cat : pre && pre.cat ? pre.cat : "casa");
  const [assin, setAssin] = useState(inicial ? !!inicial.assinatura : false);
  const v = num(valor);
  const fora = moeda !== "BRL";
  const emR = fora ? emReais(v, moeda, iof) : v;
  const ok = nome.trim() && v > 0;
  return (
    <Sheet title={inicial ? "Editar conta" : "Nova conta fixa"} sub="Repete todo mês. Eu aviso antes de vencer." onClose={onClose}>
      {!inicial && !pre && onBoleto && <button type="button" className="btn ghost" onClick={onBoleto}><I.scan /> Ler o boleto (preenche sozinho)</button>}
      {pre && pre.codigo && <div className="voice-ok"><I.check /><span>Boleto lido. Confira o nome e salve.{pre.incerto ? " O vencimento não vem no código desta conta: confira o dia." : ""}</span></div>}
      <div className="fields">
        <Field label="Nome da conta" icon={escolhaEfetiva(nome, escolha) || logoPropria(nome) ? <MarcaLogo marca={(escolhaEfetiva(nome, escolha) || {}).marca} site={(escolhaEfetiva(nome, escolha) || {}).site} nome={nome} cat={catDe(cat)} className="campo-logo" /> : <I.bill />} htmlFor="c-nome"><input id="c-nome" value={nome} onChange={e => { setNome(e.target.value); setEscolha(null); }} placeholder="Ex.: Aluguel, Copel, Netflix" autoComplete="off" /></Field>
        <SugestoesMarca texto={nome} escolha={escolha} onFoto={onLogo} onEscolha={e => { setEscolha(e); if (e.nome) setNome(e.nome); if (e.cat && !inicial) setCat(e.cat); }} />
        <Field label={fora ? `Valor (${MOEDAS[moeda].nome.toLowerCase()})` : "Valor (R$)"} icon={<I.money />} htmlFor="c-valor"><input id="c-valor" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" /></Field>
        <Field label="Cobrada em" htmlFor="c-moeda">
          <select id="c-moeda" className="moeda-sel no-campo" value={moeda} onChange={e => setMoeda(e.target.value)}>
            <option value="BRL">🇧🇷 Real</option>
            {CODIGOS.map(c => <option key={c} value={c}>{MOEDAS[c].bandeira} {MOEDAS[c].nome}</option>)}
          </select>
        </Field>
        <Field label="Vence todo dia">
          <div className="stepper">
            <button type="button" aria-label="Dia anterior" onClick={() => setDia(Math.max(1, dia - 1))}>−</button>
            <b className="num">{dia}</b>
            <button type="button" aria-label="Próximo dia" onClick={() => setDia(Math.min(31, dia + 1))}>+</button>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>do mês</span>
          </div>
        </Field>
      </div>
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {CATEGORIAS.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => { setCat(c.id); setCatTocada(true); }}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}
          </button>
        ))}
      </div>
      <Toggle on={assin} onClick={() => setAssin(!assin)}>É uma assinatura (streaming, app, academia)</Toggle>
      {codigo && <div className="boleto-cod"><span><small>Código do boleto</small><b>{codigo}</b></span>{onCopiar && <button type="button" className="pill-btn" onClick={() => onCopiar(codigo)}><I.copy /> Copiar</button>}</div>}
      {fora && <Toggle on={iof} onClick={() => setIof(!iof)}>Cobrada no cartão (soma IOF de {String(IOF_CARTAO).replace(".", ",")}%)</Toggle>}
      {fora && v > 0 && <div className="moeda-aviso">Hoje sai por <b>{brlReal(emR)}</b> por mês ({brlReal(emR * 12)} por ano). Eu atualizo esse valor com a cotação do dia.</div>}
      <button className="btn mode" disabled={!ok} onClick={() => { const { moeda: _m, valorOrig: _vo, iof: _i, ...base } = inicial || { pagas: {} }; onSave({ ...base, id: inicial ? inicial.id : uid(), nome: nome.trim(), valor: emR, dia, cat, assinatura: assin, ...camposLogo(nome, escolha), ...(fora ? { moeda, valorOrig: v, iof } : {}), ...(codigo ? { codigo } : {}) }); }}><I.check /> {inicial ? "Salvar" : "Adicionar conta"}</button>
      {inicial && <ConfirmButton label="Apagar conta" titulo="Apagar esta conta fixa?" texto="Ela para de aparecer nos próximos meses e nos lembretes." acao="Apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

// Teto do mês por categoria: avisa em 80% e quando passa
function TetoSheet({ db, cat: cat0, act, onClose }) {
  const lim = db.pessoal.limites || {}, chave = todayISO().slice(0, 7);
  const [cat, setCat] = useState(cat0 && CATEGORIAS.some(c => c.id === cat0) ? cat0 : (CATEGORIAS.find(c => lim[c.id] > 0) || CATEGORIAS[0]).id);
  const [valor, setValor] = useState(lim[cat] ? fmtNum(lim[cat]) : "");
  const escolher = id => { setCat(id); setValor(lim[id] ? fmtNum(lim[id]) : ""); };
  const gasto = resumoPessoal(db, chave).porCat[cat] || 0;
  // sugestão: a média dos 3 meses anteriores
  let media = 0; for (let i = 1; i <= 3; i++) { const d = new Date(); d.setMonth(d.getMonth() - i, 1); media += (resumoPessoal(db, `${d.getFullYear()}-${pad(d.getMonth() + 1)}`).porCat[cat] || 0) / 3; }
  const v = num(valor);
  return (
    <Sheet title="Teto do mês" sub="Eu aviso quando chegar em 80% e se passar." onClose={onClose}>
      <div className="cats" role="radiogroup" aria-label="Categoria">
        {CATEGORIAS.map(c => (
          <button type="button" key={c.id} role="radio" aria-checked={cat === c.id} className={"cat" + (cat === c.id ? " on" : "")} style={catVars(c)} onClick={() => escolher(c.id)}>
            <span className="ci"><CatIcon cat={c} /></span>{c.nome}{lim[c.id] > 0 ? " •" : ""}
          </button>
        ))}
      </div>
      <div className="fields">
        <Field label={`Teto para ${catDe(cat).nome} (R$ por mês)`} icon={<I.gauge />} htmlFor="t-valor"><input id="t-valor" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder={media > 0 ? fmtNum(Math.ceil(media / 10) * 10) : "0,00"} /></Field>
      </div>
      <div className="hint">Neste mês: {brl(gasto)}{media > 0 ? `. Média dos últimos 3 meses: ${brl(media)}.` : "."}{v > 0 ? ` Sobra ${brl(Math.max(0, v - gasto))} até o fim do mês.` : ""}</div>
      <button className="btn mode" disabled={!(v > 0)} onClick={() => act.salvarTeto(cat, v)}><I.check /> Salvar teto</button>
      {lim[cat] > 0 && <button className="btn text" onClick={() => act.salvarTeto(cat, 0)}>Tirar o teto de {catDe(cat).nome}</button>}
    </Sheet>
  );
}

export { PessoalHome, GastosTab, ContasTab, LancSheet, ContaSheet, TetoSheet, respostaGastar };
