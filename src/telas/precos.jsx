// "Onde está mais barato perto?": a lista de compras (da casa ou da loja) com os preços das notas do Paraná.
// Os preços vêm do Menor Preço (src/menorpreco.js). O lugar: o mesmo do clima, a localização do aparelho
// ou a cidade do perfil, nessa ordem. Fora do Paraná, o botão explica e some.
import React, { useEffect, useRef, useState } from "react";
import { I, vibrar, brlReal, PERFIL } from "../App.jsx";
import { geohash, noParana, buscarPrecos, precoGuardado, melhorLoja } from "../menorpreco.js";

const K_LOCAL = "agenda-precos-local"; // { lat, lon, gh, t }
const ler = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (e) { return d; } };

// lat/lon de onde a pessoa está (ou mora): guardado por 30 dias para não perguntar toda vez
async function obterLocal(forcar) {
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

// itens: [{ id, texto }] (o que ainda falta comprar)
export function usePrecosPerto(itens) {
  const [estado, setEstado] = useState(""); // "" | buscando | pronto | fora | semLocal | erro
  const [res, setRes] = useState({});
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  // já buscou antes (até 6 h): mostra sem perguntar de novo
  const chave = itens.map(x => x.texto).join("|");
  useEffect(() => {
    const local = ler(K_LOCAL, null);
    if (!local || !noParana(local.lat, local.lon)) return;
    const r = {}; itens.forEach(x => { const p = precoGuardado(x.texto, local.gh); if (p) r[x.id] = p; });
    if (Object.keys(r).length) { setRes(r); setEstado(e => e || "pronto"); }
  }, [chave]);
  const buscar = async forcar => {
    vibrar("toque"); setEstado("buscando");
    const local = await obterLocal(forcar).catch(() => null);
    if (!vivo.current) return;
    if (!local) return setEstado("semLocal");
    if (!noParana(local.lat, local.lon)) return setEstado("fora");
    // um item de cada vez: o site da Nota Paraná recusa muitas buscas juntas. Cada preço aparece assim que chega.
    let falhas = 0;
    for (const x of itens) {
      if (!vivo.current) return;
      try { const r = await buscarPrecos(x.texto, local.gh); if (vivo.current) setRes(o => ({ ...o, [x.id]: r })); }
      catch (e) { falhas++; }
      await new Promise(r => setTimeout(r, 250));
    }
    if (vivo.current) setEstado(falhas && falhas === itens.length ? "erro" : "pronto");
  };
  return { estado, res, buscar, melhor: melhorLoja(res) };
}

const km = d => (d == null ? "" : d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace(".", ",")} km`);
const porUn = x => (x.unit ? ` · ${brlReal(x.unit)}/${x.un === "un" ? "un" : x.un}` : "");
// o tamanho do pacote ao lado do preço ("R$ 14,99 · 5 kg"): sem ele, o pacote grande parece caro
const num = v => String(Math.round(v * 100) / 100).replace(".", ",");
const tamanho = m => (!m ? "" : m.un === "un" ? `${num(m.qtd)} un` : m.qtd >= 1 ? `${num(m.qtd)} ${m.un === "kg" ? "kg" : "L"}` : `${num(m.qtd * 1000)} ${m.un === "kg" ? "g" : "ml"}`);

// Embaixo de cada item: o mais barato perto; tocando, os outros dois
export function PrecoItem({ r }) {
  const [aberto, setAberto] = useState(false);
  if (!r) return null;
  if (!r.length) return <small className="preco-perto vazio">sem preço perto nos últimos 15 dias</small>;
  const [a, ...resto] = r;
  return (
    <span className="preco-perto-bloco">
      <button type="button" className="preco-perto" onClick={() => setAberto(!aberto)} aria-expanded={aberto} title={a.desc}>
        <b>{brlReal(a.valor)}</b>{a.med ? ` · ${tamanho(a.med)}` : ""} no {a.loja}{a.dist != null ? ` · ${km(a.dist)}` : ""}{resto.length ? <i>{aberto ? "−" : `+${resto.length}`}</i> : null}
      </button>
      {aberto && [a, ...resto].map((x, i) => (
        <small key={i} className="preco-perto-linha"><b>{brlReal(x.valor)}</b> {x.desc.toLowerCase()}<br />{x.loja}{x.bairro ? `, ${x.bairro.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())}` : ""} · {km(x.dist)}{porUn(x)}</small>
      ))}
    </span>
  );
}

// O botão e o resumo, no alto da lista
export function PrecosPainel({ p, n }) {
  if (!n) return null;
  if (p.estado === "fora") return <div className="hint">Os preços perto de você vêm das notas fiscais do Paraná (Nota Paraná). Por enquanto, só funciona lá.</div>;
  return (
    <div className="precos-painel">
      {p.melhor && p.estado !== "buscando" && <div className="precos-melhor"><I.cart /><span>Mais barato para esta lista: <b>{p.melhor.loja}</b><small>{p.melhor.n} itens no menor preço{p.melhor.dist != null ? ` · ${km(p.melhor.dist)}` : ""}</small></span></div>}
      <button type="button" className="pill-btn" onClick={() => p.buscar(p.estado === "semLocal")} disabled={p.estado === "buscando"}>
        <I.search /> {p.estado === "buscando" ? "Procurando os preços…" : p.estado === "pronto" ? "Atualizar os preços perto" : "Onde está mais barato perto?"}
      </button>
      {p.estado === "semLocal" && <small className="precos-nota">Não consegui saber onde você está. Libere a localização, ou coloque sua cidade no Perfil.</small>}
      {p.estado === "erro" && <small className="precos-nota">O site da Nota Paraná não respondeu agora. Tente daqui a pouco.</small>}
      {(p.estado === "pronto" || p.estado === "buscando") && <small className="precos-nota">Preços das notas fiscais dos últimos 15 dias, a até 5 km (Nota Paraná).</small>}
    </div>
  );
}
