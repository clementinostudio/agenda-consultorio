// Parte do app carregada sob demanda: aba "Transporte" do modo Pessoal (também abre ao tocar em Transporte, em Gastos).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { I, Sheet, Field, Seg, Toggle, Money, brl, brlReal, num, soNumero, fmtNum, uid, todayISO, MES_LONGO, pad, dm, relativo, vibrar, Ilustra, lerArquivo, servidorAvisos, ConfirmButton, TopBar } from "../App.jsx";
import { SUBS, subInfo, subDe, MANUTENCOES, FOTOS, COMBUSTIVEIS, gastosTransporte, estatisticasCombustivel, kmAtual, proximaTrocaOleo, precosCombustivel, etanolOuGasolina, fipe } from "../transporte.js";

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
  const f = FOTOS.find(x => x[0] === (v && v.foto)) || (!v || v.tipo === "carro" || !v.tipo ? FOTOS[0] : null);
  if (f) return <Ilustra n={f[2]} className={cls + " f-" + f[0]} alt={f[1]} />;
  return <span className={cls + " emoji"} aria-hidden="true">{EMOJI[v.tipo] || "🚗"}</span>;
}

export function TransporteTab({ db, act, tema, perfil }) {
  const v = (db.pessoal && db.pessoal.veiculo) || null;
  const [off, setOff] = useState(0);
  const [filtro, setFiltro] = useState(null);
  const hoje = todayISO();
  const mes = mesDe(off), g = useMemo(() => gastosTransporte(db, mes.chave), [db, mes.chave]);
  const ant = useMemo(() => gastosTransporte(db, mesDe(off - 1).chave), [db, off]);
  const seis = useMemo(() => [5, 4, 3, 2, 1, 0].map(k => { const m = mesDe(off - k); return { ...m, total: gastosTransporte(db, m.chave).total }; }), [db, off]);
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
  const manut = (db.pessoal ? db.pessoal.lanc : []).filter(l => l.cat === "transporte" && ["manutencao", "melhorias"].includes(subDe(l))).sort((a, b) => b.data.localeCompare(a.data));
  const manutAno = manut.filter(l => l.data.startsWith(hoje.slice(0, 4))).reduce((s, l) => s + l.valor, 0);
  const subsMes = SUBS.filter(s => g.porSub[s.id]).sort((a, b) => g.porSub[b.id].total - g.porSub[a.id].total);
  const lista = g.itens.filter(i => !filtro || i.sub === filtro);
  const delta = ant.total > 0 ? (g.total - ant.total) / ant.total : null;
  const nome = (v && v.nome) || (v && v.fipe && v.fipe.modelo) || (v && v.tipo === "nenhum" ? "Apps e transporte público" : "Seu veículo");

  return (
    <div className="page transp">
      <TopBar eyebrow={nome} title="Transporte" act={act} tema={tema}
        extra={<button className="icon-btn" onClick={() => act.abrirVeiculo()} aria-label="Editar o veículo"><I.pencil /></button>} />
      <div className="cols">
        <div className="col">

        <section className="transp-hero">
          <div className="transp-palco"><i className="transp-luz" aria-hidden="true" /><FotoVeiculo v={v} grande /><i className="transp-chao" aria-hidden="true" /></div>
          <h2>{nome}</h2>
          <div className="transp-chips">
            {v && v.combustivel && temCarro && <span>{(COMBUSTIVEIS.find(c => c[0] === v.combustivel) || [, ""])[1]}</span>}
            {comb.consumo && <span>{kml(comb.consumo)} km/l{comb.consumoReal ? "" : " (informado)"}</span>}
            {km && <span>{km.toLocaleString("pt-BR")} km</span>}
            {v && v.fipe && v.fipe.valor && <span>FIPE {v.fipe.valor}</span>}
          </div>
          {!v && <button className="btn ghost transp-escolher" onClick={() => act.abrirVeiculo()}><I.car /> Escolher o meu veículo</button>}
        </section>

        <section className="transp-card transp-mes">
          <div className="transp-mes-nav">
            <button className="icon-btn" onClick={() => { setOff(off - 1); setFiltro(null); }} aria-label="Mês anterior"><I.chevL /></button>
            <span>{mes.nome.charAt(0).toUpperCase() + mes.nome.slice(1)} de {mes.ano}</span>
            <button className="icon-btn" onClick={() => { setOff(off + 1); setFiltro(null); }} aria-label="Próximo mês" disabled={off >= 0}><I.chev /></button>
          </div>
          <div className="transp-total"><Money v={g.total} /></div>
          <small className="transp-sub">em transporte{delta != null ? ` · ${delta >= 0 ? "+" : "−"}${Math.abs(Math.round(delta * 100))}% que ${mesDe(off - 1).nome}` : ""}</small>
          <div className="transp-barras" aria-label="Últimos 6 meses">
            {seis.map((s, i) => (
              <div key={s.chave} className={i === 5 ? "on" : ""}>
                <i style={{ height: `${Math.max(4, s.total / maior * 100)}%` }} title={brlReal(s.total)} />
                <small>{s.nome.slice(0, 3)}</small>
              </div>
            ))}
          </div>
        </section>

        <div className="transp-acoes">
          {temCarro && <button onClick={() => act.abrirGastoTransp({ sub: "combustivel" })}><span className="ic" style={{ "--c": subInfo("combustivel").cor }}><Ic.combustivel /></span>Abastecer</button>}
          {temCarro && <button onClick={() => act.abrirGastoTransp({ sub: "manutencao" })}><span className="ic" style={{ "--c": subInfo("manutencao").cor }}><Ic.manutencao /></span>Manutenção</button>}
          <button onClick={() => act.abrirGastoTransp({ sub: temCarro ? "estacionamento" : "app" })}><span className="ic" style={{ "--c": "var(--mode)" }}><I.plus /></span>Outro gasto</button>
        </div>

        {subsMes.length > 0 && (
          <section className="transp-grade" aria-label="Para onde foi o dinheiro">
            {subsMes.map(s => (
              <button key={s.id} className={"transp-sub-card" + (filtro === s.id ? " on" : "")} style={{ "--c": s.cor }} onClick={() => setFiltro(filtro === s.id ? null : s.id)}>
                <span className="ic"><IconeSub id={s.id} /></span>
                <span className="tx"><small>{s.nome}</small><b><Money v={g.porSub[s.id].total} /></b><small>{g.porSub[s.id].n} {g.porSub[s.id].n === 1 ? "gasto" : "gastos"} · {Math.round(g.porSub[s.id].total / (g.total || 1) * 100)}%</small></span>
              </button>
            ))}
          </section>
        )}

        </div>
        <div className="col">
        {temCarro && (
          <section className="transp-card">
            <div className="transp-card-cab"><span className="ic" style={{ "--c": subInfo("combustivel").cor }}><Ic.combustivel /></span><h3>Combustível</h3></div>
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
          </section>
        )}

        {temCarro && (
          <section className="transp-card">
            <div className="transp-card-cab"><span className="ic" style={{ "--c": subInfo("manutencao").cor }}><Ic.manutencao /></span><h3>Manutenção</h3>{manutAno > 0 && <small>{brl(manutAno)} em {hoje.slice(0, 4)}</small>}</div>
            {oleo ? (
              <div className={"transp-oleo" + (oleo.urgente ? " urgente" : "")}>
                <b>Próxima troca de óleo</b>
                <span>{oleo.faltamKm != null ? (oleo.faltamKm > 0 ? `em ${oleo.faltamKm.toLocaleString("pt-BR")} km` : `passou ${Math.abs(oleo.faltamKm).toLocaleString("pt-BR")} km`) + " ou " : ""}{oleo.faltamDias >= 0 ? `até ${dataCurta(oleo.ate)}` : `venceu em ${dataCurta(oleo.ate)}`}</span>
              </div>
            ) : <p className="hint">Anote a última troca de óleo (em Manutenção) e eu aviso quando chegar a próxima.</p>}
            {manut.slice(0, 4).map(l => (
              <button key={l.id} className="transp-item" onClick={() => act.abrirGastoTransp({ inicial: l })}>
                <span className="ic" style={{ "--c": subInfo(subDe(l)).cor }}><IconeSub id={subDe(l)} /></span>
                <span className="mid"><b>{l.desc || subInfo(subDe(l)).nome}</b><small>{relativo(l.data)}{l.km ? ` · ${l.km.toLocaleString("pt-BR")} km` : ""}</small></span>
                <span className="amt">−<Money v={l.valor} /></span>
              </button>
            ))}
          </section>
        )}

        {temCarro && (
          <section className="transp-card">
            <div className="transp-card-cab"><span className="ic" style={{ "--c": "var(--mode)" }}><Ic.rota /></span><h3>Quanto custa a viagem?</h3></div>
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
          {lista.map(l => (
            <button key={l.id} className="transp-item" disabled={l.conta} onClick={() => !l.conta && act.abrirGastoTransp({ inicial: l })}>
              <span className="ic" style={{ "--c": subInfo(l.sub).cor }}><IconeSub id={l.sub} /></span>
              <span className="mid"><b>{l.desc || subInfo(l.sub).nome}</b><small>{subInfo(l.sub).nome} · {relativo(l.data).toLowerCase()}{l.litros ? ` · ${fmtNum(l.litros)} L` : ""}{l.conta ? " · conta fixa" : ""}</small></span>
              <span className="amt">−<Money v={l.valor} /></span>
            </button>
          ))}
          <button className="link transp-teto" onClick={() => act.abrirTeto("transporte")}><I.gauge /> Teto de gastos com transporte</button>
        </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Abastecer, manutenção e outros gastos ---------- */
export function GastoTransporteSheet({ sub0, inicial, veiculo, precos, onSave, onDelete, onClose }) {
  const [sub, setSub] = useState(inicial ? subDe(inicial) : sub0 || "combustivel");
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [litros, setLitros] = useState(inicial && inicial.litros ? fmtNum(inicial.litros) : "");
  const [precoL, setPrecoL] = useState(inicial && inicial.precoLitro ? fmtNum(inicial.precoLitro) : "");
  const comb0 = inicial && inicial.combustivel ? inicial.combustivel : veiculo && ["gasolina", "etanol", "diesel", "gnv"].includes(veiculo.combustivel) ? veiculo.combustivel : "gasolina";
  const [combustivel, setCombustivel] = useState(comb0);
  const [km, setKm] = useState(inicial && inicial.km ? String(inicial.km) : "");
  const [manut, setManut] = useState(inicial && inicial.manut ? inicial.manut : "revisao");
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
      ...(inicial || {}), id: inicial ? inicial.id : uid(), tipo: "saida", cat: "transporte", valor: v, data, sub,
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
export function VeiculoSheet({ veiculo, db, onSave, onClose }) {
  const km0 = kmAtual(db, veiculo);
  const v0 = veiculo || {};
  const [tipo, setTipo] = useState(v0.tipo || "carro");
  const [foto, setFoto] = useState(v0.foto || "sedan");
  const [nome, setNome] = useState(v0.nome || "");
  const [combustivel, setCombustivel] = useState(v0.combustivel || "flex");
  const [consumo, setConsumo] = useState(v0.consumo ? fmtNum(v0.consumo) : "");
  const [km, setKm] = useState(v0.km ? String(v0.km) : km0 ? String(km0) : "");
  const [oleoKm, setOleoKm] = useState(v0.oleoKm || 10000);
  const [oleoMeses, setOleoMeses] = useState(v0.oleoMeses || 12);
  const [fipeV, setFipeV] = useState(v0.fipe || null);
  const [erro, setErro] = useState("");
  const arq = useRef(null);
  const escolherFoto = async e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { setFoto(await fotoDoCarro(f)); setErro(""); } catch (x) { setErro("Não consegui abrir essa foto."); } };
  const veiculoTela = { tipo, foto };
  const temMotor = tipo === "carro" || tipo === "moto";
  return (
    <Sheet title={veiculo ? "Seu veículo" : "Escolha o seu veículo"} sub="Fica só com você, para deixar a tela com a sua cara." onClose={onClose}>
      <div className="transp-palco mini"><FotoVeiculo v={veiculoTela} grande /><i className="transp-chao" aria-hidden="true" /></div>
      <Seg value={tipo} onChange={t => { setTipo(t); if (t !== "carro" && !String(foto).startsWith("data:")) setFoto(t === "carro" ? "sedan" : ""); }} options={[{ v: "carro", l: "Carro" }, { v: "moto", l: "Moto" }, { v: "bike", l: "Bike" }, { v: "nenhum", l: "Sem veículo" }]} />
      <div className="transp-fotos" role="radiogroup" aria-label="Foto do veículo">
        {tipo === "carro" && FOTOS.map(([k, n, arquivo]) => (
          <button key={k} type="button" role="radio" aria-checked={foto === k} className={foto === k ? "on" : ""} onClick={() => setFoto(k)}><Ilustra n={arquivo} /><small>{n}</small></button>
        ))}
        {tipo !== "carro" && tipo !== "nenhum" && <button type="button" role="radio" aria-checked={!String(foto).startsWith("data:")} className={!String(foto).startsWith("data:") ? "on" : ""} onClick={() => setFoto("")}><span className="emoji">{EMOJI[tipo]}</span><small>Ícone</small></button>}
        {tipo !== "nenhum" && <button type="button" role="radio" aria-checked={String(foto).startsWith("data:")} className={String(foto).startsWith("data:") ? "on" : ""} onClick={() => arq.current && arq.current.click()}>
          {String(foto).startsWith("data:") ? <img src={foto} alt="" /> : <span className="emoji"><I.camera /></span>}<small>Foto minha</small>
        </button>}
        <input ref={arq} type="file" accept="image/*" hidden onChange={escolherFoto} />
      </div>
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
        <BuscaFipe tipo={tipo === "moto" ? "motos" : "carros"} valor={fipeV} onEscolher={f => { setFipeV(f); if (!nome.trim() && f) setNome(f.modelo.split(" ").slice(0, 2).join(" ")); if (f && /alcool|etanol|flex/i.test(f.combustivel || "") && combustivel === "flex") setCombustivel(/flex/i.test(f.combustivel) ? "flex" : "etanol"); }} />
      </>}
      <button className="btn mode" onClick={() => onSave({ tipo, foto: tipo === "nenhum" ? "" : foto, nome: nome.trim(), combustivel: temMotor ? combustivel : "", consumo: num(consumo) || null, km: num(km) || null, oleoKm, oleoMeses, fipe: temMotor ? fipeV : null })}><I.check /> Salvar</button>
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
  const escolherAno = id => { if (!id) return; setSt("carregando"); fipe.valor(tipo, marca, modelo, id).then(r => { onEscolher({ marca: r.Marca, modelo: r.Modelo, ano: r.AnoModelo === 32000 ? "Zero km" : r.AnoModelo, combustivel: r.Combustivel, valor: r.Valor, mes: r.MesReferencia, codigo: r.CodigoFipe }); setSt(""); setAberto(false); vibrar("ok"); }).catch(() => setSt("erro")); };
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
