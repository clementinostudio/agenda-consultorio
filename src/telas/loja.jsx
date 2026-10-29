// Parte do app carregada sob demanda: o modo Loja (caixa do dia, gastos, o que falta, resumo e equipe)
import React, { useEffect, useState } from "react";
import { I, Sheet, Field, Seg, Money, brl, brlReal, num, soNumero, fmtNum, todayISO, addDays, MES_LONGO, pad, dm, vibrar, Ilustra, ConfirmButton, iniciais, catVars, CatIcon, TopBar, HelloRow, Toggle, CORES, diaCurto } from "../App.jsx";
import { PAGAMENTOS, pagDe, CATS_LOJA, catLoja, CEDULAS, CORES_PRODUTO, MAX_AJUDANTES, totaisDia, gaveta, maisVendidos, totaisPeriodo, porDia, pixCopiaECola, somaV } from "../loja.js";
import { lerItem, nomeLoja } from "../nota.js";
import { LIMITE_GRATIS } from "../plano.js";
import { NotaSheet } from "./casa.jsx";
const LIMITE_GRATIS_LOJA = LIMITE_GRATIS.lojaDias;
// gerador de QR code (zxing, o mesmo do leitor): só carrega quando alguém pede o QR do Pix
import wasmEscritor from "zxing-wasm/writer/zxing_writer.wasm?url";

const ERROS = [[/ja tem loja/, "Você já está numa loja. Para entrar nesta, saia da outra primeiro."], [/loja cheia/, `Essa loja já tem ${MAX_AJUDANTES} ajudantes.`], [/convite invalido/, "Esse convite venceu ou não existe. Peça um link novo para quem criou a loja."], [/sem login/, "Entre na sua conta para continuar."], [/so a dona/, "Só quem criou a loja pode fazer isso."]];
const erroDe = e => { const t = String((e && e.message) || e); const m = ERROS.find(([r]) => r.test(t)); return m ? m[1] : "Não consegui falar com a nuvem. Confira a internet e tente de novo."; };
const nomeDe = (L, id) => id === L.eu ? "Você" : ((L.membros.find(m => m.id === id) || {}).nome || "Alguém");
const primeiroNome = s => String(s || "").trim().split(/\s+/)[0] || "";
const Pessoa = ({ m, grande }) => <span className={"casa-av" + (grande ? " grande" : "")}>{m.foto ? <img src={m.foto} alt="" /> : iniciais(m.nome || "?")}</span>;
const horaAgora = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const corDe = id => CORES.find(c => c.id === id) || CORES[4];
const mesDe = off => { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth() + off, 1); const ult = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(); const ch = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`; return { ch, de: `${ch}-01`, ate: `${ch}-${pad(ult)}`, nome: MES_LONGO[m.getMonth()], ano: m.getFullYear() }; };
const Mai = s => s.charAt(0).toUpperCase() + s.slice(1);
const qtdTxt = q => String(Math.round(q * 1000) / 1000).replace(".", ",");
// a equipe (e o histórico longo) é do Pro: quem não pode, vê o convite para assinar
const podeEquipe = act => act.lojaPro;
const NO_PAG = { dinheiro: "no dinheiro", pix: "no Pix", debito: "no débito", credito: "no crédito" };

/* =========================================================
   Sem loja ainda: criar (ou esperar a nuvem)
   ========================================================= */
function SemLoja({ L, conta, act, tema }) {
  const [nome, setNome] = useState(""), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const criar = async () => { setOcupado(true); setErro(""); try { await L.criar(nome.trim() || "Minha loja"); vibrar("ok"); act.toast("Loja aberta! Agora cadastre o que você vende."); } catch (e) { setErro(erroDe(e)); vibrar("erro"); } setOcupado(false); };
  return (
    <div className="page lj-pg">
      <HelloRow conta={conta} act={act} tema={tema} modo="loja" />
      <h1 className="hello-t">Vamos tirar o caixa<br />do <b>papel</b>?</h1>
      <div className="cols"><div className="col">
        <section className="panel casa-criar">
          {L.estado === "carregando" ? <p className="hint">Abrindo a loja…</p>
            : L.estado === "indisponivel" ? <p className="hint">A loja ainda está sendo ligada na nuvem. Daqui a pouco ela aparece aqui.</p>
            : L.estado === "erro" ? <><p className="hint">Não consegui abrir a loja agora. Confira a internet.</p><button className="btn ghost" onClick={L.recarregar}>Tentar de novo</button></>
            : <>
              <div className="casa-intro">
                <Ilustra n="dinheiro" />
                <ul>
                  <li><b>Cada venda em um toque</b>: cadastre os produtos e toque neles na hora de vender.</li>
                  <li><b>Fechar o caixa</b>: o app diz quanto deveria ter na gaveta. Você conta e vê se bateu.</li>
                  <li><b>Gastos da loja</b> separados do seu dinheiro: insumos, embalagem, gás, ajudante…</li>
                  <li><b>A lista do que falta</b> e o resumo do dia, da semana e do mês.</li>
                  <li><b>Quem ajuda anota junto</b>, cada um no seu celular{act.lojaPro ? "" : " (no Pro Loja)"}.</li>
                </ul>
              </div>
              <div className="fields"><Field label="Nome da loja" htmlFor="lj-nome"><input id="lj-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Doces da Ana, Sorveteria Gelato" maxLength={60} /></Field></div>
              {erro && <div className="error">{erro}</div>}
              <button className="btn mode" disabled={ocupado} onClick={criar}><I.check /> {ocupado ? "Abrindo…" : "Abrir minha loja"}</button>
              <div className="hint">Vai ajudar na loja de alguém? Peça o link de convite para quem cuida dela.</div>
            </>}
        </section>
      </div></div>
    </div>
  );
}

// Aviso no topo: a equipe é do Pro e a assinatura da dona acabou
function AvisoEquipe({ L, act }) {
  if (act.lojaPro || L.membros.length < 2) return null;
  return L.souDona
    ? <div className="note amber"><I.alert /><span>Sua equipe faz parte do <b>Pro Loja</b>. Para os ajudantes continuarem anotando, renove a assinatura. <button className="link" onClick={() => act.pedirPro("loja-equipe")}>Ver planos</button></span></div>
    : <div className="note amber"><I.alert /><span>A assinatura da loja acabou. Peça para <b>{nomeDe(L, L.loja.dono)}</b> renovar o Pro Loja para você continuar anotando.</span></div>;
}
const travado = (L, act) => !act.lojaPro && !L.souDona && L.membros.length > 1;

/* =========================================================
   Caixa: vender, ver o dia, fechar o caixa
   ========================================================= */
export function LojaCaixa({ loja: L, conta, act, tema }) {
  const [ticket, setTicket] = useState({}); // { idDoProduto: quantidade }
  const [editar, setEditar] = useState(false);
  const [recebido, setRecebido] = useState("");
  const hoje = todayISO();
  if (!L.loja) return <SemLoja L={L} conta={conta} act={act} tema={tema} />;
  const T = totaisDia(L, hoje);
  const G = gaveta(L, hoje);
  const ativos = L.produtos.filter(p => p.ativo !== false);
  const itens = Object.entries(ticket).filter(([, q]) => q > 0).map(([id, q]) => { const p = L.produtos.find(x => x.id === id); return p && { p: id, nome: p.nome, preco: p.preco, q }; }).filter(Boolean);
  const total = Math.round(itens.reduce((s, it) => s + it.preco * it.q, 0) * 100) / 100;
  const nItens = itens.reduce((s, it) => s + it.q, 0);
  const troco = num(recebido) - total;
  const ultimas = L.vendas.filter(v => v.dia === hoje).sort((a, b) => (b.criado || 0) - (a.criado || 0));
  const bloqueado = travado(L, act);

  const tocar = p => {
    if (editar) return act.abrirLoja("produto", { inicial: p });
    vibrar("toque"); setTicket(t => ({ ...t, [p.id]: (t[p.id] || 0) + 1 }));
  };
  const menos = id => setTicket(t => { const n = { ...t }; n[id] = Math.max(0, (n[id] || 0) - 1); if (!n[id]) delete n[id]; return n; });
  const registrar = async (pag, extra = {}) => {
    if (bloqueado) return act.toast("A assinatura da loja acabou: peça para quem criou a loja renovar.");
    const v = await L.salvar("venda", { dia: hoje, hora: horaAgora(), itens, total, pag, autor: L.eu, criado: Date.now(), ...extra });
    setTicket({}); setRecebido("");
    vibrar("ok");
    act.toast(`Venda de ${brlReal(total)} ${NO_PAG[pag] || ""}`, () => L.apagar("venda", v.id));
  };
  const vender = pag => {
    if (!itens.length) return;
    if (pag === "pix") return act.abrirLoja("pix", { total, onPago: () => registrar("pix") });
    registrar(pag);
  };

  return (
    <div className="page lj-pg">
      <HelloRow conta={conta} act={act} tema={tema} modo="loja" />
      <header className="lj-topo">
        <div><div className="eyebrow">{diaCurto(hoje)}{L.membros.length > 1 ? ` · ${L.membros.length} pessoas` : ""}</div><h1>{L.loja.nome}</h1></div>
        <button className="icon-btn" onClick={() => act.abrirLoja("ajustes")} aria-label="Ajustes e equipe da loja"><I.gear /></button>
      </header>
      <AvisoEquipe L={L} act={act} />
      <div className="cols">
        <div className="col">
          {/* o dia até agora */}
          <section className="bal lj-dia">
            <div className="bal-top"><span className="lab">Entrou hoje</span><span className="lj-n">{T.vendas} {T.vendas === 1 ? "venda" : "vendas"}</span></div>
            <div className="bal-amt"><Money v={T.entrou} /></div>
            <div className="lj-pags">{PAGAMENTOS.filter(p => T.porPag[p.id] > 0).map(p => <span key={p.id}><small>{p.curto}</small><b className="num">{brl(T.porPag[p.id])}</b></span>)}</div>
            {L.veLucro && (T.saiu > 0 || T.entrou > 0) && <div className="bal-sub"><span className="trend dn">−{brl(T.saiu)} de gastos</span><span className={T.sobrou >= 0 ? "up" : "trend dn"}>sobrou {brl(T.sobrou)}</span></div>}
          </section>

          {/* os produtos: cada toque, um na venda */}
          <section className="panel lj-vender">
            <div className="panel-head"><h3>{editar ? "Toque para editar" : "Vender"}</h3>
              {ativos.length > 0 && <button className="link" onClick={() => setEditar(!editar)}>{editar ? "Pronto" : "Editar produtos"}</button>}</div>
            {ativos.length === 0 && <div className="hint">Cadastre o que você vende (com o preço). Depois é só tocar no produto na hora da venda.</div>}
            <div className="lj-grade">
              {ativos.map(p => { const c = corDe(p.cor), q = ticket[p.id] || 0; return (
                <button key={p.id} type="button" className={"lj-prod" + (q ? " no-ticket" : "") + (editar ? " editando" : "")} style={{ "--pc": c.cor, "--pc-ink": c.ink }} onClick={() => tocar(p)} aria-label={`${p.nome}, ${brlReal(p.preco)}${q ? `, ${q} na venda` : ""}`}>
                  {q > 0 && <i className="lj-q">{q}</i>}
                  {editar && <i className="lj-lapis"><I.pencil /></i>}
                  <b>{p.nome}</b><small className="num">{brlReal(p.preco)}</small>
                </button>
              ); })}
              <button type="button" className="lj-prod novo" onClick={() => act.abrirLoja("produto", {})}><I.plus /><b>Produto</b></button>
            </div>
            {!editar && <button className="btn text" onClick={() => act.abrirLoja("venda", {})} disabled={bloqueado}><I.plus /> Venda sem produto (só o valor)</button>}
          </section>

          {/* a venda que está sendo montada */}
          {itens.length > 0 && (
            <section className="panel lj-ticket" aria-label="Venda">
              <div className="lj-ticket-itens">
                {itens.map(it => (
                  <div key={it.p} className="lj-ticket-it">
                    <button className="icon-btn" onClick={() => menos(it.p)} aria-label={`Tirar um ${it.nome}`}><I.minus /></button>
                    <span><b>{it.q}×</b> {it.nome}</span>
                    <b className="num">{brlReal(it.preco * it.q)}</b>
                  </div>
                ))}
              </div>
              <div className="lj-ticket-tot"><span>{nItens} {nItens === 1 ? "item" : "itens"}</span><b className="num">{brlReal(total)}</b><button className="link" onClick={() => { setTicket({}); setRecebido(""); }}>Limpar</button></div>
              <div className="lj-troco">
                <label htmlFor="lj-rec">Recebeu</label>
                <input id="lj-rec" inputMode="decimal" value={recebido} onChange={e => setRecebido(soNumero(e.target.value))} placeholder="R$ 0,00" />
                {num(recebido) > 0 && <span className={troco >= 0 ? "ok" : "falta"}>{troco >= 0 ? <>Troco <b className="num">{brlReal(troco)}</b></> : <>Faltam <b className="num">{brlReal(-troco)}</b></>}</span>}
              </div>
              <div className="lj-pagar">
                {PAGAMENTOS.map(p => <button key={p.id} className={"btn " + (p.id === "dinheiro" ? "mode" : "ghost")} onClick={() => vender(p.id)} disabled={bloqueado}>{p.curto}</button>)}
              </div>
            </section>
          )}

          <div className="lj-acoes">
            <button className="act" onClick={() => act.abrirLoja("gasto", {})}><i><I.minus /></i>Gasto</button>
            <button className="act" onClick={() => act.abrirLoja("mov", {})}><i><I.repeat /></i>Tirar ou pôr</button>
            <button className="act" onClick={() => act.abrirLoja("fechar", {})}><i><I.wallet /></i>{G.fechado ? "Caixa fechado" : "Fechar caixa"}</button>
          </div>
        </div>

        <div className="col">
          {/* a gaveta agora */}
          <section className="panel lj-gaveta">
            <div className="panel-head"><h3>Na gaveta agora</h3>{G.fechado && <small className="lj-ok"><I.check /> fechado às {G.fechado.hora}</small>}</div>
            <div className="lj-gaveta-v"><Money v={G.esperado} /><small>em dinheiro, pelo que foi anotado</small></div>
            <button className="btn ghost" onClick={() => act.abrirLoja("fechar", {})}><I.wallet /> {G.fechado ? "Ver o fechamento" : "Contar e fechar o caixa"}</button>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Vendas de hoje</h3>{ultimas.length > 0 && <small>{ultimas.length}</small>}</div>
            {ultimas.length === 0 && <div className="empty">Nenhuma venda ainda hoje.</div>}
            {ultimas.slice(0, 30).map(v => (
              <button key={v.id} className="lj-linha" onClick={() => act.abrirLoja("venda", { inicial: v })}>
                <span className="lj-hora">{v.hora}</span>
                <span className="mid"><b>{v.itens && v.itens.length ? v.itens.map(it => `${it.q > 1 ? it.q + "× " : ""}${it.nome}`).join(", ") : v.desc || "Venda"}</b><small>{pagDe(v.pag).curto}{L.membros.length > 1 ? ` · ${nomeDe(L, v.autor)}` : ""}</small></span>
                <span className="amt num"><Money v={v.total} /></span>
              </button>
            ))}
            {ultimas.length > 30 && <div className="hint">E mais {ultimas.length - 30} vendas.</div>}
          </section>

          {L.gastos.some(g => g.dia === hoje) && <section className="panel">
            <div className="panel-head"><h3>Gastos de hoje</h3><button className="link" onClick={() => act.setTab("l-gastos")}>Ver todos</button></div>
            {L.gastos.filter(g => g.dia === hoje).map(g => <LinhaGasto key={g.id} g={g} L={L} act={act} />)}
          </section>}
        </div>
      </div>
    </div>
  );
}

function LinhaGasto({ g, L, act }) {
  const cat = catLoja(g.cat);
  return (
    <button className="casa-gasto" onClick={() => act.abrirLoja("gasto", { inicial: g })}>
      <span className="ci" style={catVars(cat)}><CatIcon cat={cat} /></span>
      <span className="mid"><b>{g.desc || cat.nome}</b><small>{cat.nome} · {dm(g.dia)}{g.daGaveta ? " · da gaveta" : ""}{L.membros.length > 1 ? ` · ${nomeDe(L, g.autor)}` : ""}{g.nota ? " · com nota" : ""}</small></span>
      <span className="amt num"><Money v={g.valor} /></span>
    </button>
  );
}

/* =========================================================
   Gastos da loja (por mês)
   ========================================================= */
export function LojaGastos({ loja: L, conta, act, tema }) {
  const [off, setOff] = useState(0);
  if (!L.loja) return <SemLoja L={L} conta={conta} act={act} tema={tema} />;
  const mes = mesDe(off);
  const antigo = mes.ate < L.desde; // meses que não ficam no aparelho: só os totais
  const travadoMes = !act.lojaPro && mes.ate < addDays(todayISO(), -(LIMITE_GRATIS_LOJA - 1));
  const doMes = L.gastos.filter(g => g.dia >= mes.de && g.dia <= mes.ate).sort((a, b) => b.dia.localeCompare(a.dia) || (b.criado || 0) - (a.criado || 0));
  const total = somaV(doMes, g => g.valor);
  const porCat = {}; doMes.forEach(g => { porCat[g.cat || "outros"] = (porCat[g.cat || "outros"] || 0) + g.valor; });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  return (
    <div className="page lj-pg">
      <TopBar eyebrow={L.loja.nome} title="Gastos da loja" act={act} tema={tema} />
      <AvisoEquipe L={L} act={act} />
      <div className="cols">
        <div className="col">
          <section className="panel casa-mes">
            <div className="casa-mes-nav">
              <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="Mês anterior"><I.chevL /></button>
              <span>{Mai(mes.nome)} de {mes.ano}</span>
              <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Próximo mês" disabled={off >= 0}><I.chev /></button>
            </div>
            {travadoMes ? <div className="empty com-ilustra"><b>Meses antigos ficam no Pro Loja</b>Na versão grátis, aparecem os últimos {LIMITE_GRATIS_LOJA} dias. Nada se perde.<button className="btn mode" onClick={() => act.pedirPro("loja-historico")}>Ver o Pro Loja</button></div>
              : antigo ? <div className="hint">Os gastos um a um ficam guardados de {MES_LONGO[Number(L.desde.slice(5, 7)) - 1]} para cá. Para meses antigos, veja os totais no Resumo.</div> : <>
              <div className="casa-total"><Money v={total} /><small>{doMes.length} {doMes.length === 1 ? "gasto" : "gastos"} em {mes.nome}</small></div>
              {cats.length > 0 && <div className="lj-cats">
                {cats.map(([id, v]) => { const c = catLoja(id); return (
                  <div key={id} className="lj-cat" style={catVars(c)}>
                    <span className="ci"><CatIcon cat={c} /></span><span className="mid"><b>{c.nome}</b><i style={{ width: `${Math.max(4, (v / cats[0][1]) * 100)}%` }} /></span><b className="num">{brl(v)}</b>
                  </div>
                ); })}
              </div>}
            </>}
          </section>
          <div className="casa-acoes">
            <button className="btn mode" onClick={() => act.abrirLoja("gasto", {})}><I.plus /> Anotar gasto</button>
            <button className="btn ghost" onClick={() => act.abrirLoja("nota", {})}><I.receipt /> Ler a nota do fornecedor</button>
          </div>
        </div>
        <div className="col">
          {!antigo && !travadoMes && <section className="panel">
            <div className="panel-head"><h3>Gastos de {mes.nome}</h3></div>
            {doMes.length === 0 && <div className="empty">Nenhum gasto da loja em {mes.nome}.</div>}
            {doMes.map(g => <LinhaGasto key={g.id} g={g} L={L} act={act} />)}
          </section>}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   O que falta: a lista compartilhada (comprou, vira gasto)
   ========================================================= */
export function LojaLista({ loja: L, conta, act, tema }) {
  const [txt, setTxt] = useState("");
  if (!L.loja) return <SemLoja L={L} conta={conta} act={act} tema={tema} />;
  const abertos = L.faltas.filter(x => !x.feito).sort((a, b) => (a.criado || 0) - (b.criado || 0));
  const feitos = L.faltas.filter(x => x.feito).sort((a, b) => (a.criado || 0) - (b.criado || 0));
  // o que sempre falta (já esteve na lista e foi comprado): sugestão de "acabou?"
  const sempre = Object.values(L.config.faltou || {}).sort((a, b) => b.n - a.n).map(x => x.texto).filter(t => !L.faltas.some(x => x.texto.toLowerCase() === t.toLowerCase())).slice(0, 8);
  const adicionar = textos => textos.forEach((s, i) => { const it = lerItem(s); if (it.texto) L.salvar("falta", { texto: it.texto, qtd: it.qtd, feito: false, criado: Date.now() + i, autor: L.eu }); });
  const add = e => { e.preventDefault(); const t = txt.trim(); if (!t) return; adicionar(t.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)); setTxt(""); vibrar("toque"); };
  const mandar = async () => {
    const texto = `Está faltando na ${L.loja.nome}:\n${abertos.map(x => `• ${x.qtd > 1 ? x.qtd + "× " : ""}${x.texto}`).join("\n")}`;
    if (navigator.share) { try { await navigator.share({ text: texto }); return; } catch (e) { if (e.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };
  const Item = ({ x }) => (
    <div className={"casa-item" + (x.feito ? " feito" : "")}>
      <button className={"box " + (x.feito ? "done" : "up")} onClick={() => { vibrar("toque"); L.salvar("falta", { ...x, feito: !x.feito, por: L.eu }); }} aria-label={x.feito ? `Desmarcar ${x.texto}` : `Comprei ${x.texto}`}>{x.feito && <I.check />}</button>
      <span>{x.qtd > 1 && <b className="casa-item-q">{x.qtd}×</b>}{x.texto}{x.autor && x.autor !== L.eu ? <small> · {nomeDe(L, x.autor)}</small> : null}</span>
      <button className="casa-item-x" onClick={() => L.apagar("falta", x.id)} aria-label={`Tirar ${x.texto}`}><I.x /></button>
    </div>
  );
  return (
    <div className="page lj-pg">
      <TopBar eyebrow={L.loja.nome} title="O que falta" act={act} tema={tema} />
      <AvisoEquipe L={L} act={act} />
      <div className="cols"><div className="col">
        <section className="panel casa-compras">
          <div className="panel-head"><h3>Lista de compras da loja</h3>{L.faltas.length > 0 && <small>{feitos.length} de {L.faltas.length}</small>}</div>
          <form className="casa-compras-add" onSubmit={add}>
            <input value={txt} onChange={e => setTxt(e.target.value)} placeholder="Acabou o quê? (ex.: 2 leite condensado, copos)" aria-label="Item que está faltando" enterKeyHint="done" />
            <button type="submit" className="icon-btn" aria-label="Adicionar" disabled={!txt.trim()}><I.plus /></button>
          </form>
          {sempre.length > 0 && <div className="casa-sug"><small>Sempre falta. Acabou?</small>{sempre.map(s => <button key={s} type="button" onClick={() => { adicionar([s]); vibrar("toque"); }}><I.plus />{s}</button>)}</div>}
          {L.faltas.length === 0 && <div className="hint">Acabou alguma coisa? Coloque aqui: aparece na hora no celular de quem vai comprar. Na volta, marque o que comprou e coloque o preço: vira gasto da loja sozinho.</div>}
          {abertos.map(x => <Item key={x.id} x={x} />)}
          {feitos.length > 0 && <div className="casa-secao feitos"><small className="casa-secao-t">Comprado</small>{feitos.map(x => <Item key={x.id} x={x} />)}</div>}
          {feitos.length > 0 && <button className="btn mode" onClick={() => act.abrirLoja("comprei", {})}><I.check /> Anotar o que comprei ({feitos.length})</button>}
          <div className="btn-row">
            {abertos.length > 0 && <button className="btn ghost" onClick={mandar}><I.share /> Mandar a lista</button>}
            <button className="btn ghost" onClick={() => act.abrirLoja("nota", {})}><I.receipt /> Ler a nota</button>
          </div>
        </section>
      </div></div>
    </div>
  );
}

/* =========================================================
   Resumo: hoje, semana, mês (entrou, saiu, sobrou, o que mais vendeu)
   ========================================================= */
export function LojaResumo({ loja: L, conta, act, tema }) {
  const [rng, setRng] = useState("mes");
  const [off, setOff] = useState(0);
  const [antigos, setAntigos] = useState([]);
  const hoje = todayISO();
  const mes = mesDe(off);
  const de = rng === "hoje" ? hoje : rng === "7" ? addDays(hoje, -6) : mes.de;
  const ate = rng === "mes" ? (mes.ate > hoje ? hoje : mes.ate) : hoje;
  const limiteGratis = addDays(hoje, -(LIMITE_GRATIS_LOJA - 1));
  const bloqueado = !act.lojaPro && rng === "mes" && mes.ate < limiteGratis; // mês inteiro antes dos últimos 30 dias
  // dias antes da janela guardada no aparelho: os totais vêm da nuvem
  const precisaNuvem = L.loja && de < L.desde;
  useEffect(() => {
    if (!precisaNuvem || bloqueado) { setAntigos([]); return; }
    let vivo = true;
    L.resumo(de, addDays(L.desde, -1) < ate ? addDays(L.desde, -1) : ate).then(r => vivo && setAntigos(r)).catch(() => vivo && setAntigos([]));
    return () => { vivo = false; };
  }, [de, ate, precisaNuvem, bloqueado, L.loja && L.loja.id]);
  if (!L.loja) return <SemLoja L={L} conta={conta} act={act} tema={tema} />;
  if (!L.veLucro) return (
    <div className="page lj-pg">
      <TopBar eyebrow={L.loja.nome} title="Resumo" act={act} tema={tema} />
      <div className="cols"><div className="col"><section className="panel"><div className="empty com-ilustra"><Ilustra n="cafe" /><b>O resumo é de quem cuida da loja</b>{nomeDe(L, L.loja.dono)} pode liberar para você em Ajustes da loja → Equipe.</div></section></div></div>
    </div>
  );
  const P = totaisPeriodo(L, de, ate, antigos);
  const dias = porDia(L, de, ate, antigos);
  const top = maisVendidos(L.vendas.filter(v => v.dia >= de && v.dia <= ate), 6);
  const cats = Object.entries(P.porCat).sort((a, b) => b[1] - a[1]);
  const nomeRng = rng === "hoje" ? "hoje" : rng === "7" ? "nos últimos 7 dias" : `em ${mes.nome}`;
  const mandar = async () => {
    const texto = `${L.loja.nome}: resumo ${nomeRng}\nEntrou: ${brlReal(P.entrou)} (${P.vendas} vendas)\nGastos: ${brlReal(P.saiu)}\nSobrou: ${brlReal(P.sobrou)}${top.length ? `\nMais vendido: ${top[0].nome} (${qtdTxt(top[0].q)})` : ""}`;
    if (navigator.share) { try { await navigator.share({ text: texto }); return; } catch (e) { if (e.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };
  // barras por dia (no máximo 31)
  const listaDias = []; for (let d = de; d <= ate && listaDias.length < 31; d = addDays(d, 1)) listaDias.push(dias[d] || { dia: d, entrou: 0, saiu: 0 });
  const maior = Math.max(1, ...listaDias.map(x => Math.max(x.entrou, x.saiu)));
  return (
    <div className="page lj-pg">
      <TopBar eyebrow={L.loja.nome} title="Resumo" act={act} tema={tema} />
      <div className="cols">
        <div className="col">
          <div className="ranges" role="tablist">
            {[["hoje", "Hoje"], ["7", "7 dias"], ["mes", "Mês"]].map(([v, l]) => <button key={v} role="tab" aria-selected={rng === v} className={"rg" + (rng === v ? " on" : "")} onClick={() => { setRng(v); if (v !== "mes") setOff(0); }}>{l}</button>)}
          </div>
          {rng === "mes" && <div className="casa-mes-nav lj-mes-nav">
            <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="Mês anterior"><I.chevL /></button>
            <span>{Mai(mes.nome)} de {mes.ano}</span>
            <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Próximo mês" disabled={off >= 0}><I.chev /></button>
          </div>}
          {bloqueado ? <section className="panel"><div className="empty com-ilustra"><Ilustra n="cafe" /><b>Meses antigos ficam no Pro Loja</b>Na versão grátis, o resumo mostra os últimos {LIMITE_GRATIS_LOJA} dias. Nada se perde: assinando, tudo aparece.<button className="btn mode" onClick={() => act.pedirPro("loja-historico")}>Ver o Pro Loja</button></div></section> : <>
            <section className="bal lj-dia">
              <div className="bal-top"><span className="lab">Sobrou {nomeRng}</span></div>
              <div className={"bal-amt" + (P.sobrou < 0 ? " neg" : "")}><Money v={P.sobrou} /></div>
              <div className="bal-sub"><span className="up">+{brl(P.entrou)}</span><span className="trend dn">−{brl(P.saiu)}</span></div>
              {listaDias.length > 1 && <div className="lj-barras" aria-hidden="true">
                {listaDias.map(x => <span key={x.dia} title={`${dm(x.dia)}: entrou ${brlReal(x.entrou)}, saiu ${brlReal(x.saiu)}`}><i className="e" style={{ height: `${(x.entrou / maior) * 100}%` }} /><i className="s" style={{ height: `${(x.saiu / maior) * 100}%` }} /></span>)}
              </div>}
            </section>
            <div className="tiles">
              <div className="tile"><I.receipt /><div><span>Vendas</span><b>{P.vendas}</b></div></div>
              <div className="tile"><I.money /><div><span>Por venda</span><b>{brl(P.ticket)}</b></div></div>
              <div className="tile"><I.down /><div><span>Entrou</span><b style={{ color: "var(--mint)" }}>{brl(P.entrou)}</b></div></div>
            </div>
            <button className="btn ghost" onClick={mandar}><I.share /> Mandar este resumo</button>
          </>}
        </div>
        {!bloqueado && <div className="col">
          <section className="panel">
            <div className="panel-head"><h3>O que mais vendeu</h3></div>
            {top.length === 0 ? <div className="empty">{precisaNuvem && de < L.desde ? "Para meses antigos, ficam só os totais." : "Nenhum produto vendido no período."}</div> : top.map((x, k) => (
              <div key={x.nome} className="lj-top"><span className="lj-pos">{k + 1}</span><span className="mid"><b>{x.nome}</b><i style={{ width: `${Math.max(4, (x.q / top[0].q) * 100)}%` }} /></span><span className="v"><b>{qtdTxt(x.q)}</b><small className="num">{brl(x.total)}</small></span></div>
            ))}
          </section>
          <section className="panel">
            <div className="panel-head"><h3>Para onde foi o dinheiro</h3></div>
            {cats.length === 0 ? <div className="empty">Nenhum gasto no período.</div> : <div className="lj-cats">
              {cats.map(([id, v]) => { const c = catLoja(id); return (
                <div key={id} className="lj-cat" style={catVars(c)}><span className="ci"><CatIcon cat={c} /></span><span className="mid"><b>{c.nome}</b><i style={{ width: `${Math.max(4, (v / cats[0][1]) * 100)}%` }} /></span><b className="num">{brl(v)}</b></div>
              ); })}
            </div>}
          </section>
        </div>}
      </div>
    </div>
  );
}

/* =========================================================
   Painéis (abertos pelo App com type "loja" e qual = ...)
   ========================================================= */
export function LojaSheet({ sheet, loja: L, conta, servidor, onClose, act }) {
  const p = { L, conta, servidor, onClose, act, ...sheet };
  switch (sheet.qual) {
    case "produto": return <ProdutoSheet {...p} />;
    case "venda": return <VendaSheet {...p} />;
    case "pix": return <PixSheet {...p} />;
    case "gasto": return <GastoSheet {...p} />;
    case "mov": return <MovSheet {...p} />;
    case "fechar": return <FecharSheet {...p} />;
    case "comprei": return <CompreiSheet {...p} />;
    case "ajustes": return <AjustesSheet {...p} />;
    case "convite": return <ConviteSheet {...p} />;
    case "nota": return <NotaLoja {...p} />;
    default: return null;
  }
}

function ProdutoSheet({ L, inicial, onClose, act }) {
  const [nome, setNome] = useState(inicial ? inicial.nome : "");
  const [preco, setPreco] = useState(inicial ? fmtNum(inicial.preco) : "");
  const [cor, setCor] = useState(inicial ? inicial.cor : CORES_PRODUTO[L.produtos.length % CORES_PRODUTO.length]);
  const ok = nome.trim() && num(preco) > 0;
  const SUG = ["Brigadeiro", "Bolo (fatia)", "Sorvete 1 bola", "Açaí 300 ml", "Coxinha", "Pastel", "Refrigerante lata", "Água", "Café"];
  const salvar = async () => {
    await L.salvar("produto", { ...(inicial || {}), nome: nome.trim(), preco: num(preco), cor, ativo: true, ordem: inicial ? inicial.ordem : L.produtos.length, criado: inicial ? inicial.criado : Date.now() });
    vibrar("ok"); act.toast(inicial ? "Produto atualizado" : `${nome.trim()} no caixa`); onClose();
  };
  return (
    <Sheet title={inicial ? "Produto" : "Novo produto"} sub="Aparece como botão no caixa" onClose={onClose}>
      {!inicial && <div className="casa-chips">{SUG.filter(s => !L.produtos.some(x => x.nome === s)).slice(0, 6).map(s => <button key={s} type="button" className={nome === s ? "on" : ""} onClick={() => setNome(s)}>{s}</button>)}</div>}
      <div className="fields"><Field label="Nome" htmlFor="lp-n"><input id="lp-n" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Brigadeiro gourmet" maxLength={40} autoComplete="off" /></Field></div>
      <label className="big-amt" htmlFor="lp-v"><span>R$</span><input id="lp-v" inputMode="decimal" value={preco} onChange={e => setPreco(soNumero(e.target.value))} placeholder="0,00" aria-label="Preço" /></label>
      <div className="lj-cores" role="radiogroup" aria-label="Cor do botão">{CORES_PRODUTO.map(c => <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={corDe(c).nome} className={cor === c ? "on" : ""} style={{ "--pc": corDe(c).cor }} onClick={() => setCor(c)} />)}</div>
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : "Colocar no caixa"}</button>
      {inicial && <ConfirmButton label="Tirar do caixa" titulo={`Tirar ${inicial.nome}?`} texto="O botão some do caixa. As vendas que já foram anotadas continuam." acao="Tirar" onConfirm={async () => { await L.salvar("produto", { ...inicial, ativo: false }); onClose(); }} />}
    </Sheet>
  );
}

// Venda só com o valor (sem produto), ou corrigir/apagar uma venda
function VendaSheet({ L, inicial, onClose, act }) {
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.total) : "");
  const [desc, setDesc] = useState(inicial ? inicial.desc || "" : "");
  const [pag, setPag] = useState(inicial ? inicial.pag : "dinheiro");
  const comItens = inicial && inicial.itens && inicial.itens.length > 0;
  const v = num(valor), ok = v > 0;
  const salvar = async () => {
    if (!inicial && pag === "pix") { onClose(); setTimeout(() => act.abrirLoja("pix", { total: v, onPago: () => salvarJa("pix") }), 250); return; }
    await salvarJa(pag); onClose();
  };
  const salvarJa = async pg => {
    const base = inicial || { dia: todayISO(), hora: horaAgora(), itens: [], autor: L.eu, criado: Date.now() };
    await L.salvar("venda", { ...base, total: comItens ? inicial.total : v, desc: desc.trim(), pag: pg });
    vibrar("ok"); act.toast(inicial ? "Venda corrigida" : `Venda de ${brlReal(v)} anotada`);
  };
  return (
    <Sheet title={inicial ? "Venda" : "Venda pelo valor"} sub={inicial ? `${dm(inicial.dia)} às ${inicial.hora}${L.membros.length > 1 ? ` · ${nomeDe(L, inicial.autor)}` : ""}` : "Para o que não tem botão"} onClose={onClose}>
      {comItens ? <div className="nota-itens">{inicial.itens.map((x, i) => <div key={i} className="nota-item"><span className="mid"><b>{x.q}× {x.nome}</b><small>{brlReal(x.preco)} cada</small></span><b className="num">{brlReal(x.q * x.preco)}</b></div>)}<div className="lj-ticket-tot"><span>Total</span><b className="num">{brlReal(inicial.total)}</b></div></div>
        : <label className="big-amt" htmlFor="lv-v"><span>R$</span><input id="lv-v" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" autoFocus={!inicial} aria-label="Valor" /></label>}
      <div className="fields"><Field label="O que foi (se quiser)" htmlFor="lv-d"><input id="lv-d" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: Encomenda de bolo" autoComplete="off" /></Field></div>
      <div className="casa-chips" role="radiogroup" aria-label="Como pagou">{PAGAMENTOS.map(x => <button key={x.id} type="button" className={pag === x.id ? "on" : ""} onClick={() => setPag(x.id)}>{x.curto}</button>)}</div>
      <button className="btn mode" disabled={!comItens && !ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : pag === "pix" ? "Mostrar o Pix" : "Anotar a venda"}</button>
      {inicial && <ConfirmButton label="Apagar esta venda" titulo="Apagar a venda?" texto="Ela some do caixa para todos da loja." acao="Apagar" onConfirm={async () => { await L.apagar("venda", inicial.id); onClose(); act.toast("Venda apagada"); }} />}
    </Sheet>
  );
}

/* ---------- Pix com o valor da venda: QR code na tela para o cliente ---------- */
let ESCRITOR = null;
const escritorQR = () => ESCRITOR || (ESCRITOR = import("zxing-wasm/writer").then(m => { m.prepareZXingModule({ overrides: { locateFile: (p, prefix) => (p.endsWith(".wasm") ? wasmEscritor : prefix + p) } }); return m; }));
function PixSheet({ L, conta, total, onPago, onClose, act }) {
  const cfg = L.config;
  const codigo = cfg.pix ? pixCopiaECola({ chave: cfg.pix, nome: cfg.recebedor || L.loja.nome, cidade: cfg.cidade || (conta.perfil && conta.perfil.cidade) || "", valor: total }) : "";
  const [svg, setSvg] = useState(null);
  useEffect(() => {
    if (!codigo) return;
    let vivo = true;
    escritorQR().then(m => m.writeBarcode(codigo, { format: "QRCode", ecLevel: "M", withQuietZones: true })).then(r => { if (vivo && r && r.svg) setSvg(r.svg); }).catch(() => {});
    return () => { vivo = false; };
  }, [codigo]);
  const pago = () => { onPago && onPago(); onClose(); };
  return (
    <Sheet title={`Pix de ${brlReal(total)}`} sub={codigo ? "O cliente aponta a câmera do app do banco" : "Confira no app do banco e confirme"} onClose={onClose}>
      {codigo ? <>
        <div className="lj-pix">
          {svg ? <img src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)} alt={`QR code do Pix de ${brlReal(total)}`} /> : <span>Gerando o QR code…</span>}
          <b className="num">{brlReal(total)}</b><small>{cfg.recebedor || L.loja.nome}</small>
        </div>
        <button className="btn ghost" onClick={() => { try { navigator.clipboard.writeText(codigo); act.toast("Pix copia e cola copiado"); } catch (e) {} }}><I.copy /> Copiar o Pix copia e cola</button>
      </> : <div className="hint">Coloque a chave Pix da loja em <b>Ajustes da loja</b> e o QR code com o valor já aparece aqui, para o cliente só apontar a câmera.</div>}
      <button className="btn mode" onClick={pago}><I.check /> O Pix caiu: anotar a venda</button>
      <button className="btn text" onClick={onClose}>Voltar</button>
    </Sheet>
  );
}

function GastoSheet({ L, inicial, pre, onClose, act }) {
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : (pre && pre.valor ? fmtNum(pre.valor) : ""));
  const [desc, setDesc] = useState(inicial ? inicial.desc || "" : (pre && pre.desc) || "");
  const [cat, setCat] = useState(inicial ? inicial.cat || "outros" : (pre && pre.cat) || "insumos");
  const [dia, setDia] = useState(inicial ? inicial.dia : todayISO());
  const [daGaveta, setDaGaveta] = useState(inicial ? !!inicial.daGaveta : false);
  const v = num(valor), ok = v > 0;
  const salvar = async () => {
    await L.salvar("gasto", { ...(inicial || {}), valor: v, desc: desc.trim(), cat, dia, daGaveta, autor: (inicial && inicial.autor) || L.eu, criado: inicial ? inicial.criado : Date.now() });
    vibrar("ok"); act.toast(inicial ? "Gasto atualizado" : `Gasto da loja: ${brlReal(v)}`); onClose();
  };
  const c = catLoja(cat);
  return (
    <Sheet title={inicial ? "Gasto da loja" : "Anotar gasto da loja"} sub={L.loja.nome} onClose={onClose}>
      <label className="big-amt" htmlFor="lg-v"><span>R$</span><input id="lg-v" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" autoFocus={!inicial} aria-label="Valor" /></label>
      <div className="casa-chips" role="radiogroup" aria-label="Categoria">{CATS_LOJA.map(x => <button key={x.id} type="button" className={cat === x.id ? "on" : ""} onClick={() => setCat(x.id)}>{x.nome}</button>)}</div>
      <div className="fields"><Field label="O que foi" htmlFor="lg-d"><input id="lg-d" value={desc} onChange={e => setDesc(e.target.value)} placeholder={c.dica ? `Ex.: ${c.dica}` : "O que foi"} autoComplete="off" /></Field></div>
      <div className="fields"><Field label="Quando" htmlFor="lg-dt"><input id="lg-dt" type="date" value={dia} onChange={e => e.target.value && setDia(e.target.value)} /></Field></div>
      <Toggle on={daGaveta} onClick={() => setDaGaveta(!daGaveta)}>Paguei com o dinheiro da gaveta</Toggle>
      {daGaveta && <div className="hint">Sai do que deveria ter no caixa na hora de fechar.</div>}
      {inicial && inicial.nota && <div className="nota-itens">{inicial.nota.itens.map((x, i) => <div key={i} className="nota-item"><span className="mid"><b>{x.nome}</b><small>{x.qtd !== 1 ? `${qtdTxt(x.qtd)} ${x.un || "un"} × ${brlReal(x.unit)}` : brlReal(x.unit)}</small></span><b className="num">{brlReal(x.valor)}</b></div>)}</div>}
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : "Anotar"}</button>
      {inicial && <ConfirmButton label="Apagar este gasto" titulo="Apagar o gasto?" texto="Ele some da loja para todos." acao="Apagar" onConfirm={async () => { await L.apagar("gasto", inicial.id); onClose(); }} />}
    </Sheet>
  );
}

// Tirar ou pôr dinheiro na gaveta (sangria e reforço). Quem criou a loja pode levar a retirada para o Pessoal.
function MovSheet({ L, inicial, onClose, act }) {
  const [tipo, setTipo] = useState(inicial ? inicial.tipo : "retirada");
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [desc, setDesc] = useState(inicial ? inicial.desc || "" : "");
  const [pessoal, setPessoal] = useState(false);
  const v = num(valor), ok = v > 0;
  const podePessoal = !inicial && tipo === "retirada" && act.usaPessoal && L.souDona;
  const salvar = async () => {
    const m = await L.salvar("mov", { ...(inicial || {}), tipo, valor: v, desc: desc.trim(), dia: inicial ? inicial.dia : todayISO(), hora: inicial ? inicial.hora : horaAgora(), pessoal: inicial ? inicial.pessoal : (podePessoal && pessoal) || undefined, autor: (inicial && inicial.autor) || L.eu, criado: inicial ? inicial.criado : Date.now() });
    if (podePessoal && pessoal) act.retiradaParaPessoal({ valor: v, loja: L.loja.nome, desc: desc.trim(), movId: m.id });
    vibrar("ok"); act.toast(tipo === "retirada" ? `Tirou ${brlReal(v)} do caixa${podePessoal && pessoal ? " · entrou no seu Pessoal" : ""}` : `Pôs ${brlReal(v)} no caixa`); onClose();
  };
  const SUG = tipo === "retirada" ? ["Para mim", "Pagar fornecedor", "Depositar no banco"] : ["Troco", "Dinheiro de casa"];
  return (
    <Sheet title={inicial ? (inicial.tipo === "retirada" ? "Dinheiro tirado" : "Dinheiro posto") : "Tirar ou pôr dinheiro"} sub="Na gaveta do caixa" onClose={onClose}>
      {!inicial && <Seg value={tipo} onChange={setTipo} options={[{ v: "retirada", l: "Tirar" }, { v: "reforco", l: "Pôr" }]} />}
      <label className="big-amt" htmlFor="lm-v"><span>R$</span><input id="lm-v" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" autoFocus={!inicial} aria-label="Valor" /></label>
      <div className="casa-chips">{SUG.map(s => <button key={s} type="button" className={desc === s ? "on" : ""} onClick={() => setDesc(s)}>{s}</button>)}</div>
      <div className="fields"><Field label="Para quê" htmlFor="lm-d"><input id="lm-d" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: Troco do dia" autoComplete="off" /></Field></div>
      {podePessoal && <><Toggle on={pessoal} onClick={() => setPessoal(!pessoal)}>Levar para o meu Pessoal</Toggle>
        <div className="hint">Separa o dinheiro da loja do seu: a retirada entra como entrada no seu modo Pessoal.</div></>}
      {inicial && inicial.pessoal && <div className="hint">Esta retirada entrou no seu Pessoal.</div>}
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : tipo === "retirada" ? "Tirar do caixa" : "Pôr no caixa"}</button>
      {inicial && <ConfirmButton label="Apagar" titulo="Apagar este movimento?" texto="Ele some do caixa." acao="Apagar" onConfirm={async () => { await L.apagar("mov", inicial.id); onClose(); }} />}
    </Sheet>
  );
}

/* ---------- fechar o caixa: o que deveria ter, o que tem, e o troco para amanhã ---------- */
function FecharSheet({ L, conta, onClose, act }) {
  const hoje = todayISO();
  const [dia, setDia] = useState(hoje);
  const G = gaveta(L, dia), T = totaisDia(L, dia);
  const f = G.fechado;
  const [troco, setTroco] = useState(() => fmtNum(G.troco));
  const [contado, setContado] = useState(f ? fmtNum(f.contado) : "");
  const [notas, setNotas] = useState({}); // contar por cédula: { 50: 2, 20: 3 }
  const [verNotas, setVerNotas] = useState(false);
  const [deixou, setDeixou] = useState(f && f.deixou != null ? fmtNum(f.deixou) : "");
  useEffect(() => { const g = gaveta(L, dia); setTroco(fmtNum(g.troco)); setContado(g.fechado ? fmtNum(g.fechado.contado) : ""); setDeixou(g.fechado && g.fechado.deixou != null ? fmtNum(g.fechado.deixou) : ""); setNotas({}); }, [dia]);
  const trocoN = num(troco);
  const esperado = Math.round((trocoN + G.vendas + G.reforcos - G.gastos - G.retiradas) * 100) / 100;
  const somaNotas = Math.round(CEDULAS.reduce((s, c) => s + c * (notas[c] || 0), 0) * 100) / 100;
  const contadoN = verNotas ? somaNotas : num(contado);
  const temContado = verNotas ? somaNotas > 0 : contado.trim() !== "";
  const dif = Math.round((contadoN - esperado) * 100) / 100;
  const deixouN = deixou.trim() === "" ? Math.min(contadoN, trocoN || contadoN) : num(deixou);
  const ms = L.movs.filter(m => m.dia === dia);
  const salvar = async () => {
    await L.salvar("caixa", { id: dia, dia, troco: trocoN, contado: contadoN, esperado, dif, deixou: deixouN, por: L.eu, hora: horaAgora(), pix: T.porPag.pix, cartao: Math.round((T.porPag.debito + T.porPag.credito) * 100) / 100, criado: f ? f.criado : Date.now() });
    vibrar(Math.abs(dif) < 0.01 ? "ok" : "aviso");
    act.toast(Math.abs(dif) < 0.01 ? "Caixa fechado: bateu certinho!" : dif > 0 ? `Caixa fechado: sobrou ${brlReal(dif)}` : `Caixa fechado: faltou ${brlReal(-dif)}`);
    onClose();
  };
  const mandar = async () => {
    const texto = `${L.loja.nome} · caixa de ${dm(dia)}\nVendas: ${brlReal(T.entrou)} (${T.vendas})\n• Dinheiro: ${brlReal(T.porPag.dinheiro)}\n• Pix: ${brlReal(T.porPag.pix)}\n• Cartão: ${brlReal(T.porPag.debito + T.porPag.credito)}\nGastos: ${brlReal(T.saiu)}\nNa gaveta: ${brlReal(contadoN)} (deveria ter ${brlReal(esperado)}${Math.abs(dif) < 0.01 ? ", bateu" : dif > 0 ? `, sobrou ${brlReal(dif)}` : `, faltou ${brlReal(-dif)}`})\nTroco para amanhã: ${brlReal(deixouN)}\nFechado por ${primeiroNome(conta.nome)}`;
    if (navigator.share) { try { await navigator.share({ text: texto }); return; } catch (e) { if (e.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };
  const Linha = ({ l, v, sinal }) => <div className="lj-conta"><span>{l}</span><b className="num">{sinal}{brlReal(v)}</b></div>;
  return (
    <Sheet title={f ? "Caixa fechado" : "Fechar o caixa"} sub={dia === hoje ? "Hoje" : diaCurto(dia)} onClose={onClose}>
      <div className="fields"><Field label="Dia" htmlFor="lf-d"><input id="lf-d" type="date" value={dia} max={hoje} onChange={e => e.target.value && setDia(e.target.value)} /></Field></div>
      <div className="lj-contas">
        <div className="lj-conta edit"><label htmlFor="lf-t">Troco do começo</label><input id="lf-t" inputMode="decimal" value={troco} onChange={e => setTroco(soNumero(e.target.value))} aria-label="Troco que tinha na gaveta no começo do dia" /></div>
        <Linha l="Vendas em dinheiro" v={G.vendas} sinal="+ " />
        {G.reforcos > 0 && <Linha l="Dinheiro posto" v={G.reforcos} sinal="+ " />}
        {G.gastos > 0 && <Linha l="Gastos pagos da gaveta" v={G.gastos} sinal="− " />}
        {G.retiradas > 0 && <Linha l="Dinheiro tirado" v={G.retiradas} sinal="− " />}
        <div className="lj-conta total"><span>Deveria ter na gaveta</span><b className="num">{brlReal(esperado)}</b></div>
      </div>
      {ms.length > 0 && <div className="lj-movs">{ms.map(m => <button key={m.id} className="lj-mov" onClick={() => act.abrirLoja("mov", { inicial: m })}>{m.tipo === "retirada" ? "Tirou" : "Pôs"} {brl(m.valor)}{m.desc ? ` · ${m.desc}` : ""} · {m.hora}</button>)}</div>}

      <div className="lj-contar">
        <div className="panel-head"><h3>Quanto tem na gaveta?</h3><button className="link" onClick={() => setVerNotas(!verNotas)}>{verNotas ? "Digitar o total" : "Contar por nota"}</button></div>
        {verNotas ? <div className="lj-cedulas">
          {CEDULAS.map(c => (
            <div key={c} className="lj-cedula">
              <span>{c >= 1 ? `R$ ${c}` : `${Math.round(c * 100)} ¢`}</span>
              <button className="icon-btn" onClick={() => setNotas(n => ({ ...n, [c]: Math.max(0, (n[c] || 0) - 1) }))} aria-label={`Menos uma de ${brlReal(c)}`}><I.minus /></button>
              <input inputMode="numeric" value={notas[c] || ""} onChange={e => setNotas(n => ({ ...n, [c]: Number(e.target.value.replace(/\D/g, "")) || 0 }))} placeholder="0" aria-label={`Quantas de ${brlReal(c)}`} />
              <button className="icon-btn" onClick={() => { vibrar("toque"); setNotas(n => ({ ...n, [c]: (n[c] || 0) + 1 })); }} aria-label={`Mais uma de ${brlReal(c)}`}><I.plus /></button>
            </div>
          ))}
          <div className="lj-conta total"><span>Contado</span><b className="num">{brlReal(somaNotas)}</b></div>
        </div> : <label className="big-amt" htmlFor="lf-c"><span>R$</span><input id="lf-c" inputMode="decimal" value={contado} onChange={e => setContado(soNumero(e.target.value))} placeholder="0,00" aria-label="Dinheiro contado na gaveta" /></label>}
      </div>
      {temContado && <div className={"lj-dif" + (Math.abs(dif) < 0.01 ? " ok" : dif > 0 ? " sobra" : " falta")}>
        {Math.abs(dif) < 0.01 ? <><I.check /><b>Bateu certinho</b></> : dif > 0 ? <><I.up /><span><b>Sobrou {brlReal(dif)}</b><small>Pode ser uma venda que não foi anotada.</small></span></> : <><I.down /><span><b>Faltou {brlReal(-dif)}</b><small>Confira se algum gasto ou troco não foi anotado.</small></span></>}
      </div>}
      {(T.porPag.pix > 0 || T.porPag.debito + T.porPag.credito > 0) && <div className="lj-conferir">
        <small>Confira também</small>
        {T.porPag.pix > 0 && <span>Pix no app do banco: <b className="num">{brlReal(T.porPag.pix)}</b></span>}
        {T.porPag.debito + T.porPag.credito > 0 && <span>Cartão na maquininha: <b className="num">{brlReal(T.porPag.debito + T.porPag.credito)}</b>{T.porPag.debito > 0 && T.porPag.credito > 0 ? ` (débito ${brlReal(T.porPag.debito)}, crédito ${brlReal(T.porPag.credito)})` : ""}</span>}
      </div>}
      {temContado && <div className="fields"><Field label="Fica de troco para amanhã" htmlFor="lf-x"><input id="lf-x" inputMode="decimal" value={deixou} onChange={e => setDeixou(soNumero(e.target.value))} placeholder={fmtNum(Math.min(contadoN, trocoN || contadoN))} /></Field></div>}
      <button className="btn mode" disabled={!temContado} onClick={salvar}><I.check /> {f ? "Salvar de novo" : "Fechar o caixa"}</button>
      <button className="btn ghost" onClick={mandar}><I.share /> Mandar o resumo do dia</button>
    </Sheet>
  );
}

// Voltou do mercado: os itens marcados viram um gasto (com o preço de cada um, se quiser)
function CompreiSheet({ L, onClose, act }) {
  const feitos = L.faltas.filter(x => x.feito);
  const [precos, setPrecos] = useState({});
  const [total, setTotal] = useState("");
  const [cat, setCat] = useState("insumos");
  const [daGaveta, setDaGaveta] = useState(false);
  const somaItens = Math.round(feitos.reduce((s, x) => s + num(precos[x.id] || 0), 0) * 100) / 100;
  const v = total.trim() ? num(total) : somaItens;
  const salvar = async () => {
    const itens = feitos.map(x => ({ nome: x.texto, qtd: x.qtd || 1, valor: num(precos[x.id] || 0) || null }));
    await L.salvar("gasto", { valor: v, desc: `Compras: ${feitos.map(x => x.texto).slice(0, 4).join(", ")}${feitos.length > 4 ? "…" : ""}`, cat, dia: todayISO(), daGaveta, itens, autor: L.eu, criado: Date.now() });
    // guarda o que sempre falta (para sugerir depois) e tira da lista
    const faltou = { ...(L.config.faltou || {}) };
    feitos.forEach(x => { const k = x.texto.toLowerCase(); faltou[k] = { texto: x.texto, n: ((faltou[k] && faltou[k].n) || 0) + 1 }; });
    await L.salvar("config", { ...L.config, id: "loja", faltou });
    feitos.forEach(x => L.apagar("falta", x.id));
    vibrar("ok"); act.toast(`Compra anotada: ${brlReal(v)}`); onClose();
  };
  return (
    <Sheet title="O que comprei" sub="Vira um gasto da loja" onClose={onClose}>
      <div className="lj-precos">
        {feitos.map(x => (
          <label key={x.id} className="lj-preco"><span>{x.qtd > 1 ? `${x.qtd}× ` : ""}{x.texto}</span><input inputMode="decimal" value={precos[x.id] || ""} onChange={e => setPrecos(p => ({ ...p, [x.id]: soNumero(e.target.value) }))} placeholder="R$ (opcional)" aria-label={`Preço de ${x.texto}`} /></label>
        ))}
      </div>
      <div className="fields"><Field label="Total da compra" htmlFor="lc-t"><input id="lc-t" inputMode="decimal" value={total} onChange={e => setTotal(soNumero(e.target.value))} placeholder={somaItens > 0 ? fmtNum(somaItens) : "0,00"} /></Field></div>
      <div className="casa-chips" role="radiogroup" aria-label="Categoria">{CATS_LOJA.slice(0, 3).map(x => <button key={x.id} type="button" className={cat === x.id ? "on" : ""} onClick={() => setCat(x.id)}>{x.nome}</button>)}</div>
      <Toggle on={daGaveta} onClick={() => setDaGaveta(!daGaveta)}>Paguei com o dinheiro da gaveta</Toggle>
      <button className="btn mode" disabled={!(v > 0)} onClick={salvar}><I.check /> Anotar {v > 0 ? brlReal(v) : "a compra"}</button>
    </Sheet>
  );
}

/* ---------- ajustes da loja: nome, Pix, equipe ---------- */
function AjustesSheet({ L, conta, onClose, act }) {
  const [nome, setNome] = useState(L.loja.nome);
  const [pix, setPix] = useState(L.config.pix || "");
  const [recebedor, setRecebedor] = useState(L.config.recebedor || "");
  const [cidade, setCidade] = useState(L.config.cidade || (conta.perfil && conta.perfil.cidade) || "");
  const [link, setLink] = useState(""), [ocupado, setOcupado] = useState(""), [erro, setErro] = useState("");
  const faz = async (k, fn) => { setOcupado(k); setErro(""); try { await fn(); } catch (e) { setErro(erroDe(e)); vibrar("erro"); } setOcupado(""); };
  const ajudantes = L.membros.filter(m => m.id !== L.loja.dono);
  const salvar = () => faz("salvar", async () => {
    if (L.souDona && nome.trim() && nome.trim() !== L.loja.nome) await L.renomear(nome);
    if (L.souDona) await L.salvar("config", { ...L.config, id: "loja", pix: pix.trim(), recebedor: recebedor.trim(), cidade: cidade.trim() });
    vibrar("ok"); act.toast("Loja salva"); onClose();
  });
  const convidar = () => {
    if (!podeEquipe(act)) return act.pedirPro("loja-equipe");
    faz("convite", async () => {
      const url = await L.convidar(); setLink(url);
      const texto = `${primeiroNome(conta.nome)} te chamou para ajudar a anotar o caixa da ${L.loja.nome} no Avina. Abra o link, crie sua conta (é grátis para quem ajuda) e você entra na loja.`;
      if (navigator.share) { try { await navigator.share({ title: "Convite para a loja", text: texto, url }); } catch (e) {} }
    });
  };
  return (
    <Sheet title="Ajustes da loja" sub={L.loja.nome} onClose={onClose}>
      {L.souDona ? <>
        <div className="fields"><Field label="Nome da loja" htmlFor="la-n"><input id="la-n" value={nome} onChange={e => setNome(e.target.value)} maxLength={60} /></Field></div>
        <div className="fields"><Field label="Chave Pix da loja" htmlFor="la-p"><input id="la-p" value={pix} onChange={e => setPix(e.target.value)} placeholder="Celular, e-mail, CPF/CNPJ ou chave aleatória" autoComplete="off" /></Field></div>
        <div className="hint">Com a chave, a venda no Pix mostra um QR code com o valor certo para o cliente.</div>
        {pix.trim() && <div className="fields duas">
          <Field label="Nome no Pix" htmlFor="la-r"><input id="la-r" value={recebedor} onChange={e => setRecebedor(e.target.value)} placeholder={L.loja.nome} maxLength={25} /></Field>
          <Field label="Cidade" htmlFor="la-c"><input id="la-c" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Sua cidade" maxLength={15} /></Field>
        </div>}
        <button className="btn mode" disabled={!!ocupado} onClick={salvar}><I.check /> Salvar</button>
      </> : <div className="hint">Quem cuida dos ajustes é {nomeDe(L, L.loja.dono)}, que criou a loja.</div>}

      <div className="panel-head lj-equipe-h"><h3>Equipe</h3>{!act.lojaPro && L.souDona && <span className="pro-selo">PRO</span>}</div>
      <div className="lj-equipe">
        {L.membros.map(m => (
          <div key={m.id} className="lj-membro">
            <Pessoa m={m} />
            <span className="mid"><b>{m.id === L.eu ? "Você" : m.nome}</b><small>{m.id === L.loja.dono ? "Criou a loja" : m.veLucro ? "Ajudante · vê o lucro" : "Ajudante · só anota"}</small></span>
            {L.souDona && m.id !== L.eu && <span className="lj-lucro"><Toggle on={!!m.veLucro} onClick={() => faz("lucro", () => L.deixarVerLucro(m.id, !m.veLucro))}>Lucro</Toggle></span>}
          </div>
        ))}
      </div>
      {L.souDona && ajudantes.length > 0 && <div className="hint">Com a chave ligada, o ajudante vê os gastos, o lucro e o resumo. Desligada, ele só anota vendas, gastos e fecha o caixa.</div>}
      {L.souDona && ajudantes.length < MAX_AJUDANTES && L.nuvem && (
        <button className="casa-convite" onClick={convidar} disabled={ocupado === "convite"}>
          <span className="ic"><I.share /></span>
          <span className="tx"><b>{ocupado === "convite" ? "Criando o link…" : "Convidar quem ajuda"}</b><small>{podeEquipe(act) ? `Até ${MAX_AJUDANTES} ajudantes, cada um no seu celular. O link vale 7 dias.` : "A equipe faz parte do Pro Loja."}</small></span>
          <I.chev />
        </button>
      )}
      {link && <div className="casa-link"><span>{link}</span><button className="bub-act" onClick={() => { try { navigator.clipboard.writeText(link); act.toast("Link copiado"); } catch (e) {} }}>Copiar</button><button className="bub-act" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Entre na ${L.loja.nome} no Avina: ${link}`)}`, "_blank", "noopener")}>WhatsApp</button></div>}
      {erro && <div className="error">{erro}</div>}
      <div className="casa-fim">
        {L.souDona && ajudantes.map(m => <ConfirmButton key={m.id} label={`Tirar ${m.nome} da loja`} titulo={`Tirar ${m.nome}?`} texto="A pessoa deixa de ver a loja. O que ela anotou continua." acao="Tirar" onConfirm={() => faz("tirar", () => L.tirar(m.id))} />)}
        <ConfirmButton label="Sair da loja" titulo="Sair da loja?" texto={L.membros.length < 2 ? "A loja e tudo o que foi anotado nela somem." : L.souDona ? "Você deixa de ver a loja. Quem entrou primeiro passa a cuidar dela." : "Você deixa de ver a loja."} acao="Sair" onConfirm={() => faz("sair", async () => { await L.sair(); onClose(); })} />
      </div>
    </Sheet>
  );
}

// Abriu um link de convite: mostra de quem é a loja e entra
function ConviteSheet({ L, token, onClose, onEntrou }) {
  const [info, setInfo] = useState(null), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!L.nuvem) { setErro("Para entrar numa loja, use a sua conta com e-mail e senha."); return; }
    L.verConvite(token).then(i => i && i.valido ? setInfo(i) : setErro(erroDe("convite invalido"))).catch(e => setErro(erroDe(e)));
  }, [token]);
  const entrar = async () => { setOcupado(true); try { await L.entrar(token); vibrar("ok"); onEntrou && onEntrou(); onClose(); } catch (e) { setErro(erroDe(e)); setOcupado(false); } };
  return (
    <Sheet title="Convite para a loja" onClose={onClose}>
      <div className="casa-intro"><Ilustra n="dinheiro" />
        {info ? <p><b>{info.convidou || "Alguém"}</b> te chamou para ajudar na <b>“{info.loja}”</b>.<br /><br />Você vai anotar as vendas, os gastos e fechar o caixa junto com a equipe. <b>Seus dados pessoais continuam só seus.</b><br /><br /><b>Para quem ajuda, é grátis.</b></p>
          : !erro ? <p>Abrindo o convite…</p> : null}
      </div>
      {erro && <div className="error">{erro}</div>}
      {info && <button className="btn mode" disabled={ocupado} onClick={entrar}><I.check /> {ocupado ? "Entrando…" : "Entrar na loja"}</button>}
      <button className="btn text" onClick={onClose}>Agora não</button>
    </Sheet>
  );
}

// Nota do fornecedor (QR code ou foto): vira um gasto de insumos com os itens; o que estava faltando sai da lista
function NotaLoja({ L, servidor, onClose, act }) {
  const lista = L.faltas.map(x => ({ ...x, texto: x.texto }));
  const salvar = async (n, naNota) => {
    await L.salvar("gasto", { valor: n.total, desc: nomeLoja(n.loja) || "Compra com nota", cat: "insumos", dia: n.data || todayISO(), nota: n, autor: L.eu, criado: Date.now() });
    naNota.forEach(x => L.apagar("falta", x.id));
    vibrar("ok"); act.toast(naNota.length ? `Compra salva · ${naNota.length} ${naNota.length === 1 ? "item saiu" : "itens saíram"} da lista` : "Compra salva com a nota");
  };
  return <NotaSheet casa={null} servidor={servidor} onClose={onClose} act={act} lista={lista} onSalvar={salvar} titulo="Nota do fornecedor" onSemNota={() => { onClose(); setTimeout(() => act.abrirLoja("gasto", {}), 250); }} />;
}
