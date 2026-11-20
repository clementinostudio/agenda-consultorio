// Parte do app carregada sob demanda: aba "Transporte" do modo Pessoal (também abre ao tocar em Transporte, em Gastos).
// A tela segue a ordem do Transporte nativo do app (app-celular/src/app/transporte.tsx): o veículo com os números dele,
// as ações rápidas, o gasto do mês, os próximos cuidados, o combustível, quanto o veículo custa de verdade, a viagem,
// os gastos do mês e os ajustes. No celular, uma coluna só; no computador, duas (src/transporte.css).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { I, Sheet, Field, Seg, Toggle, Money, brl, brlReal, num, soNumero, fmtNum, uid, todayISO, MES_LONGO, pad, dm, relativo, vibrar, Ilustra, lerArquivo, servidorAvisos, ConfirmButton, TopBar, ProximaConquista, ESCONDER } from "../App.jsx";
import { veiculosDe, lancTransp, SUBS, subInfo, subDe, MANUTENCOES, FOTOS, FOTO_MOTO, NOME_CARROCERIA, carroceria, fotoDoVeiculo, COMBUSTIVEIS, gastosTransporte, estatisticasCombustivel, kmAtual, proximaTrocaOleo, proximoRodizio, DOCS_VEICULO, docsVeiculo, umAnoDepois, custoReal, valorFipe, postos, carroOuApp, precosCombustivel, etanolOuGasolina, fipe, ufDaCidade, montarGastoTransp, fipeDoMes } from "../transporte.js";
import { useContagem } from "./visual.jsx";
import { AcoesAzuis, ListaAcoes } from "../blocos.jsx";
import { PostoBaratoSheet } from "./postos.jsx";
import { combDoVeiculo } from "../postos.js";
import { noApp, chamarApp } from "../app-nativo.js";
import { createPortal } from "react-dom";
import "../transporte.css";

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
  oleo: () => <Svg><path d="M12 3.5s-5.5 6.1-5.5 10.2a5.5 5.5 0 0 0 11 0C17.5 9.6 12 3.5 12 3.5z" /><path d="M9.6 14.2a2.5 2.5 0 0 0 2.4 2.3" /></Svg>,
  pneu: () => <Svg><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5" /></Svg>,
  local: () => <Svg><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></Svg>,
  desce: () => <Svg><path d="M4 7l6.5 6.5 3.5-3.5L20 16" /><path d="M20 11v5h-5" /></Svg>,
};
const IconeSub = ({ id }) => { const C = Ic[id] || Ic.outros; return <C />; };
const EMOJI = { moto: "🏍️", bike: "🚲", nenhum: "🚌" };

const preco = v => (v > 0 ? `R$ ${v.toFixed(2).replace(".", ",")}` : "—");
const kml = c => (Math.round(c * 10) / 10).toLocaleString("pt-BR");
// data com o ano quando não é o ano de agora ("27/10/2027")
const dataCurta = iso => iso.slice(0, 4) === todayISO().slice(0, 4) ? dm(iso) : `${dm(iso)}/${iso.slice(0, 4)}`;
const mesDe = off => { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth() + off, 1); return { chave: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, nome: MES_LONGO[m.getMonth()], ano: m.getFullYear() }; };
// valores que somem com o olho fechado (como o brl, mas com os centavos de "por km")
const real = v => (ESCONDER ? "R$ ••" : brlReal(v));
const inteiro = v => (ESCONDER ? "R$ •••" : `R$ ${Math.round(v).toLocaleString("pt-BR")}`);
const litrosTx = l => `${(Math.round(l * 10) / 10).toLocaleString("pt-BR")} L`;
const fmtKm = k => Math.round(Math.abs(k)).toLocaleString("pt-BR");
const nDias = n => `${n} ${n === 1 ? "dia" : "dias"}`;
const pct = (a, b) => Math.round(a / (b || 1) * 100);
const temMotor = v => !v || v.tipo === "carro" || v.tipo === "moto";
const nomeDo = v => (v && v.nome) || (v && v.fipe && v.fipe.modelo) || (v && v.tipo === "nenhum" ? "Apps e transporte público" : "Seu veículo");
const nomeChip = v => (v.tipo === "nenhum" && (!v.nome || v.nome === "Apps e transporte público") ? "Apps e ônibus" : v.nome || "Veículo");
const TIPO_NOME = { carro: "Carro", moto: "Moto", bike: "Bike" };
// os tipos de gasto com um nome que cabe num filtro ou numa legenda
const CURTO = { app: "Apps", estacionamento: "Estacionamento", documentos: "Documentos", melhorias: "Peças" };
const nomeCurto = id => CURTO[id] || subInfo(id).nome;

function FotoVeiculo({ v, grande }) {
  const cls = "transp-foto" + (grande ? " grande" : "");
  if (v && v.foto && v.foto.startsWith("data:")) return <img className={cls + " propria"} src={v.foto} alt="Seu veículo" />;
  const f = fotoDoVeiculo(v);
  if (f) return <Ilustra n={f[2]} className={cls + " f-" + f[0]} alt={f[1]} />;
  return <span className={cls + " emoji"} aria-hidden="true">{EMOJI[v.tipo] || "🚗"}</span>;
}

/* ---------- O veículo: os chips para trocar, o desenho (arrastar para o lado troca), o nome e os números ---------- */
function Veiculo({ vs, v, comb, km, doMes, noAno, onTrocar, act }) {
  const toque = useRef(null);
  if (!v) return (
    <section className="tr-veic tr-heroi vazio">
      <div className="transp-palco tr-palco"><i className="transp-luz" aria-hidden="true" /><FotoVeiculo v={null} grande /><i className="transp-chao" aria-hidden="true" /></div>
      <h2>Escolha o seu veículo</h2>
      <p className="tr-veic-tx">Carro, moto, bike ou só apps e ônibus: eu acompanho o consumo, lembro da troca de óleo e do IPVA e mostro quanto ele custa de verdade.</p>
      <button className="btn tr-escolher" onClick={() => act.abrirVeiculo("novo")}><I.car /> Escolher o meu veículo</button>
    </section>
  );
  const i = vs.findIndex(x => x.id === v.id);
  const ir = d => { const n = vs[i + d]; if (n) { vibrar("toque"); onTrocar(n.id); } };
  const motor = v.tipo === "carro" || v.tipo === "moto";
  const f = v.fipe;
  const sub = v.tipo === "nenhum" ? "Sem veículo próprio" : [TIPO_NOME[v.tipo], motor && v.combustivel && (COMBUSTIVEIS.find(c => c[0] === v.combustivel) || [, ""])[1], f && f.ano].filter(Boolean).join(" · ");
  let nums = [];
  if (motor) nums = [
    km ? { v: fmtKm(km), u: "km", r: "no painel" } : { v: "—", r: "km no painel" },
    comb.consumo ? { v: kml(comb.consumo), u: "km/l", r: comb.consumoReal ? "consumo real" : "consumo informado" } : { v: "—", r: "consumo" },
    comb.custoKm ? { v: real(comb.custoKm), r: "combustível/km" } : null,
  ];
  else if (v.tipo === "nenhum") {
    const corr = doMes.itens.filter(x => x.sub === "app"), bus = doMes.itens.filter(x => x.sub === "publico");
    nums = [
      { v: String(corr.length), r: corr.length === 1 ? "corrida no mês" : "corridas no mês" },
      corr.length ? { v: real(corr.reduce((s, x) => s + x.valor, 0) / corr.length), r: "por corrida" } : null,
      { v: String(bus.length), r: bus.length === 1 ? "ônibus ou metrô" : "ônibus e metrô" },
    ];
  } else nums = [{ v: brl(doMes.total), r: "no mês" }, { v: brl(noAno), r: `em ${todayISO().slice(0, 4)}` }];
  nums = nums.filter(Boolean);
  return (
    <section className="tr-veic tr-heroi">
      {vs.length > 1 && (
        <div className="tr-chips" role="tablist" aria-label="Seus veículos">
          {vs.map(x => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === v.id} className={"tr-chip" + (x.id === v.id ? " on" : "")} onClick={() => { if (x.id !== v.id) { vibrar("toque"); onTrocar(x.id); } }}>
              <FotoVeiculo v={x} />{nomeChip(x)}
            </button>
          ))}
          <button type="button" className="tr-chip mais" onClick={() => act.abrirVeiculo("novo")}><I.plus />Adicionar</button>
        </div>
      )}
      <div key={v.id} className="transp-palco tr-palco"
        onTouchStart={e => { const t = e.touches[0]; toque.current = [t.clientX, t.clientY]; }}
        onTouchEnd={e => {
          const s = toque.current; toque.current = null;
          if (!s || vs.length < 2) return;
          const t = e.changedTouches[0], dx = t.clientX - s[0], dy = t.clientY - s[1];
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(dx < 0 ? 1 : -1);
        }}>
        <i className="transp-luz" aria-hidden="true" /><FotoVeiculo v={v} grande /><i className="transp-chao" aria-hidden="true" />
      </div>
      <h2 className={nomeDo(v).length > 18 ? "longo" : ""}>{nomeDo(v)}</h2>
      {(sub || (f && f.valor)) && (
        <div className="tr-veic-sub">
          {sub && <span>{sub}</span>}
          {f && f.valor && <span className="tr-fipe">{ESCONDER ? "FIPE R$ •••" : `FIPE ${f.valor.replace(/,00$/, "")}`}</span>}
        </div>
      )}
      {nums.length > 0 && (
        <div className="tr-nums">
          {nums.map(n => <div key={n.r}><b>{n.v}{n.u && <small>{n.u}</small>}</b><small>{n.r}</small></div>)}
        </div>
      )}
    </section>
  );
}

/* ---------- As ações rápidas, nos botões azuis do visual novo (src/blocos.jsx) ---------- */
function Acoes({ v, act, onPosto }) {
  const id = v && v.id, tipo = v ? v.tipo : "carro";
  const gasto = sub => () => act.abrirGastoTransp({ sub, veiculoId: id });
  const item = (l, ic, f) => ({ id: l, l, ic, f });
  const lista = tipo === "nenhum" ? [
    item("Corrida de app", Ic.app, gasto("app")),
    item("Ônibus e metrô", Ic.publico, gasto("publico")),
    item("Outro gasto", I.plus, gasto("outros")),
  ] : tipo === "bike" ? [
    item("Manutenção", Ic.manutencao, gasto("manutencao")),
    item("Outro gasto", I.plus, gasto("outros")),
  ] : [
    item("Abastecer", Ic.combustivel, gasto("combustivel")),
    item("Manutenção", Ic.manutencao, gasto("manutencao")),
    item("Posto mais barato", Ic.local, onPosto),
    item("Estacionar e outros", I.plus, gasto("estacionamento")),
  ];
  return <AcoesAzuis itens={lista} className="tr-az-acoes" />;
}

/* ---------- O gasto do mês: o número grande, a comparação, os 6 meses e a divisão por tipo ---------- */
function CartaoMes({ g, antes, antTotal, mes, off, mudarMes, seis, hojeDia }) {
  const val = useContagem(g.total);
  const atual = off === 0, nomeAnt = mesDe(off - 1).nome;
  const ate = atual ? ` até o dia ${hojeDia}` : "";
  const d = g.total - antes;
  const maior = Math.max(...seis.map(s => s.total), 1);
  const partes = SUBS.filter(s => g.porSub[s.id]).sort((a, b) => g.porSub[b.id].total - g.porSub[a.id].total);
  return (
    <section className="tr-cartao tr-mes">
      <div className="tr-cab">
        <span>{atual ? "Gasto no mês" : `Gasto em ${mes.nome}`}{mes.ano !== new Date().getFullYear() ? ` de ${mes.ano}` : ""}</span>
        <span className="tr-nav">
          <button type="button" onClick={() => mudarMes(off - 1)} aria-label="Mês anterior"><I.chevL /></button>
          <button type="button" onClick={() => mudarMes(off + 1)} aria-label="Próximo mês" disabled={atual}><I.chev /></button>
        </span>
      </div>
      <div className="tr-valor"><Money v={val} /></div>
      {!(antTotal > 0)
        ? <p className="tr-comp">{g.total > 0 ? `Nada em ${nomeAnt} para comparar` : atual ? "Nada anotado neste mês ainda" : `Nada anotado em ${mes.nome}`}</p>
        : !(antes > 0) ? <p className="tr-comp">Em {nomeAnt}, nada até o dia {hojeDia}</p>
        : Math.abs(d) < 1 ? <p className="tr-comp">Igual a {nomeAnt}{ate}</p>
          : <p className={"tr-comp " + (d > 0 ? "sobe" : "desce")}><i aria-hidden="true">{d > 0 ? "↑" : "↓"}</i><span>{brl(Math.abs(d))} {d > 0 ? "a mais" : "a menos"} que {nomeAnt}{ate}</span></p>}
      {seis.some(s => s.total > 0) && <div className="tr-barras" role="group" aria-label="Últimos 6 meses">
        {seis.map((s, i) => (
          <button key={s.chave} type="button" className={i === 5 ? "on" : ""} onClick={() => { if (i < 5) { mudarMes(off - (5 - i)); vibrar("toque"); } }} aria-pressed={i === 5} aria-label={`${s.nome}: ${brl(s.total)}`} style={{ "--i": i }}>
            {i === 5 && s.total > 0 && <small>{inteiro(s.total)}</small>}
            <i style={{ height: Math.max(4, Math.round(s.total / maior * 84)) }} />
            <span>{s.nome.slice(0, 3)}</span>
          </button>
        ))}
      </div>}
      {partes.length > 0 && <>
        <div className="tr-seg" aria-hidden="true">{partes.map(s => <i key={s.id} style={{ flex: `${g.porSub[s.id].total} 1 0px`, background: s.cor }} />)}</div>
        <div className="tr-leg">
          {partes.map(s => { const x = g.porSub[s.id]; return (
            <div key={s.id} className="tr-leg-l" style={{ "--c": s.cor }}>
              <i aria-hidden="true" /><span>{s.nome}</span><small>{pct(x.total, g.total)}%</small><b>{brl(x.total)}</b>
            </div>
          ); })}
        </div>
      </>}
    </section>
  );
}

/* ---------- Próximos cuidados: troca de óleo, rodízio e documentos, do mais urgente ao mais longe ---------- */
function Cuidados({ v, oleo, rodizio, docs, act, pagarDoc }) {
  const itens = [];
  const ORDEM = { atrasado: 0, perto: 1, ok: 2, sem: 3 };
  const lembrete = (x, id, nome, cor, ic, cadaKm, cadaMeses, manut) => {
    const st = (x.faltamKm != null && x.faltamKm < 0) || x.faltamDias < 0 ? "atrasado" : x.urgente ? "perto" : "ok";
    const prazo = x.faltamKm != null ? (x.faltamKm >= 0 ? `em ${fmtKm(x.faltamKm)} km` : `passou ${fmtKm(x.faltamKm)} km`)
      : x.faltamDias < 0 ? "atrasado" : x.faltamDias <= 60 ? `em ${nDias(x.faltamDias)}` : `até ${dataCurta(x.ate)}`;
    const detalhe = x.faltamDias < 0 ? `O prazo era ${dataCurta(x.ate)}` : x.proxKm ? `Aos ${fmtKm(x.proxKm)} km ou até ${dataCurta(x.ate)}` : `Até ${dataCurta(x.ate)}`;
    const pk = x.faltamKm != null ? 1 - x.faltamKm / cadaKm : 0, pd = 1 - x.faltamDias / (cadaMeses * 30.4);
    itens.push({
      id, nome, ic, st, prazo, detalhe, cor: st === "atrasado" ? "var(--rose)" : st === "perto" ? "var(--amber)" : cor,
      ultima: `Última: ${dataCurta(x.ultima.data)}${x.ultima.km ? ` · ${fmtKm(x.ultima.km)} km` : ""}`,
      prog: Math.max(0, Math.min(1, Math.max(pk, pd))), dias: x.faltamDias,
      acao: st !== "ok" ? { t: "Anotar", forte: true, f: () => act.abrirGastoTransp({ sub: "manutencao", manut, veiculoId: v.id }) } : null,
    });
  };
  if (oleo) lembrete(oleo, "oleo", "Troca de óleo", "#F59E0B", <Ic.oleo />, v.oleoKm || 10000, v.oleoMeses || 12, "oleo");
  if (rodizio) lembrete(rodizio, "rodizio", "Rodízio e alinhamento", "#8B5CF6", <Ic.pneu />, 10000, 12, "alinhamento");
  docs.forEach(d => {
    const st = d.dias < 0 ? "atrasado" : d.dias <= 15 ? "perto" : "ok";
    itens.push({
      id: d.k, nome: d.nome, ic: <Ic.documentos />, st, dias: d.dias, cor: st === "atrasado" ? "var(--rose)" : st === "perto" ? "var(--amber)" : "#64748B",
      prazo: d.dias < 0 ? `venceu há ${nDias(-d.dias)}` : d.dias === 0 ? "vence hoje" : d.dias <= 60 ? `em ${nDias(d.dias)}` : dataCurta(d.data),
      detalhe: `Vence em ${dataCurta(d.data)}${d.valor ? ` · ${brl(d.valor)}` : ""}`,
      acao: d.dias <= 60 ? { t: "Paguei", forte: st !== "ok", f: () => { vibrar("ok"); pagarDoc(d); } } : null,
    });
  });
  if (!oleo) itens.push({ id: "sem-oleo", nome: "Troca de óleo", ic: <Ic.oleo />, st: "sem", dias: 1e9, cor: "var(--muted)", detalhe: "Anote a última troca e eu aviso quando chegar a próxima.", acao: { t: "Anotar a última", f: () => act.abrirGastoTransp({ sub: "manutencao", manut: "oleo", veiculoId: v.id }) } });
  if (!rodizio) itens.push({ id: "sem-rodizio", nome: "Rodízio e alinhamento", ic: <Ic.pneu />, st: "sem", dias: 1e9, cor: "var(--muted)", detalhe: "A cada 10.000 km ou 12 meses (e calibre os pneus a cada 15 dias). Anote o último e eu lembro.", acao: { t: "Anotar o último", f: () => act.abrirGastoTransp({ sub: "manutencao", manut: "alinhamento", veiculoId: v.id }) } });
  itens.sort((a, b) => ORDEM[a.st] - ORDEM[b.st] || a.dias - b.dias);
  const alerta = itens.filter(k => k.st === "atrasado" || k.st === "perto").length;
  const faltam = DOCS_VEICULO.filter(([k]) => !docs.some(d => d.k === k)).map(x => x[1]);
  return (
    <section className="tr-cartao tr-cuidados">
      <div className="tr-cab"><span>Próximos cuidados</span>{alerta > 0 && <small className="tr-alerta">{alerta} {alerta === 1 ? "pede atenção" : "pedem atenção"}</small>}</div>
      <div className="tr-linhas">
        {itens.map(k => (
          <div key={k.id} className="tr-cuid">
            <span className="tr-ic" style={{ "--c": k.cor }}>{k.ic}</span>
            <div className="tr-cuid-tx">
              <div className="tr-cuid-topo"><b>{k.nome}</b>{k.prazo && <span className={"tr-pill " + k.st}>{k.st === "atrasado" && <I.alert />}{k.prazo}</span>}</div>
              <small>{k.detalhe}</small>
              {k.ultima && <small className="fraco">{k.ultima}</small>}
              {k.prog != null && <span className={"tr-prog " + k.st} aria-hidden="true"><i style={{ width: `${Math.max(4, k.prog * 100)}%` }} /></span>}
              {k.acao && <button type="button" className={"tr-btn" + (k.acao.forte ? " forte" : "")} onClick={k.acao.f}>{k.acao.t === "Paguei" && <I.check />}{k.acao.t}</button>}
            </div>
          </div>
        ))}
        {faltam.length > 0 && (
          <button type="button" className="tr-cuid tr-cuid-link" onClick={() => act.abrirVeiculo(v.id)}>
            <span className="tr-ic" style={{ "--c": "var(--muted)" }}><Ic.documentos /></span>
            <span className="tr-cuid-tx">
              <b>{docs.length ? `Colocar ${faltam.join(" e ")}` : "IPVA, licenciamento e seguro"}</b>
              <small>{docs.length ? "Coloque a data de vencimento e eu aviso antes." : "Coloque as datas de vencimento e eu aviso uma semana antes e no dia."}</small>
            </span>
            <I.chev />
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------- Combustível: o preço da semana na cidade (ANP), o que compensa, o último abastecimento e os postos ---------- */
function Combustivel({ anp, fonte: ref, perfil, v, comb, lista }) {
  const flex = !v || !v.combustivel || v.combustivel === "flex";
  const veredito = ref && flex ? etanolOuGasolina(ref.p) : null;
  const tipos = ref ? [["gasolina", "Gasolina"], ["etanol", "Etanol"], ["diesel", "Diesel S10"], ["gnv", "GNV (m³)"]]
    .filter(([k]) => ref.p[k] && (k !== "diesel" || (v && v.combustivel === "diesel")) && (k !== "gnv" || (v && v.combustivel === "gnv"))) : [];
  const ult = comb.ultimo, media = ult && ref ? ref.p[ult.combustivel || "gasolina"] : null;
  const dif = ult && media ? comb.precoPago - media : null;
  const ref0 = ref && ref.p[(v && v.combustivel !== "flex" && v.combustivel) || "gasolina"];
  const comPreco = lista.filter(p => p.preco), barato = comPreco.length > 1 ? comPreco.reduce((m, p) => (p.preco < m.preco ? p : m)) : null;
  return (
    <section className="tr-cartao tr-comb">
      <div className="tr-cab"><span>{ref ? (ref.onde === perfil.cidade ? `Combustível em ${ref.onde}` : `Combustível ${ref.onde}`) : "Combustível"}</span></div>
      {anp.st === "carregando" && <p className="tr-tx">Buscando o preço da semana na ANP…</p>}
      {anp.st === "sem-cidade" && <p className="tr-tx">Coloque a sua cidade em Perfil → Dados pessoais para ver o preço da semana.</p>}
      {anp.st === "erro" && <p className="tr-tx">Não consegui buscar o preço da ANP agora.</p>}
      {ref && <>
        <div className="tr-precos">
          {tipos.map(([k, n]) => { const melhor = veredito && k === veredito.veredito; return (
            <div key={k} className={"tr-preco" + (melhor ? " melhor" : "")}><small>{n}</small><b>{preco(ref.p[k])}</b>{melhor && <em>compensa</em>}</div>
          ); })}
        </div>
        <p className="tr-fonte">Preço médio da semana de {dm(anp.d.ini)} a {dm(anp.d.fim)}, pela ANP{anp.d.velho ? " · sem internet agora" : ""}</p>
        {veredito && (
          <div className={"tr-dica" + (veredito.veredito !== "tanto-faz" ? " bom" : "")}>
            <I.check />
            <span><b>{veredito.veredito === "etanol" ? "Etanol compensa." : veredito.veredito === "gasolina" ? "Gasolina compensa." : "Tanto faz."}</b> O etanol está custando {Math.round(veredito.razao * 100)}% da gasolina. Ele compensa abaixo de 70%, porque rende menos.</span>
          </div>
        )}
      </>}
      {(ult || lista.length > 0) && <div className="tr-div" />}
      {ult && (
        <div className="tr-item">
          <span className="tr-ic cheio" style={{ "--c": "#F59E0B" }}><Ic.combustivel /></span>
          <span className="mid">
            <b>Último abastecimento</b><small>{dataCurta(ult.data)} · {litrosTx(ult.litros)}{ult.km ? ` · ${fmtKm(ult.km)} km` : ""}</small>
            {dif != null && <small className={Math.abs(dif) < .02 ? "" : dif > 0 ? "ruim" : "bom"}>{Math.abs(dif) < .02 ? "Na média da semana" : `${dif > 0 ? "↑" : "↓"} ${preco(Math.abs(dif))} ${dif > 0 ? "acima" : "abaixo"} da média`}</small>}
          </span>
          <span className="dir"><b>{preco(comb.precoPago)}<small>/l</small></b></span>
        </div>
      )}
      {lista.length > 0 && <>
        <h4 className="tr-sub">Onde você abastece</h4>
        <div className="tr-linhas">
          {lista.slice(0, 3).map(p => (
            <div key={p.nome} className={"tr-item" + (barato === p ? " barato" : "")}>
              <span className="tr-ic" style={{ "--c": barato === p ? "var(--mint)" : "var(--muted)" }}><Ic.local /></span>
              <span className="mid"><b>{p.nome}</b><small>{p.n} {p.n === 1 ? "vez" : "vezes"} · {barato === p ? "o mais barato" : inteiro(p.gasto)}</small></span>
              {p.preco && <span className="dir"><b>{preco(p.preco)}<small>/l</small></b>{ref0 && <small className={p.preco <= ref0 ? "bom" : "ruim"}>{preco(Math.abs(ref0 - p.preco))} {p.preco <= ref0 ? "abaixo" : "acima"}</small>}</span>}
            </div>
          ))}
        </div>
      </>}
      {!comb.consumoReal
        ? <p className="tr-tx">Ao abastecer, anote os litros e a km do painel: com dois abastecimentos eu calculo o seu consumo real.</p>
        : !lista.length && <p className="tr-tx">Escreva o nome do posto ao abastecer e eu mostro onde sai mais barato.</p>}
    </section>
  );
}

/* ---------- Quanto o veículo custa de verdade, com o "carro ou app?" ---------- */
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
  const seu = v && v.tipo === "moto" ? "Sua moto" : "Seu carro";
  return (
    <div className="tr-bloco">
      <b className="tr-bloco-t">{v && v.tipo === "moto" ? "Moto ou app?" : "Carro ou app?"}</b>
      <p className="tr-tx">Uma corrida que você costuma fazer:</p>
      <div className="tr-app-in">
        <label className="tr-campo"><input inputMode="decimal" value={km} onChange={e => setKm(soNumero(e.target.value))} placeholder="10" aria-label="Distância da corrida em km" /><span>km</span></label>
        <label className="tr-campo"><span>R$</span><input inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="25,00" aria-label="Preço da corrida" /></label>
      </div>
      {c ? <>
        <div className="tr-vs">
          <div className={c.carroKm <= c.appKm ? "ganha" : ""}><small>{seu}</small><b>{real(c.carroKm)}</b><small>por km{c.comDesvalor ? ", com a desvalorização" : ""}</small></div>
          <div className={c.appKm < c.carroKm ? "ganha" : ""}><small>App</small><b>{real(c.appKm)}</b><small>por km</small></div>
        </div>
        <p className="tr-tx">{c.diferenca >= 0
          ? <>Rodando uns {Math.round(c.kmMes).toLocaleString("pt-BR")} km por mês, de app sairia <b>{brl(c.appMes)}</b>: {brl(c.diferenca)} a mais.</>
          : <>Rodando uns {Math.round(c.kmMes).toLocaleString("pt-BR")} km por mês, de app sairia <b>{brl(c.appMes)}</b>: <b>{brl(-c.diferenca)} a menos</b>. Vale pensar!</>}</p>
      </> : <p className="tr-tx">Coloque uma corrida que você costuma fazer (veja o preço no app de corrida) e eu comparo.</p>}
    </div>
  );
}
function CustoReal({ custo, v, act }) {
  const partes = SUBS.filter(s => custo.porSub[s.id]);
  const periodo = custo.nMeses === 1 ? "nos últimos 30 dias" : `nos últimos ${custo.nMeses} meses`;
  return (
    <section className="tr-cartao tr-custo">
      <div className="tr-cab"><span>Quanto {v.tipo === "moto" ? "a moto" : "o carro"} custa de verdade</span></div>
      <div className="tr-custo-v"><span className="tr-valor"><Money v={custo.porMes} /></span><span>por mês, {periodo}</span></div>
      <div className="tr-trio">
        <div><b>{real(custo.porDia)}</b><small>por dia</small></div>
        <div><b>{custo.porKm ? real(custo.porKm) : "—"}</b><small>por km</small></div>
        <div><b>{inteiro(custo.total)}</b><small>no total</small></div>
      </div>
      <div className="tr-seg" aria-hidden="true">{partes.map(s => <i key={s.id} style={{ flex: `${custo.porSub[s.id]} 1 0px`, background: s.cor }} />)}</div>
      <div className="tr-leg-mini">{partes.map(s => <span key={s.id}><i style={{ background: s.cor }} />{nomeCurto(s.id)} {pct(custo.porSub[s.id], custo.total)}%</span>)}</div>
      {custo.perdeu && (
        <div className="tr-dica">
          <Ic.desce />
          <span>Pela FIPE, perdeu <b>{brl(custo.perdeu.valor)}</b> de valor desde {MES_LONGO[Number(custo.perdeu.desde.slice(5)) - 1]} de {custo.perdeu.desde.slice(0, 4)}. Isso também é custo, só que invisível.</span>
        </div>
      )}
      {custo.porKm
        ? <CarroOuApp custo={custo} v={v} act={act} />
        : <p className="tr-tx">Anotando a km do painel ao abastecer, eu mostro o custo de cada km rodado (e comparo com uma corrida de app).</p>}
    </section>
  );
}

/* ---------- Quanto custa a viagem ---------- */
function Viagem({ comb, precoRef }) {
  const [kmViagem, setKmViagem] = useState("");
  const [idaVolta, setIdaVolta] = useState(true);
  const kmTotal = num(kmViagem) * (idaVolta ? 2 : 1), litros = comb.consumo ? kmTotal / comb.consumo : 0;
  return (
    <section className="tr-cartao tr-viagem">
      <div className="tr-cab"><span>Quanto custa a viagem?</span></div>
      <div className="tr-viagem-in">
        <label className="tr-campo"><input inputMode="decimal" value={kmViagem} onChange={e => setKmViagem(soNumero(e.target.value))} placeholder="Distância" aria-label="Distância da viagem em km" /><span>km</span></label>
        <Toggle on={idaVolta} onClick={() => setIdaVolta(!idaVolta)}>Ida e volta</Toggle>
      </div>
      {kmTotal > 0 ? (comb.consumo && precoRef
        ? <div className="tr-res"><b>{real(litros * precoRef)}</b><span>{fmtNum(Math.round(litros * 10) / 10)} litros para {kmTotal.toLocaleString("pt-BR")} km · {kml(comb.consumo)} km/l a {preco(precoRef)}</span></div>
        : <p className="tr-tx">Para calcular, informe o consumo do veículo (no lápis, lá em cima) ou anote dois abastecimentos.</p>)
        : <p className="tr-tx">Coloque a distância e eu calculo quanto vai de combustível.</p>}
    </section>
  );
}

/* ---------- Os gastos do mês, com o filtro por tipo ---------- */
function GastosDoMes({ g, mes, off, filtro, setFiltro, act }) {
  const subs = SUBS.filter(s => g.porSub[s.id]).sort((a, b) => g.porSub[b.id].total - g.porSub[a.id].total);
  const lista = g.itens.filter(i => !filtro || i.sub === filtro);
  const n = g.itens.length;
  return (
    <section className="tr-cartao tr-gastos">
      <div className="tr-cab"><span>{off === 0 ? "Gastos do mês" : `Gastos de ${mes.nome}`}</span>{n > 0 && <small>{n} {n === 1 ? "gasto" : "gastos"}</small>}</div>
      {subs.length > 1 && (
        <div className="tr-filtros" role="group" aria-label="Filtrar por tipo">
          <button type="button" className={"tr-filtro" + (!filtro ? " on" : "")} aria-pressed={!filtro} onClick={() => setFiltro(null)}>Tudo</button>
          {subs.map(s => (
            <button key={s.id} type="button" className={"tr-filtro" + (filtro === s.id ? " on" : "")} aria-pressed={filtro === s.id} style={{ "--c": s.cor }} onClick={() => { setFiltro(filtro === s.id ? null : s.id); vibrar("toque"); }}>
              <i aria-hidden="true" />{nomeCurto(s.id)}
            </button>
          ))}
        </div>
      )}
      {lista.length === 0 && <p className="tr-vazio">{filtro ? "Nada deste tipo no mês." : off === 0 ? "Nenhum gasto com transporte neste mês ainda." : `Nenhum gasto com transporte em ${mes.nome}.`}</p>}
      {lista.length > 0 && (
        <div className="tr-linhas">
          {lista.map((l, i) => (
            <React.Fragment key={l.id}>
              {(i === 0 || lista[i - 1].data !== l.data) && <div className="day-sep">{relativo(l.data)}</div>}
              <button type="button" className="tr-item" disabled={l.conta} onClick={() => !l.conta && act.abrirGastoTransp({ inicial: l })}>
                <span className="tr-ic cheio" style={{ "--c": subInfo(l.sub).cor }}><IconeSub id={l.sub} /></span>
                <span className="mid"><b>{l.desc || subInfo(l.sub).nome}</b><small>{subInfo(l.sub).nome}{l.litros ? ` · ${litrosTx(l.litros)}` : ""}{l.conta ? " · conta fixa" : ""}</small></span>
                <span className="dir"><b>−<Money v={l.valor} /></b></span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Ajustes: o veículo, outro veículo e o teto do mês ---------- */
function Ajustes({ v, act }) {
  const itens = [
    v && { id: "editar", l: `Editar ${nomeChip(v)}`, d: v.tipo === "nenhum" ? "Nome e tipo" : "Foto, consumo, Tabela FIPE e vencimentos", ic: I.pencil, f: () => act.abrirVeiculo(v.id) },
    { id: "novo", l: v ? "Adicionar outro veículo" : "Escolher o meu veículo", d: "Carro, moto, bike ou apps e ônibus", ic: I.plus, f: () => act.abrirVeiculo("novo") },
    { id: "teto", l: "Teto de gastos com transporte", d: "Um limite para o mês", ic: I.gauge, f: () => act.abrirTeto("transporte") },
  ].filter(Boolean);
  return <ListaAcoes titulo="Ajustes" itens={itens} className="tr-az-ajustes" />;
}

export function TransporteTab({ db, act, tema, perfil, atual, onTrocar }) {
  const vs = veiculosDe(db);
  const v = vs.find(x => x.id === atual) || vs[0] || null;
  const [off, setOff] = useState(0);
  const [filtro, setFiltro] = useState(null);
  const hoje = todayISO(), hojeDia = Number(hoje.slice(8, 10));
  const mes = mesDe(off), g = useMemo(() => gastosTransporte(db, mes.chave, v), [db, mes.chave, v]);
  const ant = useMemo(() => gastosTransporte(db, mesDe(off - 1).chave, v), [db, off, v]);
  // no mês de agora, compara com o mês passado até o mesmo dia (o mês inteiro contra 3 dias não diz nada)
  const antes = off === 0 ? ant.itens.filter(i => Number(i.data.slice(8, 10)) <= hojeDia).reduce((s, i) => s + i.valor, 0) : ant.total;
  const doMes = useMemo(() => (off === 0 ? g : gastosTransporte(db, mesDe(0).chave, v)), [db, off, g, v]);
  const seis = useMemo(() => [5, 4, 3, 2, 1, 0].map(k => { const m = mesDe(off - k); return { ...m, total: gastosTransporte(db, m.chave, v).total }; }), [db, off, v]);
  const noAno = useMemo(() => lancTransp(db, v).filter(l => l.tipo === "saida" && l.data.startsWith(hoje.slice(0, 4))).reduce((s, l) => s + l.valor, 0), [db, v, hoje]);
  const comb = useMemo(() => estatisticasCombustivel(db, v), [db, v]);
  const km = kmAtual(db, v);
  const oleo = proximaTrocaOleo(db, v, hoje), rodizio = proximoRodizio(db, v, hoje), docs = docsVeiculo(v, hoje);
  const temCarro = !!v && temMotor(v); // sem veículo escolhido, a tela fica só com o essencial
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
  const flex = !v || !v.combustivel || v.combustivel === "flex";
  const veredito = ref && flex ? etanolOuGasolina(ref.p) : null;
  const precoRef = comb.precoPago || (ref && (v && v.combustivel === "etanol" ? ref.p.etanol : v && v.combustivel === "diesel" ? ref.p.diesel : ref.p.gasolina)) || null;
  const custo = useMemo(() => (temCarro && v ? custoReal(db, v, hoje) : null), [db, v, hoje]);
  const listaPostos = useMemo(() => (temCarro ? postos(db, v) : []), [db, v]);
  // FIPE do mês: uma vez por mês busca o valor de novo e guarda o histórico (mostra quanto o carro desvalorizou)
  useEffect(() => {
    fipeDoMes(v, hoje.slice(0, 7)).then(mud => { if (mud) act.atualizarVeiculo(v.id, mud); }).catch(() => {});
  }, [v && v.fipe && v.fipe.codigo, hoje.slice(0, 7)]);
  const pagarDoc = d => {
    act.salvarLanc({ id: uid(), veiculoId: v.id, tipo: "saida", cat: "transporte", sub: "documentos", valor: d.valor, data: hoje, desc: `${d.nome} ${d.data.slice(0, 4)}` });
    act.atualizarVeiculo(v.id, { docs: { ...(v.docs || {}), [d.k]: { ...(v.docs || {})[d.k], data: umAnoDepois(d.data) } } });
  };
  const mudarMes = n => { setOff(n); setFiltro(null); vibrar("toque"); };
  const trocar = id => { onTrocar(id); setOff(0); setFiltro(null); };
  const [postosAberto, setPostosAberto] = useState(false);
  const abrirPostos = () => {
    vibrar("toque");
    // no app de celular, abre a tela nativa do posto mais barato (app-celular/src/app/postos.tsx)
    if (!noApp) return setPostosAberto(true);
    const etanol = veredito && veredito.veredito === "etanol";
    chamarApp("abrir", { tela: "postos", comb: etanol ? "etanol" : combDoVeiculo(v), consumo: comb.consumo || 0 }).catch(() => setPostosAberto(true));
  };

  return (
    <div className="page transp tr">
      <TopBar eyebrow={vs.length > 1 ? `${vs.length} veículos` : "Pessoal"} title="Transporte" act={act} tema={tema}
        extra={<button className="icon-btn" onClick={() => act.abrirVeiculo(v ? v.id : "novo")} aria-label={v ? "Editar o veículo" : "Escolher o veículo"}><I.pencil /></button>} />
      <div className="cols">
        <div className="col">
          <Veiculo vs={vs} v={v} comb={comb} km={km} doMes={doMes} noAno={noAno} onTrocar={trocar} act={act} />
          <Acoes v={v} act={act} onPosto={abrirPostos} />
          <CartaoMes g={g} antes={antes} antTotal={ant.total} mes={mes} off={off} mudarMes={mudarMes} seis={seis} hojeDia={hojeDia} />
          <GastosDoMes g={g} mes={mes} off={off} filtro={filtro} setFiltro={setFiltro} act={act} />
          <Ajustes v={v} act={act} />
        </div>
        <div className="col">
          {temCarro && v && <Cuidados v={v} oleo={oleo} rodizio={rodizio} docs={docs} act={act} pagarDoc={pagarDoc} />}
          {temCarro && <Combustivel anp={anp} fonte={ref} perfil={perfil} v={v} comb={comb} lista={listaPostos} />}
          {custo && <CustoReal custo={custo} v={v} act={act} />}
          {temCarro && <Viagem comb={comb} precoRef={precoRef} />}
          <ProximaConquista act={act} trilhas={["estrada"]} />
        </div>
      </div>
      {postosAberto && createPortal(<PostoBaratoSheet veiculo={v} consumo={comb.consumo} sugerido={veredito && veredito.veredito === "etanol" ? "etanol" : undefined} onClose={() => setPostosAberto(false)} />, document.querySelector(".shell") || document.body)}
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
  // a montagem é a mesma do pedido do app de celular (montarGastoTransp, em transporte.js)
  const salvar = () => {
    onSave(montarGastoTransp({ id: uid(), veiculoId: vid, sub, valor: v, data, desc, litros: l, precoLitro: p, combustivel, km: num(km), manut }, inicial));
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
// Um bloco da página do veículo: número, título, explicação curta e o conteúdo num cartão (como no Perfil)
function Secao({ n, titulo, sub, children }) {
  return (
    <section className="vs-sec">
      <h3 className="vs-sec-t"><i aria-hidden="true">{n}</i>{titulo}</h3>
      {sub && <p className="vs-sec-sub">{sub}</p>}
      <div className="vs-sec-c">{children}</div>
    </section>
  );
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
    <Sheet title={veiculo ? "Seu veículo" : veiculosDe(db).length ? "Novo veículo" : "Escolha o seu veículo"} onClose={onClose}>
      {/* o desenho em destaque, com o tipo logo embaixo */}
      <div className="vs-heroi">
        <div className="transp-palco mini"><FotoVeiculo v={veiculoTela} grande /><i className="transp-chao" aria-hidden="true" /></div>
        <b className="vs-heroi-nome">{nome.trim() || (fipeV && fipeV.modelo) || (tipo === "nenhum" ? "Apps e transporte público" : TIPO_NOME[tipo])}</b>
        <div className="az-abas vs-tipos" role="tablist" aria-label="Tipo">
          {[["carro", "Carro"], ["moto", "Moto"], ["bike", "Bike"], ["nenhum", "Nenhum"]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tipo === k} className={tipo === k ? "on" : ""} onClick={() => { if (k !== tipo) { setTipo(k); if (!propria) setFoto("auto"); vibrar("toque"); } }}>{l}</button>
          ))}
        </div>
      </div>
      {erro && <div className="error">{erro}</div>}

      <Secao n="1" titulo="Nome" sub={temMotor ? "Puxando da Tabela FIPE, eu já preencho o nome e acompanho o valor do carro." : null}>
        <div className="fields">
          <Field label="Apelido" htmlFor="v-nome"><input id="v-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder={tipo === "nenhum" ? "Ex.: Uber e metrô" : "Ex.: Meu Onix, Bolinha azul"} autoComplete="off" /></Field>
        </div>
        {temMotor && <BuscaFipe tipo={tipo === "moto" ? "motos" : "carros"} valor={fipeV} onEscolher={f => { setFipeV(f); if (!nome.trim() && f) setNome(f.modelo.split(" ").slice(0, 2).join(" ")); if (f && /alcool|etanol|flex/i.test(f.combustivel || "") && combustivel === "flex") setCombustivel(/flex/i.test(f.combustivel) ? "flex" : "etanol"); }} />}
      </Secao>

      {tipo !== "nenhum" && (
        <Secao n="2" titulo="Aparência" sub={tipo === "carro" && !propria ? (info ? `${foto === "auto" ? "Pelo modelo, o seu é: " : ""}${info[1]}` : "No automático, eu descubro o tipo pelo modelo. Ou toque no que mais parece com o seu.") : null}>
          <div className="transp-fotos" role="radiogroup" aria-label="Foto do veículo">
            {tipo === "carro" && <button type="button" role="radio" aria-checked={foto === "auto"} className={"auto" + (foto === "auto" ? " on" : "")} onClick={() => setFoto("auto")}><Ilustra n={desenhoAuto[2]} /><small>Automático</small></button>}
            {tipo === "carro" && FOTOS.map(([k, n, arquivo]) => (
              <button key={k} type="button" role="radio" aria-checked={foto === k} className={foto === k ? "on" : ""} onClick={() => setFoto(k)}><Ilustra n={arquivo} /><small>{n}</small></button>
            ))}
            {tipo === "moto" && <button type="button" role="radio" aria-checked={!propria} className={!propria ? "on" : ""} onClick={() => setFoto("auto")}><Ilustra n={FOTO_MOTO[2]} /><small>Desenho</small></button>}
            {tipo === "bike" && <button type="button" role="radio" aria-checked={!propria} className={!propria ? "on" : ""} onClick={() => setFoto("auto")}><span className="emoji">{EMOJI[tipo]}</span><small>Ícone</small></button>}
            <button type="button" role="radio" aria-checked={propria} className={propria ? "on" : ""} onClick={() => arq.current && arq.current.click()}>
              {propria ? <img src={foto} alt="" /> : <span className="emoji"><I.camera /></span>}<small>Foto minha</small>
            </button>
            <input ref={arq} type="file" accept="image/*" hidden onChange={escolherFoto} />
          </div>
        </Secao>
      )}

      {temMotor && <>
        <Secao n="3" titulo="Consumo" sub="Com isso eu calculo o custo por km e quanto sai uma viagem.">
          <div className="vs-chips" role="radiogroup" aria-label="Combustível">{COMBUSTIVEIS.map(([k, n]) => <button key={k} type="button" role="radio" aria-checked={combustivel === k} className={combustivel === k ? "on" : ""} onClick={() => setCombustivel(k)}>{n}</button>)}</div>
          <div className="fields">
            <Field label="Consumo (km por litro)" htmlFor="v-c"><input id="v-c" inputMode="decimal" value={consumo} onChange={e => setConsumo(soNumero(e.target.value))} placeholder="Ex.: 11,5" /></Field>
            <Field label="Km no painel hoje" htmlFor="v-km"><input id="v-km" inputMode="numeric" value={km} onChange={e => setKm(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 45300" /></Field>
          </div>
        </Secao>
        <Secao n="4" titulo="Troca de óleo" sub="Eu aviso o que chegar primeiro: a quilometragem ou o tempo.">
          <div className="vs-linha"><span>A cada</span><div className="vs-chips">{[5000, 7500, 10000, 15000].map(k => <button key={k} type="button" className={oleoKm === k ? "on" : ""} onClick={() => setOleoKm(k)}>{k.toLocaleString("pt-BR")} km</button>)}</div></div>
          <div className="vs-linha"><span>ou a cada</span><div className="vs-chips">{[6, 12].map(m => <button key={m} type="button" className={oleoMeses === m ? "on" : ""} onClick={() => setOleoMeses(m)}>{m} meses</button>)}</div></div>
        </Secao>
        <Secao n="5" titulo="Vencimentos" sub="Eu aviso uma semana antes e no dia. O valor é opcional.">
          {DOCS_VEICULO.map(([k, n]) => (
            <div key={k} className="vs-doc">
              <b>{n}</b>
              <div className="fields duas">
                <Field label="Vence em" htmlFor={`vd-${k}`}><input id={`vd-${k}`} type="date" value={docs[k].data} onChange={e => upDoc(k, "data", e.target.value)} /></Field>
                <Field label="Valor (R$)" htmlFor={`vv-${k}`}><input id={`vv-${k}`} inputMode="decimal" value={docs[k].valor} onChange={e => upDoc(k, "valor", soNumero(e.target.value))} placeholder="Opcional" /></Field>
              </div>
            </div>
          ))}
        </Secao>
      </>}
      <p className="vs-priv"><I.lock /> Fica só com você.</p>
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
