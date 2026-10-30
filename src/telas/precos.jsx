// "Onde está mais barato perto?": a lista de compras (da casa ou da loja) com os preços das notas do Paraná.
// Os preços vêm do Menor Preço (src/menorpreco.js). O lugar: o mesmo do clima, a localização do aparelho
// ou a cidade do perfil, nessa ordem; ou uma cidade que a pessoa escolhe. Dá para escolher a distância
// (até 20 km, a cidade toda) e um mercado só, para ver a lista inteira com os preços dele.
// Fora do Paraná, o botão explica e some.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { I, vibrar, brl, brlReal, PERFIL, Sheet } from "../App.jsx";
import { geohash, noParana, buscarPrecos, precoGuardado, melhorLoja, buscarMercados } from "../menorpreco.js";

const K_LOCAL = "agenda-precos-local"; // { lat, lon, gh, t }
const K_ONDE = "agenda-precos-onde"; // { cidade: { nome, lat, lon } | null, raio, loja: { codigo, loja, bairro, mun } | null }
const RAIOS = [2, 5, 10, 20];
const sem = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const ler = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (e) { return d; } };
const ondePadrao = () => ({ cidade: null, raio: 5, loja: null, ...ler(K_ONDE, {}) });

// lat/lon de onde a pessoa está (ou mora): guardado por 30 dias para não perguntar toda vez
export async function obterLocal(forcar) {
  const salvo = ler(K_LOCAL, null);
  if (!forcar && salvo && Date.now() - salvo.t < 30 * 864e5) return salvo;
  let lat, lon;
  const clima = ler("agenda-clima-local", null);
  if (!forcar && clima && clima.lat) ({ lat, lon } = clima);
  if (lat == null && navigator.geolocation) {
    try {
      const p = await new Promise((ok, erro) => navigator.geolocation.getCurrentPosition(ok, erro, { timeout: 12000, maximumAge: 3600e3, enableHighAccuracy: false }));
      lat = p.coords.latitude; lon = p.coords.longitude;
    } catch (e) {}
  }
  if (lat == null && PERFIL && PERFIL.cidade) {
    try {
      const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(PERFIL.cidade)}&count=1&language=pt&countryCode=BR`)).json();
      const r = g.results && g.results[0]; if (r) { lat = r.latitude; lon = r.longitude; }
    } catch (e) {}
  }
  if (lat == null) return null;
  const local = { lat, lon, gh: geohash(lat, lon), t: Date.now() };
  try { localStorage.setItem(K_LOCAL, JSON.stringify(local)); } catch (e) {}
  return local;
}
// o centro da busca: a cidade escolhida ou onde a pessoa está
const localDe = async (onde, forcar) => onde.cidade ? { lat: onde.cidade.lat, lon: onde.cidade.lon, gh: geohash(onde.cidade.lat, onde.cidade.lon) } : obterLocal(forcar);
const localGuardado = onde => onde.cidade ? { lat: onde.cidade.lat, lon: onde.cidade.lon, gh: geohash(onde.cidade.lat, onde.cidade.lon) } : ler(K_LOCAL, null);

// Cidades do Paraná com esse nome (o Menor Preço só tem o Paraná)
async function acharCidade(nome) {
  const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=10&language=pt&countryCode=BR`)).json();
  return ((g && g.results) || []).filter(r => noParana(r.latitude, r.longitude) && (!r.admin1 || /paran/i.test(r.admin1)))
    .slice(0, 5).map(r => ({ nome: r.name, lat: r.latitude, lon: r.longitude }));
}

// itens: [{ id, texto, qtd }] (o que ainda falta comprar)
export function usePrecosPerto(itens) {
  const [estado, setEstado] = useState(""); // "" | buscando | pronto | fora | semLocal | erro
  const [res, setRes] = useState({});
  const [onde, setOnde] = useState(ondePadrao);
  const vivo = useRef(true), rodada = useRef(0);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  // já buscou antes (até 6 h): mostra sem perguntar de novo
  const chave = itens.map(x => x.texto).join("|");
  useEffect(() => {
    const local = localGuardado(onde);
    if (!local || !noParana(local.lat, local.lon)) return;
    const estab = (onde.loja && onde.loja.codigo) || "";
    const r = {}; itens.forEach(x => { const p = precoGuardado(x.texto, local.gh, onde.raio, estab); if (p) r[x.id] = p; });
    setRes(r); if (Object.keys(r).length) setEstado(e => e || "pronto");
  }, [chave, onde]);
  const buscar = async (forcar, o = onde) => {
    const minha = ++rodada.current, ainda = () => vivo.current && rodada.current === minha;
    vibrar("toque"); setEstado("buscando");
    const local = await localDe(o, forcar).catch(() => null);
    if (!ainda()) return;
    if (!local) return setEstado("semLocal");
    if (!noParana(local.lat, local.lon)) return setEstado("fora");
    const estab = (o.loja && o.loja.codigo) || "";
    // um item de cada vez: o site da Nota Paraná recusa muitas buscas juntas. Cada preço aparece assim que chega.
    let falhas = 0;
    for (const x of itens) {
      if (!ainda()) return;
      try { const r = await buscarPrecos(x.texto, local.gh, o.raio, estab); if (ainda()) setRes(v => ({ ...v, [x.id]: r })); }
      catch (e) { falhas++; }
      await new Promise(r => setTimeout(r, 250));
    }
    if (ainda()) setEstado(falhas && falhas === itens.length ? "erro" : "pronto");
  };
  // mudou a região, a distância ou o mercado: guarda no aparelho e procura de novo
  const mudarOnde = novo => {
    const o = { ...onde, ...novo };
    try { localStorage.setItem(K_ONDE, JSON.stringify(o)); } catch (e) {}
    setOnde(o); setRes({}); setEstado("");
    if (itens.length) buscar(false, o);
  };
  // num mercado só: quanto sai a lista lá (o mais barato de cada item × a quantidade) e quantos itens ele tem
  const noMercado = onde.loja ? itens.reduce((s, x) => { const r = res[x.id]; if (r === undefined) return s; s.vistos++; if (r.length) { s.achou++; s.total += r[0].valor * (x.qtd || 1); } return s; }, { vistos: 0, achou: 0, total: 0 }) : null;
  return { estado, res, buscar, onde, mudarOnde, itens, noMercado, melhor: onde.loja ? null : melhorLoja(res) };
}

const km = d => (d == null ? "" : d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace(".", ",")} km`);
const porUn = x => (x.unit ? ` · ${brlReal(x.unit)}/${x.un === "un" ? "un" : x.un}` : "");
const Titulo = s => String(s || "").toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
// o tamanho do pacote ao lado do preço ("R$ 14,99 · 5 kg"): sem ele, o pacote grande parece caro
const num = v => String(Math.round(v * 100) / 100).replace(".", ",");
const tamanho = m => (!m ? "" : m.un === "un" ? `${num(m.qtd)} un` : m.qtd >= 1 ? `${num(m.qtd)} ${m.un === "kg" ? "kg" : "L"}` : `${num(m.qtd * 1000)} ${m.un === "kg" ? "g" : "ml"}`);
const nomeMercado = l => `${l.loja}${l.bairro ? ` (${Titulo(l.bairro)})` : ""}`;

// Embaixo de cada item: o mais barato perto (ou no mercado escolhido); tocando, os outros dois
export function PrecoItem({ r, loja }) {
  const [aberto, setAberto] = useState(false);
  if (!r) return null;
  if (!r.length) return <small className="preco-perto vazio">{loja ? "sem preço neste mercado nos últimos 30 dias" : "sem preço perto nos últimos 15 dias"}</small>;
  const [a, ...resto] = r;
  return (
    <span className="preco-perto-bloco">
      <button type="button" className="preco-perto" onClick={() => setAberto(!aberto)} aria-expanded={aberto} title={a.desc}>
        <b>{brlReal(a.valor)}</b>{a.med ? ` · ${tamanho(a.med)}` : ""}{loja ? "" : ` no ${a.loja}`}{!loja && a.dist != null ? ` · ${km(a.dist)}` : ""}{resto.length ? <i>{aberto ? "−" : `+${resto.length}`}</i> : null}
      </button>
      {aberto && [a, ...resto].map((x, i) => (
        <small key={i} className="preco-perto-linha"><b>{brlReal(x.valor)}</b> {x.desc.toLowerCase()}{loja ? porUn(x) : <><br />{x.loja}{x.bairro ? `, ${Titulo(x.bairro)}` : ""} · {km(x.dist)}{porUn(x)}</>}</small>
      ))}
    </span>
  );
}

// O botão e o resumo, no alto da lista
export function PrecosPainel({ p, n }) {
  const [escolher, setEscolher] = useState(false);
  if (!n) return null;
  const { onde } = p;
  const regiao = `${onde.cidade ? onde.cidade.nome : "Perto de mim"} · ${onde.raio >= 20 ? "até 20 km" : `${onde.raio} km`}`;
  const m = p.noMercado;
  return (
    <div className="precos-painel">
      <div className="precos-onde">
        <button type="button" onClick={() => setEscolher(true)} aria-label={`Região: ${regiao}. Mudar`}><I.target /><span>{regiao}</span><I.chevD /></button>
        <button type="button" className={onde.loja ? "on" : ""} onClick={() => setEscolher(true)} aria-label={`Mercado: ${onde.loja ? onde.loja.loja : "todos"}. Mudar`}><I.cart /><span>{onde.loja ? onde.loja.loja : "Todos os mercados"}</span><I.chevD /></button>
      </div>
      {p.estado === "fora" ? <div className="hint">Os preços vêm das notas fiscais do Paraná (Nota Paraná). Por enquanto, só funciona lá: escolha uma cidade do Paraná.</div> : <>
        {p.melhor && p.estado !== "buscando" && <div className="precos-melhor"><I.cart /><span>Mais barato para esta lista: <b>{p.melhor.loja}</b><small>{p.melhor.n} itens no menor preço{p.melhor.dist != null ? ` · ${km(p.melhor.dist)}` : ""}</small></span></div>}
        {m && m.vistos > 0 && <div className="precos-melhor"><I.cart /><span>No <b>{nomeMercado(onde.loja)}</b><small>{m.achou} de {n} {n === 1 ? "item" : "itens"} com preço{m.total > 0 ? ` · a lista sai por ~${brl(m.total)}` : ""}</small></span></div>}
        <button type="button" className="pill-btn" onClick={() => p.buscar(p.estado === "semLocal")} disabled={p.estado === "buscando"}>
          <I.search /> {p.estado === "buscando" ? "Procurando os preços…" : p.estado === "pronto" ? "Atualizar os preços" : onde.loja ? `Ver os preços no ${onde.loja.loja}` : "Onde está mais barato?"}
        </button>
        {p.estado === "semLocal" && <small className="precos-nota">Não consegui saber onde você está. Libere a localização ou escolha a cidade aqui em cima.</small>}
        {p.estado === "erro" && <small className="precos-nota">O site da Nota Paraná não respondeu agora. Tente daqui a pouco.</small>}
        {(p.estado === "pronto" || p.estado === "buscando") && <small className="precos-nota">{onde.loja ? "Preços das notas fiscais deste mercado nos últimos 30 dias (Nota Paraná)." : `Preços das notas fiscais dos últimos 15 dias, a até ${onde.raio} km (Nota Paraná).`}</small>}
      </>}
      {escolher && createPortal(<OndeSheet p={p} onClose={() => setEscolher(false)} />, document.querySelector(".shell") || document.body)}
    </div>
  );
}

// Onde procurar: perto de mim ou uma cidade do Paraná, a distância e, se quiser, um mercado só
function OndeSheet({ p, onClose }) {
  const [cidade, setCidade] = useState(p.onde.cidade), [raio, setRaio] = useState(p.onde.raio), [loja, setLoja] = useState(p.onde.loja);
  const [busca, setBusca] = useState(""), [achadas, setAchadas] = useState(null), [procurando, setProcurando] = useState(false);
  const [lojas, setLojas] = useState(null), [lojasEstado, setLojasEstado] = useState(""), [filtro, setFiltro] = useState("");
  const vivo = useRef(true); useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const procurarCidade = async e => {
    e.preventDefault(); const t = busca.trim(); if (t.length < 2) return;
    setProcurando(true);
    try { const r = await acharCidade(t); if (vivo.current) setAchadas(r); } catch (e2) { if (vivo.current) setAchadas([]); }
    if (vivo.current) setProcurando(false);
  };
  const trocarRegiao = (c, r = raio) => { setCidade(c); setRaio(r); setLoja(null); setLojas(null); setLojasEstado(""); setAchadas(null); setBusca(""); vibrar("toque"); };
  // os mercados da região escolhida (aparecem aos poucos, conforme as buscas voltam)
  const verMercados = async () => {
    setLojasEstado("buscando"); setLojas([]);
    const o = { cidade, raio };
    const local = await localDe(o, false).catch(() => null);
    if (!vivo.current) return;
    if (!local) return setLojasEstado("semLocal");
    if (!noParana(local.lat, local.lon)) return setLojasEstado("fora");
    try { const r = await buscarMercados(local.gh, raio, p.itens.map(x => x.texto), parcial => vivo.current && setLojas(parcial)); if (vivo.current) { setLojas(r); setLojasEstado("pronto"); } }
    catch (e) { if (vivo.current) setLojasEstado("erro"); }
  };
  const salvar = () => { p.mudarOnde({ cidade, raio, loja }); vibrar("ok"); onClose(); };
  const f = filtro.trim().toLowerCase();
  const visiveis = (lojas || []).filter(l => !f || `${l.loja} ${l.bairro}`.toLowerCase().includes(f));
  return (
    <Sheet title="Onde procurar os preços" sub="Notas fiscais do Paraná (Nota Paraná)" onClose={onClose}>
      <b className="precos-t">Região</b>
      <div className="casa-chips" role="radiogroup" aria-label="Região">
        <button type="button" className={!cidade ? "on" : ""} onClick={() => trocarRegiao(null)} role="radio" aria-checked={!cidade}><I.target /> Perto de mim</button>
        {cidade && <button type="button" className="on" role="radio" aria-checked="true">{cidade.nome}</button>}
      </div>
      <form className="casa-compras-add" onSubmit={procurarCidade}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Outra cidade do Paraná (ex.: Maringá)" aria-label="Cidade" enterKeyHint="search" />
        <button type="submit" className="icon-btn" aria-label="Procurar cidade" disabled={busca.trim().length < 2 || procurando}><I.search /></button>
      </form>
      {achadas && (achadas.length ? <div className="casa-chips">{achadas.map((c, i) => <button key={i} type="button" onClick={() => trocarRegiao(c, 20)}>{c.nome}</button>)}</div>
        : <small className="precos-nota">Não achei essa cidade no Paraná.</small>)}
      <b className="precos-t">Distância</b>
      <div className="casa-chips" role="radiogroup" aria-label="Distância">
        {RAIOS.map(r => <button key={r} type="button" role="radio" aria-checked={raio === r} className={raio === r ? "on" : ""} onClick={() => { setRaio(r); setLoja(null); setLojas(null); setLojasEstado(""); }}>{r === 20 ? "20 km (a cidade toda)" : `${r} km`}</button>)}
      </div>
      <b className="precos-t">Mercado</b>
      <button type="button" className={"precos-loja" + (!loja ? " on" : "")} onClick={() => setLoja(null)}>
        <span><b>Todos os mercados</b><small>O mais barato de cada item, onde estiver</small></span>{!loja && <I.check />}
      </button>
      {loja && <button type="button" className="precos-loja on"><span><b>{nomeMercado(loja)}</b><small>Só os preços dele, para a lista toda</small></span><I.check /></button>}
      {lojasEstado === "" && <button type="button" className="pill-btn" onClick={verMercados}><I.cart /> Escolher um mercado da região</button>}
      {lojasEstado === "buscando" && <small className="precos-nota">Procurando os mercados da região{lojas && lojas.length ? ` · ${lojas.length} até agora` : ""}…</small>}
      {lojasEstado === "semLocal" && <small className="precos-nota">Não consegui saber onde você está. Libere a localização ou escolha uma cidade.</small>}
      {lojasEstado === "fora" && <small className="precos-nota">Fora do Paraná não há preços. Escolha uma cidade do Paraná.</small>}
      {lojasEstado === "erro" && <small className="precos-nota">O site da Nota Paraná não respondeu agora. Tente daqui a pouco.</small>}
      {lojasEstado === "pronto" && !lojas.length && <small className="precos-nota">Não achei mercados com notas recentes aqui. Tente uma distância maior.</small>}
      {lojas && lojas.length > 8 && <div className="casa-compras-add"><input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar (ex.: Condor, Muffato, bairro)" aria-label="Filtrar mercados" /></div>}
      {visiveis.slice(0, 30).map(l => (
        <button key={l.codigo} type="button" className={"precos-loja" + (loja && loja.codigo === l.codigo ? " on" : "")} onClick={() => { setLoja({ codigo: l.codigo, loja: l.loja, bairro: l.bairro, mun: l.mun }); vibrar("toque"); }}>
          <span><b>{l.loja}</b><small>{[Titulo(l.bairro), !cidade || (l.mun && sem(l.mun) !== sem(cidade.nome)) ? Titulo(l.mun) : "", km(l.dist)].filter(Boolean).join(" · ")}</small></span>
          {loja && loja.codigo === l.codigo && <I.check />}
        </button>
      ))}
      <button type="button" className="btn mode" onClick={salvar}><I.check /> Ver os preços</button>
    </Sheet>
  );
}
