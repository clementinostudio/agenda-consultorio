// Parte do app carregada sob demanda: aba "Transporte" do modo Pessoal (também abre ao tocar em Transporte, em Gastos).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { I, Sheet, Field, Seg, Toggle, Money, brl, brlReal, num, soNumero, fmtNum, uid, todayISO, MES_LONGO, pad, dm, relativo, vibrar, Ilustra, lerArquivo, servidorAvisos, ConfirmButton, TopBar, ProximaConquista } from "../App.jsx";
import { veiculosDe, lancTransp, SUBS, subInfo, subDe, MANUTENCOES, FOTOS, FOTO_MOTO, NOME_CARROCERIA, carroceria, fotoDoVeiculo, COMBUSTIVEIS, gastosTransporte, estatisticasCombustivel, kmAtual, proximaTrocaOleo, proximoRodizio, DOCS_VEICULO, docsVeiculo, umAnoDepois, custoReal, valorFipe, postos, carroOuApp, precosCombustivel, etanolOuGasolina, fipe } from "../transporte.js";
import { IconeAnel, Topo, Comparacao } from "./visual.jsx";

/* ---------- ícones ---------- */
const Svg = ({ children }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const Ic = {
  combustivel: () => <Svg><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M4 20h11M5 10h9M14 9l3.2 2.2a1.5 1.5 0 0 1 .8 1.3V17a1.5 1.5 0 0 0 3 0V8.5L18 6" /></Svg>,
  app: () => <Svg><path d="M5 16v-4l2-5h10l2 5v4M4.5 16h15M6 16v2.5M18 16v2.5" /><circle cx="8.5" cy="13.2" r=".9" /><circle cx="15.5" cy="13.2" r=".9" /></Svg>,
  publico: () => <Svg><rect x="5" y="3.5" width="14" height="14" rx="3" /><path d="M5 11h14M8 17.5V20M16 17.5V20M8.5 14.3h.01M15.5 14.3h.01" /></Svg>,
  manutencao: () => <Svg><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z" /></Svg>,
  melhorias: () => <Svg><path d="M11 3l1.7 4.4L17 9l-4.3 1.7L11 15l-1.7-4.3L5 9l4.3-1.6zM18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></Svg>,
  estacionamento: () => <Svg><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M10 16.5v-9h3a2.5 2.5 0 0 1 0 5h-3" /></Svg>,
  documentos: () => <Svg><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" /><path d="M14 3.5V8h4M8.5 12h7M8.5 15.5h5" /></Svg>,
  outros: () => <Svg><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></Svg>,
  rota: () => <Svg><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" /></Svg>,
};
const IconeSub = ({ id }) => { const C = Ic[id] || Ic.outros; return <C />; };
const EMOJI = { moto: "🏍️", bike: "🚲", nenhum: "🚌" };

// Estado (UF) da cidade do perfil, para achar o preço da ANP (Open-Meteo, grátis; fica guardado)
async function ufDaCidade(cidade) {
  const k = "agenda-uf:" + String(cidade || "").toLowerCase();
  try { const s = localStorage.getItem(k); if (s) return s; } catch (e) {}
  const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&countryCode=BR`)).json();
  const uf = (g.results && g.results[0] && g.results[0].admin1) || "";
  try { if (uf) localStorage.setItem(k, uf); } catch (e) {}
  return uf;
}
const preco = v => (v > 0 ? `R$ ${v.toFixed(2).replace(".", ",")}` : "—");
const kml = c => (Math.round(c * 10) / 10).toLocaleString("pt-BR");
// data com o ano quando não é o ano de agora ("27/10/2027")
const dataCurta = iso => iso.slice(0, 4) === todayISO().slice(0, 4) ? dm(iso) : `${dm(iso)}/${iso.slice(0, 4)}`;
const mesDe = off => { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth() + off, 1); return { chave: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, nome: MES_LONGO[m.getMonth()], ano: m.getFullYear() }; };

function FotoVeiculo({ v, grande }) {
  const cls = "transp-foto" + (grande ? " grande" : "");
  if (v && v.foto && v.foto.startsWith("data:")) return <img className={cls + " propria"} src={v.foto} alt="Seu veículo" />;
  const f = fotoDoVeiculo(v);
  if (f) return <Ilustra n={f[2]} className={cls + " f-" + f[0]} alt={f[1]} />;
  return <span className={cls + " emoji"} aria-hidden="true">{EMOJI[v.tipo] || "🚗"}</span>;
}

// Carro ou app? O custo de verdade do carro por km contra o preço de uma corrida que a pessoa faz
function CarroOuApp({ custo, v, act }) {
  const a0 = (v && v.appRef) || {};
  const [valor, setValor] = useState(a0.valor ? fmtNum(a0.valor) : "");
  const [km, setKm] = useState(a0.km ? String(a0.km) : "");
  useEffect(() => {
    const t = setTimeout(() => { const n = { valor: num(valor), km: num(km) }; if (n.valor > 0 && n.km > 0 && (n.valor !== a0.valor || n.km !== a0.km)) act.atualizarVeiculo(v.id, { appRef: n }); }, 600);
    return () => clearTimeout(t);
  }, [valor, km]);
  const c = carroOuApp(custo, { valor: num(valor), km: num(km) });
  return (
    <div className="carro-app">
      <b>Carro ou app?</b>
      <div className="carro-app-in">
        <span>Uma corrida de</span>
        <label><input inputMode="decimal" value={km} onChange={e => setKm(soNumero(e.target.value))} placeholder="10" aria-label="Distância da corrida em km" /><small>km</small></label>
        <span>sai por</span>
        <label><small>R$</small><input inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="25,00" aria-label="Preço da corrida" /></label>
      </div>
      {c ? <>
        <div className="carro-app-cmp">
          <div className={c.carroKm <= c.appKm ? "ganha" : ""}><small>Seu carro</small><b>{brlReal(c.carroKm)}</b><small>por km{c.comDesvalor ? ", com a desvalorização" : ""}</small></div>
          <div className={c.appKm < c.carroKm ? "ganha" : ""}><small>App</small><b>{brlReal(c.appKm)}</b><small>por km</small></div>
        </div>
        <p className="hint">{c.diferenca >= 0
          ? <>Rodando uns {Math.round(c.kmMes).toLocaleString("pt-BR")} km por mês, de app sairia <b>{brl(c.appMes)}</b>: {brl(c.diferenca)} a mais que o carro.</>
          : <>Rodando uns {Math.round(c.kmMes).toLocaleString("pt-BR")} km por mês, de app sairia <b>{brl(c.appMes)}</b>: <b>{brl(-c.diferenca)} a menos</b> que o carro. Vale pensar!</>}</p>
      </> : <p className="hint">Coloque uma corrida que você costuma fazer (veja o preço no app de corrida) e eu comparo.</p>}
    </div>
  );
}

// Onde você abastece: preço médio do litro em cada posto anotado (o mais barato em destaque)
function Postos({ lista, ref0 }) {
  if (!lista.length) return <p className="hint">Escreva o nome do posto ao abastecer e eu mostro onde sai mais barato.</p>;
  const comPreco = lista.filter(p => p.preco), barato = comPreco.length > 1 ? comPreco.reduce((m, p) => (p.preco < m.preco ? p : m)) : null;
  return (
    <div className="postos">
      <b>Onde você abastece</b>
      {lista.slice(0, 4).map(p => (
        <div key={p.nome} className={"posto" + (barato && p === barato ? " barato" : "")}>
          <span className="mid"><b>{p.nome}</b><small>{p.n} {p.n === 1 ? "vez" : "vezes"} · {brl(p.gasto)}{barato && p === barato ? " · o mais barato" : ""}</small></span>
          {p.preco && <span className="preco"><b>{preco(p.preco)}</b><small>{ref0 ? (p.preco <= ref0 ? `${preco(ref0 - p.preco)} abaixo` : `${preco(p.preco - ref0)} acima`) : "o litro"}</small></span>}
        </div>
      ))}
    </div>
  );
}

// Um cartão por veículo: foto, nome e os números dele; o último cartão adiciona outro veículo
function SlideVeiculo({ db, v }) {
  const comb = estatisticasCombustivel(db, v), km = kmAtual(db, v), motor = v.tipo === "carro" || v.tipo === "moto";
  const nome = v.nome || (v.fipe && v.fipe.modelo) || (v.tipo === "nenhum" ? "Apps e transporte público" : "Seu veículo");
  return (
    <div className="transp-slide">
      <div className="transp-palco"><i className="transp-luz" aria-hidden="true" /><FotoVeiculo v={v} grande /><i className="transp-chao" aria-hidden="true" /></div>
      <h2>{nome}</h2>
      <div className="transp-chips">
        {v.combustivel && motor && <span>{(COMBUSTIVEIS.find(c => c[0] === v.combustivel) || [, ""])[1]}</span>}
        {motor && comb.consumo && <span>{kml(comb.consumo)} km/l{comb.consumoReal ? "" : " (informado)"}</span>}
        {motor && km && <span>{km.toLocaleString("pt-BR")} km</span>}
        {v.fipe && v.fipe.valor && <span>FIPE {v.fipe.valor}</span>}
      </div>
    </div>
  );
}
function Carrossel({ db, vs, v, onTrocar, act }) {
  const ref = useRef(null), espera = useRef(0);
  const idx = Math.max(0, vs.findIndex(x => v && x.id === v.id));
  // trocou por fora (veículo novo, toque na bolinha): rola até ele
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const alvo = idx * el.clientWidth;
    if (Math.abs(el.scrollLeft - alvo) > 4) el.scrollTo({ left: alvo, behavior: el.dataset.pronto ? "smooth" : "auto" });
    el.dataset.pronto = "1";
  }, [idx, vs.length]);
  const rolou = () => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const el = ref.current; if (!el) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i < vs.length && vs[i].id !== (v && v.id)) { vibrar("toque"); onTrocar(vs[i].id); }
    }, 80);
  };
  return (
    <section className="transp-hero" aria-roledescription="carrossel" aria-label="Seus veículos">
      <div className="transp-carrossel" ref={ref} onScroll={rolou}>
        {vs.map(x => <SlideVeiculo key={x.id} db={db} v={x} />)}
        <div className="transp-slide">
          <button className="transp-novo" onClick={() => act.abrirVeiculo("novo")}>
            <span className="transp-novo-ic"><I.plus /></span>
            <b>Adicionar veículo</b>
          </button>
        </div>
      </div>
      <div className="transp-pontos" role="tablist">
        {vs.map((x, i) => <button key={x.id} role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => onTrocar(x.id)} aria-label={x.nome || `Veículo ${i + 1}`} />)}
        <button className="mais" onClick={() => act.abrirVeiculo("novo")} aria-label="Adicionar veículo"><I.plus /></button>
      </div>
    </section>
  );
}

export function TransporteTab({ db, act, tema, perfil, atual, onTrocar }) {
  const vs = veiculosDe(db);
  const v = vs.find(x => x.id === atual) || vs[0] || null;
  const [off, setOff] = useState(0);
  const [filtro, setFiltro] = useState(null);
  const hoje = todayISO();
  const mes = mesDe(off), g = useMemo(() => gastosTransporte(db, mes.chave, v), [db, mes.chave, v]);
  const ant = useMemo(() => gastosTransporte(db, mesDe(off - 1).chave, v), [db, off, v]);
  const seis = useMemo(() => [5, 4, 3, 2, 1, 0].map(k => { const m = mesDe(off - k); return { ...m, total: gastosTransporte(db, m.chave, v).total }; }), [db, off, v]);
  const maior = Math.max(...seis.map(s => s.total), 1);
  const comb = useMemo(() => estatisticasCombustivel(db, v), [db, v]);
  const oleo = proximaTrocaOleo(db, v, hoje);
  const km = kmAtual(db, v);
  // Preço médio da semana (ANP) na sua cidade
  const [anp, setAnp] = useState({ st: "carregando" });
  useEffect(() => {
    let vivo = true;
    const cidade = perfil && perfil.cidade;
    if (!cidade) { setAnp({ st: "sem-cidade" }); return; }
    ufDaCidade(cidade).then(uf => precosCombustivel(servidorAvisos(), uf, cidade)).then(d => vivo && setAnp({ st: "ok", d })).catch(() => vivo && setAnp({ st: "erro" }));
    return () => { vivo = false; };
  }, [perfil && perfil.cidade]);
  const ref = anp.d ? (Object.keys(anp.d.cidade || {}).length ? { p: anp.d.cidade, onde: perfil.cidade } : Object.keys(anp.d.estado || {}).length ? { p: anp.d.estado, onde: "no seu estado" } : { p: anp.d.brasil, onde: "no Brasil" }) : null;
  const veredito = ref ? etanolOuGasolina(ref.p) : null;
  const flex = !v || !v.combustivel || v.combustivel === "flex";
  const temCarro = !v || v.tipo === "carro" || v.tipo === "moto";
  // calculadora de viagem
  const [kmViagem, setKmViagem] = useState("");
  const [idaVolta, setIdaVolta] = useState(true);
  const precoRef = comb.precoPago || (ref && (v && v.combustivel === "etanol" ? ref.p.etanol : v && v.combustivel === "diesel" ? ref.p.diesel : ref.p.gasolina)) || null;
  const kmTotal = num(kmViagem) * (idaVolta ? 2 : 1), litros = comb.consumo ? kmTotal / comb.consumo : 0;
  const manut = lancTransp(db, v).filter(l => ["manutencao", "melhorias"].includes(subDe(l))).sort((a, b) => b.data.localeCompare(a.data));
  const manutAno = manut.filter(l => l.data.startsWith(hoje.slice(0, 4))).reduce((s, l) => s + l.valor, 0);
  const subsMes = SUBS.filter(s => g.porSub[s.id]).sort((a, b) => g.porSub[b.id].total - g.porSub[a.id].total);
  const lista = g.itens.filter(i => !filtro || i.sub === filtro);
  // a porcentagem só faz sentido quando o mês anterior teve gasto de verdade
  const delta = ant.total >= 50 ? (g.total - ant.total) / ant.total : null;
  const nome = (v && v.nome) || (v && v.fipe && v.fipe.modelo) || (v && v.tipo === "nenhum" ? "Apps e transporte público" : "Seu veículo");
  const rodizio = proximoRodizio(db, v, hoje);
  const docs = docsVeiculo(v, hoje);
  const custo = useMemo(() => temCarro && v ? custoReal(db, v, hoje) : null, [db, v, hoje]);
  // FIPE do mês: uma vez por mês busca o valor de novo e guarda o histórico (mostra quanto o carro desvalorizou)
  useEffect(() => {
    if (!v || !v.fipe || !v.fipe.ids) return;
    const mesAtual = hoje.slice(0, 7), hist = v.fipeHist || [];
    if (hist.length && hist[hist.length - 1].quando === mesAtual) return;
    const { tipo, marca, modelo, ano } = v.fipe.ids;
    fipe.valor(tipo, marca, modelo, ano).then(r => {
      const val = valorFipe(r.Valor); if (!val) return;
      act.atualizarVeiculo(v.id, { fipe: { ...v.fipe, valor: r.Valor, mes: r.MesReferencia }, fipeHist: [...hist.filter(h => h.quando !== mesAtual), { quando: mesAtual, valor: val }].slice(-36) });
    }).catch(() => {});
  }, [v && v.fipe && v.fipe.codigo, hoje.slice(0, 7)]);
  const pagarDoc = d => {
    act.salvarLanc({ id: uid(), veiculoId: v.id, tipo: "saida", cat: "transporte", sub: "documentos", valor: d.valor, data: hoje, desc: `${d.nome} ${d.data.slice(0, 4)}` });
    act.atualizarVeiculo(v.id, { docs: { ...(v.docs || {}), [d.k]: { ...(v.docs || {})[d.k], data: umAnoDepois(d.data) } } });
  };

  return (
    <div className="page transp">
      <TopBar eyebrow={nome} title="Transporte" act={act} tema={tema}
        extra={<button className="icon-btn" onClick={() => act.abrirVeiculo(v ? v.id : "novo")} aria-label="Editar o veículo"><I.pencil /></button>} />
      <div className="cols">
        <div className="col">

        {vs.length ? <Carrossel db={db} vs={vs} v={v} onTrocar={id => { onTrocar(id); setOff(0); setFiltro(null); }} act={act} /> : (
          <section className="transp-hero">
            <div className="transp-palco"><i className="transp-luz" aria-hidden="true" /><FotoVeiculo v={null} grande /><i className="transp-chao" aria-hidden="true" /></div>
            <h2>Seu veículo</h2>
            <button className="btn ghost transp-escolher" onClick={() => act.abrirVeiculo("novo")}><I.car /> Escolher o meu veículo</button>
          </section>
        )}

        <Topo rotulo={<>Transporte em <b>{mes.nome}</b>{mes.ano !== new Date().getFullYear() ? ` de ${mes.ano}` : ""}</>} valor={g.total}
          nav={{ ant: () => { setOff(off - 1); setFiltro(null); vibrar("toque"); }, prox: () => { setOff(off + 1); setFiltro(null); vibrar("toque"); }, podeProx: off < 0 }}
          apoio={<Comparacao agora={g.total} antes={ant.total} nomeAnt={mesDe(off - 1).nome} />}>
          <div className="vz-barras" role="group" aria-label="Últimos 6 meses">
            {seis.map((s, i) => (
              <button key={s.chave} type="button" className={i === 5 ? "on" : ""} onClick={() => { setOff(off - (5 - i)); setFiltro(null); }} disabled={i === 5} style={{ "--i": i }} aria-label={`${s.nome}: ${brlReal(s.total)}`}>
                <small>{s.total > 0 ? brl(s.total).replace(/,d+$/, "") : ""}</small>
                <i style={{ height: `${Math.max(4, s.total / maior * 100)}%` }} />
                <span>{s.nome.slice(0, 3)}</span>
              </button>
            ))}
          </div>
        </Topo>

        <div className="transp-acoes">
          {temCarro && <button onClick={() => act.abrirGastoTransp({ sub: "combustivel", veiculoId: v && v.id })}><span className="ic ilu"><Ilustra n="bomba" /></span>Abastecer</button>}
          {temCarro && <button onClick={() => act.abrirGastoTransp({ sub: "manutencao", veiculoId: v && v.id })}><span className="ic ilu"><Ilustra n="ferramentas" /></span>Manutenção</button>}
          <button onClick={() => act.abrirGastoTransp({ sub: temCarro ? "estacionamento" : "app", veiculoId: v && v.id })}><span className="ic" style={{ "--c": "var(--mode)" }}><I.plus /></span>Outro gasto</button>
        </div>

        {subsMes.length > 0 && (
          <section aria-label="Para onde foi o dinheiro">
            <div className="vz-head"><h3>Para onde foi</h3>{filtro && <button className="link" onClick={() => setFiltro(null)}>Ver tudo</button>}</div>
            <div className="vz-trilho">
              {subsMes.map(s => { const x = g.porSub[s.id]; return (
                <button key={s.id} type="button" className={"vz-card" + (filtro === s.id ? " on" : filtro ? " apaga" : "")} aria-pressed={filtro === s.id} style={{ "--gc": s.cor }} onClick={() => { setFiltro(filtro === s.id ? null : s.id); vibrar("toque"); }}>
                  <IconeAnel cor={s.cor} tinta={s.id === "combustivel" ? "#2A1A00" : "#fff"} p={x.total / (g.total || 1)}><IconeSub id={s.id} /></IconeAnel>
                  <span className="vz-card-n">{s.nome}</span>
                  <b className="num vz-card-v"><Money v={x.total} /></b>
                  <small>{x.n} {x.n === 1 ? "gasto" : "gastos"} · {Math.round(x.total / (g.total || 1) * 100)}%</small>
                </button>
              ); })}
            </div>
          </section>
        )}

        {custo && (
          <section className="transp-card transp-custo">
            <div className="transp-card-cab"><h3>Quanto o carro custa de verdade</h3><small>últimos {custo.nMeses === 1 ? "30 dias" : `${custo.nMeses} meses`}</small></div>
            <div className="transp-custo-nums">
              <div><b><Money v={custo.porMes} /></b><small>por mês</small></div>
              <div><b>{brlReal(custo.porDia)}</b><small>por dia</small></div>
              <div><b>{custo.porKm ? brlReal(custo.porKm) : "—"}</b><small>por km rodado</small></div>
            </div>
            <div className="transp-custo-barra" aria-hidden="true">{SUBS.filter(s => custo.porSub[s.id]).map(s => <i key={s.id} style={{ width: `${custo.porSub[s.id] / custo.total * 100}%`, background: s.cor }} />)}</div>
            <div className="transp-custo-leg">{SUBS.filter(s => custo.porSub[s.id]).map(s => <span key={s.id}><i style={{ background: s.cor }} />{s.nome} {Math.round(custo.porSub[s.id] / custo.total * 100)}%</span>)}</div>
            {custo.perdeu && <p className="hint">Pela FIPE, o carro perdeu <b>{brl(custo.perdeu.valor)}</b> de valor desde {MES_LONGO[Number(custo.perdeu.desde.slice(5)) - 1]} de {custo.perdeu.desde.slice(0, 4)}. Isso também é custo, só que invisível.</p>}
            {!custo.porKm && <p className="hint">Anotando a km do painel ao abastecer, eu mostro o custo de cada km rodado (dá para comparar com uma corrida de app).</p>}
            {custo.porKm && <CarroOuApp custo={custo} v={v} act={act} />}
          </section>
        )}

        <ProximaConquista act={act} trilhas={["estrada"]} />

        </div>
        <div className="col">
        {temCarro && (
          <section className="transp-card com-ilu">
            <Ilustra n="bomba" className="transp-sai bomba" />
            <div className="transp-card-cab"><h3>Combustível</h3></div>
            {anp.st === "carregando" && <p className="hint">Buscando o preço da semana na ANP…</p>}
            {anp.st === "sem-cidade" && <p className="hint">Coloque a sua cidade em Perfil → Dados pessoais para ver o preço da semana.</p>}
            {anp.st === "erro" && <p className="hint">Não consegui buscar o preço da ANP agora.</p>}
            {ref && <>
              <div className="transp-precos">
                {[["gasolina", "Gasolina"], ["etanol", "Etanol"], ["diesel", "Diesel S10"], ["gnv", "GNV (m³)"]].filter(([k]) => ref.p[k] && (k !== "diesel" || (v && v.combustivel === "diesel")) && (k !== "gnv" || (v && v.combustivel === "gnv"))).map(([k, n]) => (
                  <span key={k} className={veredito && flex && k === veredito.veredito ? "melhor" : ""}><small>{n}</small><b>{preco(ref.p[k])}</b></span>
                ))}
              </div>
              <p className="transp-fonte">Preço médio {ref.onde === perfil.cidade ? `em ${ref.onde}` : ref.onde} · ANP, semana de {dm(anp.d.ini)} a {dm(anp.d.fim)}{anp.d.velho ? " · sem internet agora" : ""}</p>
              {veredito && flex && <div className={"transp-veredito " + veredito.veredito}><b>{veredito.veredito === "etanol" ? "Etanol compensa" : veredito.veredito === "gasolina" ? "Gasolina compensa" : "Tanto faz"}</b><span>O etanol está custando {Math.round(veredito.razao * 100)}% da gasolina. Ele compensa abaixo de 70%, porque rende menos.</span></div>}
            </>}
            <div className="transp-linhas">
              <div><span>Seu consumo</span><b>{comb.consumo ? `${kml(comb.consumo)} km/l` : "—"}</b></div>
              <div><span>Custo por km</span><b>{comb.custoKm ? brlReal(comb.custoKm) : "—"}</b></div>
              {comb.ultimo && <div><span>Último abastecimento</span><b>{preco(comb.precoPago)}/l · {dm(comb.ultimo.data)}</b></div>}
            </div>
            {comb.ultimo && ref && ref.p[comb.ultimo.combustivel || "gasolina"] && (() => { const dif = comb.precoPago - ref.p[comb.ultimo.combustivel || "gasolina"]; return Math.abs(dif) >= .02 && <p className={"hint " + (dif > 0 ? "ruim" : "bom")}>Você pagou {preco(Math.abs(dif))} {dif > 0 ? "acima" : "abaixo"} da média da semana.</p>; })()}
            {!comb.consumoReal && <p className="hint">Ao abastecer, anote os litros e a km do painel: com dois abastecimentos eu calculo o seu consumo real.</p>}
            <Postos lista={postos(db, v)} ref0={ref && ref.p[(v && v.combustivel !== "flex" && v.combustivel) || "gasolina"]} />
          </section>
        )}

        {temCarro && (
          <section className="transp-card com-ilu">
            <Ilustra n="ferramentas" className="transp-sai ferramentas" />
            <div className="transp-card-cab"><h3>Manutenção</h3>{manutAno > 0 && <small>{brl(manutAno)} em {hoje.slice(0, 4)}</small>}</div>
            {oleo ? (
              <div className={"transp-oleo" + (oleo.urgente ? " urgente" : "")}>
                <b>Próxima troca de óleo</b>
                <span>{oleo.faltamKm != null ? (oleo.faltamKm > 0 ? `em ${oleo.faltamKm.toLocaleString("pt-BR")} km` : `passou ${Math.abs(oleo.faltamKm).toLocaleString("pt-BR")} km`) + " ou " : ""}{oleo.faltamDias >= 0 ? `até ${dataCurta(oleo.ate)}` : `venceu em ${dataCurta(oleo.ate)}`}</span>
              </div>
            ) : <p className="hint">Anote a última troca de óleo (em Manutenção) e eu aviso quando chegar a próxima.</p>}
            <div className={"transp-pneu" + (rodizio && rodizio.urgente ? " urgente" : "")}>
              <Ilustra n="pneu" />
              <span><b>Pneus</b>{rodizio
                ? <small>Rodízio e alinhamento {rodizio.faltamKm != null ? (rodizio.faltamKm > 0 ? `em ${rodizio.faltamKm.toLocaleString("pt-BR")} km ou ` : `atrasado ${Math.abs(rodizio.faltamKm).toLocaleString("pt-BR")} km · `) : ""}{rodizio.faltamDias >= 0 ? `até ${dataCurta(rodizio.ate)}` : `venceu em ${dataCurta(rodizio.ate)}`}</small>
                : <small>Calibre a cada 15 dias. Rodízio e alinhamento a cada 10.000 km: anote e eu lembro.</small>}</span>
              <button className="bub-act" onClick={() => act.abrirGastoTransp({ sub: "manutencao", manut: "alinhamento", veiculoId: v && v.id })}>Anotar rodízio</button>
            </div>
            {manut.slice(0, 4).map(l => (
              <button key={l.id} className="transp-item" onClick={() => act.abrirGastoTransp({ inicial: l })}>
                <span className="ic" style={{ "--c": subInfo(subDe(l)).cor }}><IconeSub id={subDe(l)} /></span>
                <span className="mid"><b>{l.desc || subInfo(subDe(l)).nome}</b><small>{relativo(l.data)}{l.km ? ` · ${l.km.toLocaleString("pt-BR")} km` : ""}</small></span>
                <span className="amt">−<Money v={l.valor} /></span>
              </button>
            ))}
          </section>
        )}

        {temCarro && v && (
          <section className="transp-card">
            <div className="transp-card-cab"><span className="ic" style={{ "--c": subInfo("documentos").cor }}><Ic.documentos /></span><h3>IPVA, licenciamento e seguro</h3></div>
            {docs.length === 0 ? <p className="hint">Coloque as datas de vencimento (no lápis, lá em cima) e eu aviso uma semana antes e no dia.</p> : docs.map(d => (
              <div key={d.k} className={"transp-doc" + (d.dias < 0 ? " atrasado" : d.dias <= 15 ? " perto" : "")}>
                <span className="mid"><b>{d.nome}</b><small>{d.dias < 0 ? `Venceu há ${-d.dias} ${d.dias === -1 ? "dia" : "dias"}` : d.dias === 0 ? "Vence hoje" : d.dias <= 60 ? `Vence em ${d.dias} ${d.dias === 1 ? "dia" : "dias"} · ${dataCurta(d.data)}` : `Vence em ${dataCurta(d.data)}`}{d.valor ? ` · ${brl(d.valor)}` : ""}</small></span>
                {d.dias <= 60 && <button className="bub-act" onClick={() => pagarDoc(d)}>Paguei</button>}
              </div>
            ))}
            {docs.length > 0 && docs.length < 3 && <button className="link" onClick={() => act.abrirVeiculo(v.id)}>+ Colocar {DOCS_VEICULO.filter(([k]) => !docs.some(d => d.k === k)).map(x => x[1]).join(" ou ")}</button>}
          </section>
        )}

        {temCarro && (
          <section className="transp-card com-ilu">
            <Ilustra n="malas" className="transp-sai malas" />
            <div className="transp-card-cab"><h3>Quanto custa a viagem?</h3></div>
            <div className="transp-calc">
              <Field label="Distância (km)" htmlFor="t-km"><input id="t-km" inputMode="decimal" value={kmViagem} onChange={e => setKmViagem(soNumero(e.target.value))} placeholder="Ex.: 120" /></Field>
              <Toggle on={idaVolta} onClick={() => setIdaVolta(!idaVolta)}>Ida e volta</Toggle>
            </div>
            {kmTotal > 0 && (comb.consumo && precoRef
              ? <div className="transp-calc-res"><b>{brlReal(litros * precoRef)}</b><span>{fmtNum(Math.round(litros * 10) / 10)} litros para {kmTotal.toLocaleString("pt-BR")} km · {kml(comb.consumo)} km/l a {preco(precoRef)}</span></div>
              : <p className="hint">Para calcular, informe o consumo do veículo (no lápis, lá em cima) ou anote dois abastecimentos.</p>)}
          </section>
        )}

        <section className="transp-card">
          <div className="transp-card-cab"><h3>{filtro ? subInfo(filtro).nome : "Gastos do mês"}</h3>{filtro && <button className="link" onClick={() => setFiltro(null)}>Ver todos</button>}</div>
          {lista.length === 0 && <div className="empty">{filtro ? "Nada nesta categoria no mês." : "Nenhum gasto com transporte neste mês."}</div>}
          {lista.map((l, i) => (
            <React.Fragment key={l.id}>
            {(i === 0 || lista[i - 1].data !== l.data) && <div className="day-sep">{relativo(l.data)}</div>}
            <button className="transp-item" disabled={l.conta} onClick={() => !l.conta && act.abrirGastoTransp({ inicial: l })}>
              <span className="ic" style={{ "--c": subInfo(l.sub).cor }}><IconeSub id={l.sub} /></span>
              <span className="mid"><b>{l.desc || subInfo(l.sub).nome}</b><small>{subInfo(l.sub).nome} · {relativo(l.data).toLowerCase()}{l.litros ? ` · ${fmtNum(l.litros)} L` : ""}{l.conta ? " · conta fixa" : ""}</small></span>
              <span className="amt">−<Money v={l.valor} /></span>
            </button>
            </React.Fragment>
          ))}
          <button className="link transp-teto" onClick={() => act.abrirTeto("transporte")}><I.gauge /> Teto de gastos com transporte</button>
        </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Abastecer, manutenção e outros gastos ---------- */
export function GastoTransporteSheet({ sub0, manut0, inicial, veiculos = [], veiculoId, precos, onSave, onDelete, onClose }) {
  const [vid, setVid] = useState(() => (veiculos.some(x => x.id === veiculoId) ? veiculoId : (veiculos.find(x => x.tipo !== "nenhum") || veiculos[0] || {}).id) || null);
  const veiculo = veiculos.find(x => x.id === vid) || null;
  const [sub, setSub] = useState(inicial ? subDe(inicial) : sub0 || "combustivel");
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [litros, setLitros] = useState(inicial && inicial.litros ? fmtNum(inicial.litros) : "");
  const [precoL, setPrecoL] = useState(inicial && inicial.precoLitro ? fmtNum(inicial.precoLitro) : "");
  const comb0 = inicial && inicial.combustivel ? inicial.combustivel : veiculo && ["gasolina", "etanol", "diesel", "gnv"].includes(veiculo.combustivel) ? veiculo.combustivel : "gasolina";
  const [combustivel, setCombustivel] = useState(comb0);
  const [km, setKm] = useState(inicial && inicial.km ? String(inicial.km) : "");
  const [manut, setManut] = useState(inicial && inicial.manut ? inicial.manut : manut0 || "revisao");
  const [desc, setDesc] = useState(inicial ? inicial.desc || "" : "");
  const [data, setData] = useState(inicial ? inicial.data : todayISO());
  const v = num(valor), l = num(litros), p = num(precoL);
  // valor, litros e preço por litro: preenchendo dois, o terceiro sai sozinho
  const litrosCalc = l || (v && p ? v / p : 0), precoCalc = p || (v && l ? v / l : 0);
  const ehComb = sub === "combustivel", ehManut = sub === "manutencao" || sub === "melhorias";
  const ok = v > 0;
  const salvar = () => {
    const nomeManut = (MANUTENCOES.find(m => m[0] === manut) || [, ""])[1];
    onSave({
      ...(inicial || {}), id: inicial ? inicial.id : uid(), veiculoId: vid || undefined, tipo: "saida", cat: "transporte", valor: v, data, sub,
      desc: desc.trim() || (ehComb ? `Abastecimento (${(COMBUSTIVEIS.find(c => c[0] === combustivel) || [, "combustível"])[1].toLowerCase()})` : ehManut ? nomeManut : subInfo(sub).nome),
      litros: ehComb && litrosCalc ? Math.round(litrosCalc * 100) / 100 : undefined,
      precoLitro: ehComb && precoCalc ? Math.round(precoCalc * 1000) / 1000 : undefined,
      combustivel: ehComb ? combustivel : undefined, manut: ehManut ? manut : undefined,
      km: (ehComb || ehManut) && num(km) > 0 ? Math.round(num(km)) : undefined,
    });
    vibrar("ok");
  };
  return (
    <Sheet title={inicial ? "Editar gasto" : ehComb ? "Abastecer" : ehManut ? "Manutenção" : "Gasto com transporte"} onClose={onClose}>
      <div className="transp-subs" role="radiogroup" aria-label="Tipo de gasto">
        {SUBS.filter(s => s.id !== "outros" || sub === "outros").map(s => (
          <button key={s.id} type="button" role="radio" aria-checked={sub === s.id} className={sub === s.id ? "on" : ""} style={{ "--c": s.cor }} onClick={() => setSub(s.id)}><IconeSub id={s.id} />{s.nome}</button>
        ))}
      </div>
      {veiculos.length > 1 && <div className="transp-de-qual" role="radiogroup" aria-label="De qual veículo">
        {veiculos.map(x => <button key={x.id} type="button" role="radio" aria-checked={vid === x.id} className={vid === x.id ? "on" : ""} onClick={() => setVid(x.id)}><FotoVeiculo v={x} />{x.nome || (x.tipo === "nenhum" ? "Apps e ônibus" : "Veículo")}</button>)}
      </div>}
      <label className="big-amt" htmlFor="tg-valor"><span>R$</span><input id="tg-valor" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" autoFocus={!inicial} /></label>
      {ehComb && <>
        <Seg value={combustivel} onChange={setCombustivel} options={[["gasolina", "Gasolina"], ["etanol", "Etanol"], ["diesel", "Diesel"], ["gnv", "GNV"]].map(([k, n]) => ({ v: k, l: n }))} />
        <div className="fields duas">
          <Field label="Litros" htmlFor="tg-l"><input id="tg-l" inputMode="decimal" value={litros} onChange={e => setLitros(soNumero(e.target.value))} placeholder={litrosCalc && !l ? fmtNum(Math.round(litrosCalc * 100) / 100) : "0,00"} /></Field>
          <Field label="Preço do litro" htmlFor="tg-p"><input id="tg-p" inputMode="decimal" value={precoL} onChange={e => setPrecoL(soNumero(e.target.value))} placeholder={precoCalc && !p ? fmtNum(Math.round(precoCalc * 100) / 100) : precos && precos[combustivel] ? fmtNum(precos[combustivel]) : "0,00"} /></Field>
        </div>
        {precos && precos[combustivel] && precoCalc > 0 && <div className="hint">Média da semana na sua região: {preco(precos[combustivel])}. {precoCalc > precos[combustivel] + .02 ? "Você pagou acima." : precoCalc < precos[combustivel] - .02 ? "Você pagou abaixo. Boa!" : "Na média."}</div>}
      </>}
      {ehManut && (
        <div className="transp-subs" role="radiogroup" aria-label="O que foi feito">
          {MANUTENCOES.map(([k, n]) => <button key={k} type="button" role="radio" aria-checked={manut === k} className={manut === k ? "on" : ""} onClick={() => setManut(k)}>{n}</button>)}
        </div>
      )}
      <div className="fields">
        {(ehComb || ehManut) && <Field label="Km no painel (opcional)" htmlFor="tg-km"><input id="tg-km" inputMode="numeric" value={km} onChange={e => setKm(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 45300" /></Field>}
        <Field label={ehComb ? "Posto (opcional)" : ehManut ? "Oficina ou detalhe (opcional)" : "Descrição (opcional)"} htmlFor="tg-d"><input id="tg-d" value={desc} onChange={e => setDesc(e.target.value)} placeholder={ehComb ? "Ex.: Posto Shell" : ehManut ? "Ex.: Oficina do João" : "Ex.: Uber, Zona Azul, IPVA"} autoComplete="off" /></Field>
        <Field label="Quando" htmlFor="tg-dt"><input id="tg-dt" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} /></Field>
      </div>
      {ehComb && <div className="hint">Dica: encha o tanque e anote a km. Com dois abastecimentos assim, eu calculo o consumo real do carro.</div>}
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : "Anotar"}</button>
      {inicial && <ConfirmButton label="Apagar gasto" titulo="Apagar este gasto?" texto="Ele sai do transporte e dos totais do mês." acao="Apagar" onConfirm={() => onDelete(inicial.id)} />}
    </Sheet>
  );
}

/* ---------- O seu veículo: foto, apelido, combustível, consumo, km e Tabela FIPE ---------- */
async function fotoDoCarro(file) {
  const url = await lerArquivo(file);
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
  const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", .82);
}
export function VeiculoSheet({ veiculo, db, onSave, onDelete, onClose }) {
  const km0 = kmAtual(db, veiculo);
  const v0 = veiculo || {};
  const [tipo, setTipo] = useState(v0.tipo || "carro");
  const [foto, setFoto] = useState(v0.foto || "auto");
  const [nome, setNome] = useState(v0.nome || "");
  const [combustivel, setCombustivel] = useState(v0.combustivel || "flex");
  const [consumo, setConsumo] = useState(v0.consumo ? fmtNum(v0.consumo) : "");
  const [km, setKm] = useState(v0.km ? String(v0.km) : km0 ? String(km0) : "");
  const [oleoKm, setOleoKm] = useState(v0.oleoKm || 10000);
  const [oleoMeses, setOleoMeses] = useState(v0.oleoMeses || 12);
  const [fipeV, setFipeV] = useState(v0.fipe || null);
  const [docs, setDocs] = useState(() => Object.fromEntries(DOCS_VEICULO.map(([k]) => [k, { data: (v0.docs && v0.docs[k] && v0.docs[k].data) || "", valor: v0.docs && v0.docs[k] && v0.docs[k].valor ? fmtNum(v0.docs[k].valor) : "" }])));
  const upDoc = (k, campo, val) => setDocs(d => ({ ...d, [k]: { ...d[k], [campo]: val } }));
  const [erro, setErro] = useState("");
  const arq = useRef(null);
  const escolherFoto = async e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { setFoto(await fotoDoCarro(f)); setErro(""); } catch (x) { setErro("Não consegui abrir essa foto."); } };
  const veiculoTela = { tipo, foto, nome, fipe: fipeV };
  const temMotor = tipo === "carro" || tipo === "moto";
  const propria = String(foto).startsWith("data:");
  // o tipo de carro que o automático achou, para explicar em palavras simples
  const desenhoAuto = fotoDoVeiculo({ tipo: "carro", foto: "auto", nome, fipe: fipeV });
  const achado = carroceria(fipeV && fipeV.modelo) || carroceria(nome);
  const info = tipo !== "carro" || propria ? null : foto === "auto" ? (achado ? FOTOS.find(f => f[0] === achado) || [achado, NOME_CARROCERIA[achado] || achado] : null) : FOTOS.find(f => f[0] === foto);
  return (
    <Sheet title={veiculo ? "Seu veículo" : veiculosDe(db).length ? "Novo veículo" : "Escolha o seu veículo"} sub="Fica só com você, para deixar a tela com a sua cara." onClose={onClose}>
      <div className="transp-palco mini"><FotoVeiculo v={veiculoTela} grande /><i className="transp-chao" aria-hidden="true" /></div>
      <Seg value={tipo} onChange={t => { setTipo(t); if (!propria) setFoto("auto"); }} options={[{ v: "carro", l: "Carro" }, { v: "moto", l: "Moto" }, { v: "bike", l: "Bike" }, { v: "nenhum", l: "Sem veículo" }]} />
      <div className="transp-fotos" role="radiogroup" aria-label="Foto do veículo">
        {tipo === "carro" && <button type="button" role="radio" aria-checked={foto === "auto"} className={"auto" + (foto === "auto" ? " on" : "")} onClick={() => setFoto("auto")}><Ilustra n={desenhoAuto[2]} /><small>Automático</small></button>}
        {tipo === "carro" && FOTOS.map(([k, n, arquivo]) => (
          <button key={k} type="button" role="radio" aria-checked={foto === k} className={foto === k ? "on" : ""} onClick={() => setFoto(k)}><Ilustra n={arquivo} /><small>{n}</small></button>
        ))}
        {tipo === "moto" && <button type="button" role="radio" aria-checked={!propria} className={!propria ? "on" : ""} onClick={() => setFoto("auto")}><Ilustra n={FOTO_MOTO[2]} /><small>Desenho</small></button>}
        {tipo === "bike" && <button type="button" role="radio" aria-checked={!propria} className={!propria ? "on" : ""} onClick={() => setFoto("auto")}><span className="emoji">{EMOJI[tipo]}</span><small>Ícone</small></button>}
        {tipo !== "nenhum" && <button type="button" role="radio" aria-checked={String(foto).startsWith("data:")} className={String(foto).startsWith("data:") ? "on" : ""} onClick={() => arq.current && arq.current.click()}>
          {String(foto).startsWith("data:") ? <img src={foto} alt="" /> : <span className="emoji"><I.camera /></span>}<small>Foto minha</small>
        </button>}
        <input ref={arq} type="file" accept="image/*" hidden onChange={escolherFoto} />
      </div>
      {tipo === "carro" && !propria && <div className="transp-tipo-info" aria-live="polite">
        {info ? <>
          <b>{foto === "auto" ? "Pelo modelo, o seu é: " : ""}{info[1]}</b>
          {info[3] ? <span>{info[3]} Ex.: {info[4]}.</span> : <span>Ainda não tenho o desenho desse tipo, então uso o mais parecido.</span>}
        </> : <span>No automático, eu descubro o tipo do carro pelo modelo da FIPE (ou pelo apelido). Se preferir, toque no desenho que mais parece com o seu.</span>}
      </div>}
      {erro && <div className="error">{erro}</div>}
      <div className="fields">
        <Field label="Apelido" htmlFor="v-nome"><input id="v-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder={tipo === "nenhum" ? "Ex.: Uber e metrô" : "Ex.: Meu Onix, Bolinha azul"} autoComplete="off" /></Field>
      </div>
      {temMotor && <>
        <Field label="Combustível">
          <div className="transp-subs">{COMBUSTIVEIS.map(([k, n]) => <button key={k} type="button" className={combustivel === k ? "on" : ""} onClick={() => setCombustivel(k)}>{n}</button>)}</div>
        </Field>
        <div className="fields duas">
          <Field label="Consumo (km/l)" htmlFor="v-c"><input id="v-c" inputMode="decimal" value={consumo} onChange={e => setConsumo(soNumero(e.target.value))} placeholder="Ex.: 11,5" /></Field>
          <Field label="Km no painel" htmlFor="v-km"><input id="v-km" inputMode="numeric" value={km} onChange={e => setKm(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 45300" /></Field>
        </div>
        <Field label="Troca de óleo a cada">
          <div className="transp-subs">
            {[5000, 7500, 10000, 15000].map(k => <button key={k} type="button" className={oleoKm === k ? "on" : ""} onClick={() => setOleoKm(k)}>{k.toLocaleString("pt-BR")} km</button>)}
            {[6, 12].map(m => <button key={"m" + m} type="button" className={oleoMeses === m ? "on" : ""} onClick={() => setOleoMeses(m)}>ou {m} meses</button>)}
          </div>
        </Field>
        <h3 className="section-title">IPVA, licenciamento e seguro</h3>
        <div className="transp-docs-form">
          {DOCS_VEICULO.map(([k, n]) => (
            <div key={k} className="fields duas">
              <Field label={`${n}: vence em`} htmlFor={`vd-${k}`}><input id={`vd-${k}`} type="date" value={docs[k].data} onChange={e => upDoc(k, "data", e.target.value)} /></Field>
              <Field label="Valor (R$)" htmlFor={`vv-${k}`}><input id={`vv-${k}`} inputMode="decimal" value={docs[k].valor} onChange={e => upDoc(k, "valor", soNumero(e.target.value))} placeholder="Opcional" /></Field>
            </div>
          ))}
        </div>
        <BuscaFipe tipo={tipo === "moto" ? "motos" : "carros"} valor={fipeV} onEscolher={f => { setFipeV(f); if (!nome.trim() && f) setNome(f.modelo.split(" ").slice(0, 2).join(" ")); if (f && /alcool|etanol|flex/i.test(f.combustivel || "") && combustivel === "flex") setCombustivel(/flex/i.test(f.combustivel) ? "flex" : "etanol"); }} />
      </>}
      <button className="btn mode" onClick={() => {
        const docsOk = temMotor ? Object.fromEntries(DOCS_VEICULO.filter(([k]) => docs[k].data).map(([k]) => [k, { data: docs[k].data, valor: num(docs[k].valor) || 0 }])) : {};
        // histórico da FIPE: guarda o valor do mês (troca de carro zera o histórico)
        const mesAtual = todayISO().slice(0, 7), val = fipeV ? valorFipe(fipeV.valor) : 0;
        const mesmoCarro = fipeV && v0.fipe && v0.fipe.codigo === fipeV.codigo && v0.fipe.ano === fipeV.ano;
        const hist = !val ? [] : [...(mesmoCarro ? (v0.fipeHist || []).filter(h => h.quando !== mesAtual) : []), { quando: mesAtual, valor: val }];
        onSave({ ...v0, tipo, foto: tipo === "nenhum" ? "" : foto, nome: nome.trim(), combustivel: temMotor ? combustivel : "", consumo: num(consumo) || null, km: num(km) || null, oleoKm, oleoMeses, fipe: temMotor ? fipeV : null, fipeHist: temMotor ? hist : [], docs: docsOk });
      }}><I.check /> Salvar</button>
      {veiculo && veiculo.id && <ConfirmButton label="Remover este veículo" titulo={`Remover ${veiculo.nome || "este veículo"}?`} texto="Ele sai do Transporte. Os gastos dele continuam guardados em Gastos." acao="Remover" onConfirm={() => onDelete(veiculo.id)} />}
    </Sheet>
  );
}

// Tabela FIPE (opcional): marca -> modelo -> ano -> valor
// nomes como as pessoas falam ("Chevrolet", e não "GM - Chevrolet"), apelidos e as marcas mais comuns primeiro
const nomeMarca = n => n.replace(/^GM - Chevrolet$/i, "Chevrolet").replace(/^VW - VolksWagen$/i, "Volkswagen").replace(/^(GM|VW) - /i, "");
const simples = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const APELIDOS_MARCA = { gm: "chevrolet", chevy: "chevrolet", vw: "volkswagen", volks: "volkswagen", wolks: "volkswagen", mercedes: "mercedes", citroen: "citroen", chery: "chery" };
const POPULARES = ["chevrolet", "fiat", "volkswagen", "ford", "toyota", "hyundai", "renault", "honda", "jeep", "nissan", "peugeot", "citroen", "byd", "caoa chery", "yamaha", "kawasaki", "suzuki", "bmw"];
function BuscaFipe({ tipo, valor, onEscolher }) {
  const [qMarca, setQMarca] = useState(""), [marcaNome, setMarcaNome] = useState("");
  const [aberto, setAberto] = useState(false);
  const [marcas, setMarcas] = useState([]), [modelos, setModelos] = useState([]), [anos, setAnos] = useState([]);
  const [marca, setMarca] = useState(""), [modelo, setModelo] = useState(""), [busca, setBusca] = useState("");
  const [st, setSt] = useState("");
  useEffect(() => { if (!aberto || marcas.length) return; setSt("carregando"); fipe.marcas(tipo).then(m => { setMarcas(m); setSt(""); }).catch(() => setSt("erro")); }, [aberto, tipo]);
  const escolherMarca = (id, nome) => { setMarca(id); setMarcaNome(nome || ""); setBusca(""); setModelo(""); setAnos([]); setModelos([]); if (!id) return; setSt("carregando"); fipe.modelos(tipo, id).then(m => { setModelos(m); setSt(""); }).catch(() => setSt("erro")); };
  const escolherModelo = id => { setModelo(id); setAnos([]); if (!id) return; setSt("carregando"); fipe.anos(tipo, marca, id).then(a => { setAnos(a); setSt(""); }).catch(() => setSt("erro")); };
  const escolherAno = id => { if (!id) return; setSt("carregando"); fipe.valor(tipo, marca, modelo, id).then(r => { onEscolher({ marca: r.Marca, modelo: r.Modelo, ano: r.AnoModelo === 32000 ? "Zero km" : r.AnoModelo, combustivel: r.Combustivel, valor: r.Valor, mes: r.MesReferencia, codigo: r.CodigoFipe, ids: { tipo, marca, modelo, ano: id } }); setSt(""); setAberto(false); vibrar("ok"); }).catch(() => setSt("erro")); };
  const q = simples(qMarca), qAlvo = APELIDOS_MARCA[q] || q;
  const listaMarcas = q
    ? marcas.filter(m => simples(nomeMarca(m.nome)).includes(qAlvo) || simples(m.nome).includes(q)).slice(0, 14)
    : POPULARES.map(p => marcas.find(m => simples(nomeMarca(m.nome)) === p)).filter(Boolean).slice(0, 12);
  const filtrados = busca.trim() ? modelos.filter(m => m.nome.toLowerCase().includes(busca.trim().toLowerCase())) : modelos;
  if (!aberto) return (
    <div className="transp-fipe">
      {valor ? <div><small>Tabela FIPE · {valor.mes}</small><b>{valor.valor}</b><span>{nomeMarca(valor.marca || "")} {valor.modelo} · {valor.ano}</span></div> : <span className="hint" style={{ padding: 0 }}>Quanto vale o seu {tipo === "motos" ? "moto" : "carro"}? Puxe da Tabela FIPE (opcional).</span>}
      <button type="button" className="pill-btn" onClick={() => setAberto(true)}>{valor ? "Trocar" : "Buscar na FIPE"}</button>
      {valor && <button type="button" className="link" onClick={() => onEscolher(null)}>Tirar</button>}
    </div>
  );
  return (
    <div className="transp-fipe aberto">
      {!marca ? <>
        <input value={qMarca} onChange={e => setQMarca(e.target.value)} placeholder="Marca (ex.: Chevrolet, Fiat, VW)" aria-label="Buscar a marca" autoComplete="off" />
        <div className="fipe-marcas">
          {!q && marcas.length > 0 && <small>Mais comuns</small>}
          {listaMarcas.map(m => <button key={m.codigo} type="button" onClick={() => escolherMarca(m.codigo, nomeMarca(m.nome))}>{nomeMarca(m.nome)}</button>)}
          {q && marcas.length > 0 && !listaMarcas.length && <span className="hint" style={{ padding: 0 }}>Nenhuma marca com esse nome.</span>}
        </div>
      </> : <div className="fipe-escolhida"><b>{marcaNome}</b><button type="button" className="link" onClick={() => escolherMarca("")}>Trocar marca</button></div>}
      {marca && <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar o modelo (ex.: onix 1.0)" aria-label="Filtrar modelo" />}
      {marca && <select value={modelo} onChange={e => escolherModelo(e.target.value)} aria-label="Modelo"><option value="">{modelos.length ? `Modelo… (${filtrados.length})` : "Carregando…"}</option>{filtrados.slice(0, 400).map(m => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}</select>}
      {modelo && <select defaultValue="" onChange={e => escolherAno(e.target.value)} aria-label="Ano"><option value="">{anos.length ? "Ano…" : "Carregando…"}</option>{anos.map(a => <option key={a.codigo} value={a.codigo}>{a.nome.replace(/^32000/, "Zero km")}</option>)}</select>}
      {st === "carregando" && <span className="hint" style={{ padding: 0 }}>Consultando a Tabela FIPE…</span>}
      {st === "erro" && <span className="error" style={{ padding: 0 }}>A Tabela FIPE não respondeu. Tente de novo em instantes.</span>}
      <button type="button" className="link" onClick={() => setAberto(false)}>Cancelar</button>
    </div>
  );
}
