// Parte do app carregada sob demanda: dinheiro a dois (ou em família)
import React, { useEffect, useMemo, useState } from "react";
import { I, Sheet, Field, Seg, Money, brl, brlReal, num, soNumero, fmtNum, todayISO, addDays, MES_LONGO, pad, dm, relativo, vibrar, Ilustra, ConfirmButton, iniciais, CATEGORIAS, catDe, catVars, CatIcon, TopBar, useCamada } from "../App.jsx";
import { saldos, partes, pesosDe, MAX_PESSOAS } from "../casa.js";
import { historico, ultimoPreco, combina, lerItem, secaoDe, nomeSecao, SECOES, ehLinkNfce, lerTextoNota, ufDaChave, lerPaginaNfce, arrumarNotaIA, reduzirFoto, nomeLoja, cnpjDaChave } from "../nota.js";
import { buscarCnpj } from "../cnpj.js";
import { lerQRs } from "./ferramentas.jsx";
import { Anel, CatBolinha, Linha, useContagem } from "./visual.jsx";
// gerador de QR code (zxing, o mesmo do leitor): só carrega quando alguém pede o QR do convite
import wasmEscritor from "zxing-wasm/writer/zxing_writer.wasm?url";
// visual da página da casa (fica junto com esta parte do app, que carrega sob demanda)
import "../casa.css";

const VAGAS = ["Parceiro(a)", "Mãe ou pai", "Filho(a)", "Amigo(a)"];
const Pessoa = ({ m, grande }) => <span className={"casa-av" + (grande ? " grande" : "")}>{m.foto ? <img src={m.foto} alt="" /> : iniciais(m.nome || "?")}</span>;
const ERROS = [[/ja tem casa/, "Você já está numa casa. Para entrar nesta, saia da outra primeiro."], [/casa cheia/, "Essa casa já tem 5 pessoas."], [/convite invalido/, "Esse convite venceu ou não existe. Peça um link novo."], [/sem login/, "Entre na sua conta para continuar."]];
const erroDe = e => { const t = String((e && e.message) || e); const m = ERROS.find(([r]) => r.test(t)); return m ? m[1] : "Não consegui falar com a nuvem. Confira a internet e tente de novo."; };
const nomeDe = (C, id) => id === C.eu ? "Você" : ((C.membros.find(m => m.id === id) || {}).nome || "Alguém");
const mesDe = off => { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth() + off, 1); return { ch: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, nome: MES_LONGO[m.getMonth()], curto: MES_LONGO[m.getMonth()].slice(0, 3), ano: m.getFullYear() }; };
const Mai = s => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

/* ---------- a página da casa (aba do modo Pessoal, com o fundo do app) ----------
   No celular, uma coluna na ordem do que mais importa: o mês (total, ritmo e o gráfico), quem deve quanto,
   os atalhos, para onde foi, contas, lista de compras e os gastos do dia a dia. No computador, duas colunas:
   o mês e os gastos à esquerda; contas, compras e a casa em si à direita. (As colunas viram "display: contents"
   no celular e cada bloco tem a sua posição em "order": ver src/casa.css.) */
const soma = ls => ls.reduce((s, l) => s + (Number(l.valor) || 0), 0);
const diaDe = iso => Number(String(iso).slice(8, 10));
const diasNoMes = ch => { const [a, m] = ch.split("-").map(Number); return new Date(a, m, 0).getDate(); };
// Cada bloco da página: a posição no celular (order) e o atraso da entrada (--i)
const Bloco = ({ o, children, className = "" }) => <div className={"c2-bloco " + className} style={{ order: o, "--i": Math.min(o, 9) }}>{children}</div>;

export function CasaPagina({ casa: C, conta, pix, act, tema }) {
  useCamada(() => act.setTab("p-home"), { escurece: false }); // voltar do Android volta ao Início
  const voltar = () => act.setTab("p-home");
  const [nomeCasa, setNomeCasa] = useState("Nossa casa");
  const [link, setLink] = useState("");
  const [off, setOff] = useState(0);
  const [cat, setCat] = useState(null); // categoria escolhida nos cartões: filtra os gastos
  const [ocupado, setOcupado] = useState(""), [erro, setErro] = useState("");
  const [novoNome, setNovoNome] = useState(null); // null = não está mudando o nome
  const [verQR, setVerQR] = useState(false);
  const faz = async (k, fn) => { setOcupado(k); setErro(""); try { await fn(); } catch (e) { setErro(erroDe(e)); vibrar("erro"); } setOcupado(""); };

  if (!C.casa) return (
    <div className="page casa-pg c2">
      <TopBar eyebrow="Dinheiro a dois" title="Nossa casa" act={act} tema={tema} voltar={voltar} />
      <section className="panel casa-criar c2-criar">
        {C.estado === "carregando" ? <p className="hint">Abrindo a casa…</p> : <>
          <div className="c2-criar-topo"><Ilustra n="dinheiro" /><div><b>As contas da casa, sem planilha</b><small>Cada um anota o que pagou e o app mostra quem deve quanto.</small></div></div>
          <ul className="c2-criar-lista">
            <li><i><I.users /></i><span><b>Até 5 pessoas</b>, cada uma no próprio celular</span></li>
            <li><i><I.check /></i><span><b>Divide igual ou pela renda</b> e faz as contas sozinho</span></li>
            <li><i><I.receipt /></i><span><b>Contas, lista de compras</b> e notas do mercado num lugar só</span></li>
            <li><i><I.lock /></i><span><b>Seus gastos continuam seus.</b> Só vai para a casa o que você escolher</span></li>
            <li><i><I.star /></i><span><b>De graça para todos</b> que você convidar</span></li>
          </ul>
          <div className="fields"><Field label="Nome da casa" htmlFor="c-nome"><input id="c-nome" value={nomeCasa} onChange={e => setNomeCasa(e.target.value)} placeholder="Ex.: Nossa casa, Apê" maxLength={60} /></Field></div>
          {erro && <div className="error">{erro}</div>}
          <button className="btn mode" disabled={!!ocupado} onClick={() => faz("criar", () => C.criar(nomeCasa.trim()))}><I.check /> {ocupado ? "Criando…" : "Criar a casa"}</button>
          {!C.nuvem && <div className="hint">Sem a nuvem, a casa fica só neste aparelho. Com a sua conta, ela fica na nuvem e cada pessoa usa o próprio celular.</div>}
        </>}
      </section>
    </div>
  );

  const souDono = C.casa.dono === C.eu;
  const mes = mesDe(off), ant = mesDe(off - 1);
  const doMes = C.lanc.filter(l => (l.data || "").startsWith(mes.ch)).sort((a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0));
  const doAnt = C.lanc.filter(l => (l.data || "").startsWith(ant.ch));
  const { dividas } = saldos(C.lanc, C.acertos, C.membros);
  const sozinho = C.membros.length < 2;
  const trocarMes = k => { setOff(k); setCat(null); vibrar("toque"); };
  const convidar = () => faz("convite", async () => {
    const url = await C.convidar(); setLink(url); setVerQR(false);
    if (navigator.share && C.nuvem) { try { await navigator.share({ title: "Convite para a casa", text: textoConvite(), url }); } catch (e) {} }
  });
  // QR code: para convidar pessoalmente (a pessoa aponta a câmera) ou mandar como imagem
  const mostrarQR = () => { if (verQR) return setVerQR(false); if (link) return setVerQR(true); faz("convite", async () => { setLink(await C.convidar()); setVerQR(true); }); };
  const textoConvite = () => `${conta.nome} te chamou para dividir as contas da casa "${C.casa.nome}" no Avina. É grátis: abra o link, crie sua conta e você entra na casa.`;
  const mandarZap = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${textoConvite()}
${link}`)}`, "_blank", "noopener");
  const acertar = d => faz("acerto", async () => { await C.salvar("acerto", { de: d.de, para: d.para, valor: d.valor, data: todayISO(), criado: Date.now(), autor: C.eu }); vibrar("ok"); act.toast(`Acertado: ${brlReal(d.valor)}`); });
  // lembrete educado pelo WhatsApp (abre o WhatsApp com a mensagem pronta; a pessoa escolhe o contato)
  const lembrar = d => {
    const msg = `Oi, ${nomeDe(C, d.de)}! Pelas contas da casa "${C.casa.nome}", ficou ${brlReal(d.valor)} para você me passar.${pix ? ` Meu Pix: ${pix}` : ""} Obrigado(a)! 💚`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };
  const pessoas = (
    <section className="panel c2-pessoas">
      <div className="panel-head"><h3>{sozinho ? "Chame quem mora com você" : "Quem mora aqui"}</h3>{!sozinho && <small>{C.membros.length} de {MAX_PESSOAS}</small>}</div>
      {sozinho && <p className="c2-pessoas-txt">A casa fica boa com mais gente: cada um anota o que pagou e o app divide. Quem você chamar entra de graça.</p>}
      <div className="c2-gente">
        {C.membros.map(m => (
          <div key={m.id} className="c2-gente-p">
            <span className="c2-gente-av"><Pessoa m={m} grande />{m.papel === "dono" && <i aria-label="Criou a casa"><I.star /></i>}</span>
            <small>{m.id === C.eu ? "Você" : m.nome}</small>
          </div>
        ))}
        {C.membros.length < MAX_PESSOAS && <button className="c2-gente-p vaga" onClick={convidar} aria-label="Convidar alguém"><span className="c2-gente-av"><span className="casa-av grande"><I.plus /></span></span><small>Convidar</small></button>}
      </div>
      {C.membros.length < MAX_PESSOAS && <div className="c2-convite">
        <button className="c2-convite-b" onClick={convidar} disabled={ocupado === "convite"}><I.share /><span><b>{ocupado === "convite" && !verQR ? "Criando…" : "Mandar link"}</b><small>pelo WhatsApp</small></span></button>
        <button className={"c2-convite-b" + (verQR ? " on" : "")} onClick={mostrarQR} disabled={ocupado === "convite"} aria-expanded={verQR}><I.scan /><span><b>{verQR ? "Esconder QR" : "QR code"}</b><small>pessoalmente</small></span></button>
      </div>}
      {verQR && link && <QRConvite link={link} casa={C.casa.nome} quem={conta.nome} act={act} />}
      {link && <div className="casa-link"><span>{link}</span><button className="bub-act" onClick={() => { try { navigator.clipboard.writeText(link); act.toast("Link copiado"); } catch (e) {} }}>Copiar</button>{C.nuvem && <button className="bub-act" onClick={mandarZap}>WhatsApp</button>}</div>}
      {!C.nuvem && link && C.membros.length < MAX_PESSOAS && <button className="link" onClick={C.simularEntrada}>Teste: simular alguém aceitando o convite</button>}
      {C.membros.length < MAX_PESSOAS && <small className="c2-nota">O convite vale 7 dias. Quem entra só vê os gastos da casa, nunca os seus pessoais.</small>}
      {erro && <div className="error">{erro}</div>}
    </section>
  );

  return (
    <div className="page casa-pg c2">
      <TopBar eyebrow={sozinho ? "Dinheiro a dois" : `${C.membros.length} pessoas`} title={C.casa.nome} act={act} tema={tema} voltar={voltar}
        extra={!sozinho && <span className="c2-rostos" aria-label={C.membros.map(m => nomeDe(C, m.id)).join(", ")}>{C.membros.slice(0, 4).map(m => <Pessoa key={m.id} m={m} />)}</span>} />
      <div className="c2-grade">
        <div className="c2-col">
          <Bloco o={1}><MesDaCasa mes={mes} ant={ant} off={off} itens={doMes} doAnt={doAnt} onMes={trocarMes} /></Bloco>
          {sozinho ? <Bloco o={2}>{pessoas}</Bloco>
            : <Bloco o={2}><CartaoSaldo C={C} mes={mes} itens={doMes} dividas={dividas} ocupado={ocupado} onAcertar={acertar} onLembrar={lembrar} /></Bloco>}
          <Bloco o={3}>
            <div className="c2-acoes">
              <button className="c2-acao principal" onClick={() => act.abrirGastoCasa()}><I.plus /><span>Anotar gasto</span></button>
              <button className="c2-acao" onClick={() => act.lerNotaCasa()}><I.receipt /><span>Ler nota</span></button>
              <button className="c2-acao" onClick={() => act.trazerParaCasa()}><I.upload /><span>Dos meus gastos</span></button>
            </div>
          </Bloco>
          {doMes.length > 0 && <Bloco o={4}><Categorias itens={doMes} doAnt={doAnt} ant={ant} sel={cat} onSel={c => { setCat(cat === c ? null : c); vibrar("toque"); }} /></Bloco>}
          <Bloco o={7}><GastosDoMes C={C} mes={mes} itens={doMes} cat={cat} onCat={setCat} act={act} sozinho={sozinho} /></Bloco>
        </div>

        <div className="c2-col">
          <Bloco o={5}><ContasDaCasa C={C} act={act} /></Bloco>
          <Bloco o={6}><ListaCompras C={C} act={act} /></Bloco>
          <Bloco o={8}><MercadoCasa C={C} act={act} /></Bloco>
          {!sozinho && doMes.length > 0 && <Bloco o={9}><section className="panel"><div className="panel-head"><h3>Quem pagou em {mes.nome}</h3></div><GraficoQuem C={C} itens={doMes} /></section></Bloco>}
          <Bloco o={10}><GraficoMeses C={C} off={off} onEscolher={trocarMes} /></Bloco>
          {!sozinho && <Bloco o={11}><ComoDividem C={C} /></Bloco>}
          {!sozinho && <Bloco o={12}>{pessoas}</Bloco>}
          <Bloco o={13}>
            <section className="c2-ajustes">
              {souDono && (novoNome === null
                ? <button className="c2-ajuste" onClick={() => setNovoNome(C.casa.nome)}><I.pencil /> Mudar o nome da casa</button>
                : <form className="nota-link" onSubmit={e => { e.preventDefault(); faz("nome", async () => { await C.renomear(novoNome); setNovoNome(null); act.toast("Nome da casa mudado"); }); }}>
                    <input value={novoNome} onChange={e => setNovoNome(e.target.value)} maxLength={60} aria-label="Nome da casa" autoFocus />
                    <button type="submit" className="bub-act" disabled={!novoNome.trim() || ocupado === "nome"}>Salvar</button>
                    <button type="button" className="bub-act" onClick={() => setNovoNome(null)}>Cancelar</button>
                  </form>)}
              {souDono && C.membros.filter(m => m.id !== C.eu).map(m => <ConfirmButton key={m.id} label={`Tirar ${m.nome} da casa`} titulo={`Tirar ${m.nome}?`} texto="A pessoa deixa de ver os gastos da casa. O que ela anotou continua." acao="Tirar" onConfirm={() => faz("tirar", () => C.tirar(m.id))} />)}
              <ConfirmButton label="Sair da casa" titulo="Sair da casa?" texto={sozinho ? "A casa e os gastos dela somem." : souDono ? "Você deixa de ver os gastos da casa. Quem entrou primeiro passa a cuidar dela." : "Você deixa de ver os gastos da casa."} acao="Sair" onConfirm={() => faz("sair", () => C.sair())} />
            </section>
          </Bloco>
        </div>
      </div>
    </div>
  );
}

/* ---------- o mês da casa: total grande, comparação justa com o mês passado e a linha do mês ---------- */
// No mês atual, compara com o mês passado até o mesmo dia (senão o mês corrente sempre "gasta menos").
function MesDaCasa({ mes, ant, off, itens, doAnt, onMes }) {
  const atual = off === 0, hoje = todayISO();
  const ateDia = atual ? diaDe(hoje) : 31;
  const total = soma(itens), totalAnt = soma(doAnt.filter(l => diaDe(l.data) <= ateDia));
  const dif = total - totalAnt;
  const v = useContagem(total);
  // gasto acumulado dia a dia: este mês (até hoje) e o mês passado inteiro, para ver o ritmo
  const acum = (ls, n) => { const p = Array(n).fill(0); ls.forEach(l => { const d = diaDe(l.data); if (d >= 1 && d <= n) p[d - 1] += Number(l.valor) || 0; }); let s = 0; return p.map(x => (s += x)); };
  const nA = diasNoMes(mes.ch), nB = diasNoMes(ant.ch);
  const serieA = acum(itens, nA).slice(0, atual ? diaDe(hoje) : nA), serieB = acum(doAnt, nB);
  const temA = serieA.length > 1 && total > 0, temB = (serieB[nB - 1] || 0) > 0;
  const frase = !total && !totalAnt ? "Nada anotado ainda"
    : !totalAnt ? `Primeiro mês com gastos da casa`
    : Math.abs(dif) < 1 ? `Igual a ${ant.nome}${atual ? ` até o dia ${ateDia}` : ""}`
    : `${brl(Math.abs(dif))} ${dif > 0 ? "a mais" : "a menos"} que ${ant.nome}${atual ? ` até o dia ${ateDia}` : ""}`;
  return (
    <section className="c2-mes" aria-label={`Gastos da casa em ${mes.nome}`}>
      <div className="c2-mes-nav">
        <button className="icon-btn" onClick={() => onMes(off - 1)} aria-label="Mês anterior"><I.chevL /></button>
        <span>Gasto da casa em <b>{mes.nome}</b>{mes.ano !== new Date().getFullYear() ? ` de ${mes.ano}` : ""}</span>
        <button className="icon-btn" onClick={() => onMes(off + 1)} aria-label="Próximo mês" disabled={off >= 0}><I.chev /></button>
      </div>
      <div className="c2-total"><Money v={v} /></div>
      <div className={"c2-dif" + (totalAnt && Math.abs(dif) >= 1 ? (dif > 0 ? " sobe" : " desce") : "")}>
        {totalAnt > 0 && Math.abs(dif) >= 1 && <i aria-hidden="true">{dif > 0 ? "↑" : "↓"}</i>}<span>{frase}</span>
      </div>
      {(temA || temB) && <div className="c2-linha" key={mes.ch}>
        <Linha n={Math.max(nA, nB)} series={[...(temB ? [{ v: serieB, fantasma: true }] : []), ...(temA ? [{ v: serieA }] : [])]}
          legenda={[{ t: Mai(mes.nome) }, ...(temB ? [{ t: Mai(ant.nome), fantasma: true }] : [])]} rotuloDir={atual ? "hoje" : `${nA} ${mes.curto}`}
          rotulo={`Ritmo de gastos: ${brlReal(total)} em ${mes.nome}${temB ? `, contra ${brlReal(serieB[nB - 1])} no mês de ${ant.nome} inteiro` : ""}`} />
      </div>}
    </section>
  );
}

/* ---------- quem deve quanto, no jeito de um cartão de orçamento: o anel é quanto você pagou da casa no mês ---------- */
function CartaoSaldo({ C, mes, itens, dividas, ocupado, onAcertar, onLembrar }) {
  const total = soma(itens);
  let pagou = 0, justo = 0;
  itens.forEach(l => { if (l.pagou === C.eu) pagou += l.valor; justo += (partes(l, C.membros)[C.eu] || 0); });
  const p = total > 0 ? pagou / total : 0;
  const minhas = dividas.filter(d => d.de === C.eu || d.para === C.eu), outras = dividas.filter(d => !minhas.includes(d));
  const principal = minhas[0];
  const titulo = principal ? (principal.para === C.eu ? <><b>{nomeDe(C, principal.de)}</b> te deve <b className="num">{brl(principal.valor)}</b></> : <>Você deve <b className="num">{brl(principal.valor)}</b> para <b>{nomeDe(C, principal.para)}</b></>)
    : dividas.length ? <>Com você, <b>tudo certo</b></> : <><b>Tudo acertado</b> entre vocês</>;
  const sub = total > 0 ? `Em ${mes.nome}, você pagou ${pct(pagou, total)}% dos gastos da casa. A sua parte é ${pct(justo, total)}%.` : `Nenhum gasto da casa em ${mes.nome} ainda.`;
  return (
    <section className="c2-saldo">
      <div className="c2-saldo-topo">
        <Anel p={total > 0 ? p : dividas.length ? 0 : 1} cor={principal && principal.de === C.eu ? "var(--amber)" : "var(--mode)"}>{total > 0 ? <b>{pct(pagou, total)}%</b> : <I.check />}</Anel>
        <div className="c2-saldo-tx"><span className="c2-saldo-t">{titulo}</span><small>{sub}</small></div>
      </div>
      {minhas.map((d, k) => (
        <div key={k} className="c2-saldo-acts">
          {k > 0 && <span className="c2-saldo-mais">{d.para === C.eu ? `${nomeDe(C, d.de)} te deve ${brl(d.valor)}` : `Você deve ${brl(d.valor)} para ${nomeDe(C, d.para)}`}</span>}
          {d.para === C.eu && <button className="c2-btn" onClick={() => onLembrar(d)}>Lembrar no WhatsApp</button>}
          <button className="c2-btn forte" disabled={!!ocupado} onClick={() => onAcertar(d)}><I.check />{d.de === C.eu ? "Já paguei" : "Recebi"}</button>
        </div>
      ))}
      {outras.map((d, k) => <div key={"o" + k} className="c2-saldo-outra">{nomeDe(C, d.de)} deve {brl(d.valor)} para {nomeDe(C, d.para)}</div>)}
      <Acertos C={C} />
    </section>
  );
}

/* ---------- para onde foi: cartões que rolam de lado, com o anel da fatia do mês; tocar filtra os gastos ---------- */
function Categorias({ itens, doAnt, ant, sel, onSel }) {
  const por = {}, porAnt = {};
  itens.forEach(l => { const c = l.cat || "casa"; por[c] = (por[c] || 0) + l.valor; });
  doAnt.forEach(l => { const c = l.cat || "casa"; porAnt[c] = (porAnt[c] || 0) + l.valor; });
  const cats = Object.entries(por).sort((a, b) => b[1] - a[1]), tot = soma(itens);
  return (
    <section className="c2-cats" aria-label="Para onde foi">
      <div className="vz-head"><h3>Para onde foi</h3>{sel && <button className="link" onClick={() => onSel(sel)}>Ver tudo</button>}</div>
      <div className="vz-trilho" role="group">
        {cats.map(([c, v]) => { const ct = catDe(c), a = porAnt[c] || 0; return (
          <button key={c} type="button" className={"vz-card" + (sel === c ? " on" : sel ? " apaga" : "")} aria-pressed={sel === c} onClick={() => onSel(c)} style={{ "--gc": `var(--g-${c}, var(--mode))` }}>
            <CatBolinha cat={ct} p={tot > 0 ? v / tot : 0} tam={50} />
            <span className="vz-card-n">{ct.nome}</span>
            <b className="num vz-card-v">{brl(v)}</b>
            <small>{pct(v, tot)}% do mês{a > 0 ? ` · ${v > a ? "↑" : v < a ? "↓" : "="} ${ant.curto}` : ""}</small>
          </button>
        ); })}
      </div>
    </section>
  );
}

/* ---------- gastos do mês, por dia (com o total do mês no título) ---------- */
function GastosDoMes({ C, mes, itens, cat, onCat, act, sozinho }) {
  const lista = cat ? itens.filter(l => (l.cat || "casa") === cat) : itens;
  const dias = []; lista.forEach(l => { const g = dias[dias.length - 1]; if (g && g.data === l.data) g.itens.push(l); else dias.push({ data: l.data, itens: [l] }); });
  const rotulo = d => { const r = relativo(d); return /^(hoje|ontem)$/i.test(r) ? r : `${diaDe(d)} de ${mes.nome}`; };
  return (
    <section className="panel c2-gastos">
      <div className="c2-gastos-topo">
        <h3>{Mai(mes.nome)} <span>{mes.ano}</span></h3>
        <b className="num"><Money v={soma(lista)} /></b>
      </div>
      {cat && <button className="c2-filtro" onClick={() => onCat(null)}><span className="ci" style={catVars(catDe(cat))}><CatIcon cat={catDe(cat)} /></span>Só {catDe(cat).nome.toLowerCase()}<I.x /></button>}
      {lista.length === 0 && <div className="empty">Nenhum gasto da casa em {mes.nome}. {sozinho ? "Convide alguém e anotem juntos." : "Quem pagar, anota aqui."}</div>}
      {dias.map(g => (
        <div key={g.data} className="c2-dia">
          <div className="c2-dia-t"><span>{rotulo(g.data)}</span>{g.itens.length > 1 && <small className="num">{brl(soma(g.itens))}</small>}</div>
          {g.itens.map(l => { const ct = catDe(l.cat || "casa"); const so = l.participantes && l.participantes.length === 1; const quem = C.membros.find(m => m.id === l.pagou); return (
            <button key={l.id} className="casa-gasto c2-gasto" onClick={() => act.abrirGastoCasa(l)}>
              <span className="ci" style={catVars(ct)}><CatIcon cat={ct} /></span>
              <span className="mid"><b>{l.desc || ct.nome}</b><small>{nomeDe(C, l.pagou)} pagou{so ? " · só para mostrar" : l.pesos ? " · proporcional" : l.participantes && l.participantes.length < C.membros.length ? ` · entre ${l.participantes.length}` : ""}{l.nota ? " · com nota" : ""}{l.contaId ? " · conta da casa" : ""}</small></span>
              <span className="amt num"><Money v={l.valor} /></span>
              {!sozinho && quem && <span className="c2-gasto-quem" aria-hidden="true"><Pessoa m={quem} /></span>}
            </button>
          ); })}
        </div>
      ))}
    </section>
  );
}

/* ---------- QR code do convite ---------- */
let ESCRITOR = null;
const escritorQR = () => ESCRITOR || (ESCRITOR = import("zxing-wasm/writer").then(m => { m.prepareZXingModule({ overrides: { locateFile: (p, prefix) => (p.endsWith(".wasm") ? wasmEscritor : prefix + p) } }); return m; }));
// A imagem para mandar: fundo branco, o QR grande e o convite escrito embaixo (assim faz sentido sozinha no WhatsApp)
async function imagemConvite(svg, casa, quem) {
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const L = 720, c = document.createElement("canvas"); c.width = L; c.height = L + 190;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false; g.drawImage(img, 60, 50, L - 120, L - 120);
  g.fillStyle = "#14161c"; g.textAlign = "center";
  g.font = "700 34px system-ui, sans-serif"; g.fillText(`Convite para a casa “${casa}”`.slice(0, 44), L / 2, L - 10);
  g.font = "500 26px system-ui, sans-serif"; g.fillStyle = "#555b66";
  g.fillText(`${quem} te chamou no Avina. É grátis.`.slice(0, 52), L / 2, L + 40);
  g.fillText("Aponte a câmera do celular para entrar.", L / 2, L + 80);
  g.font = "500 22px system-ui, sans-serif"; g.fillText("O convite vale 7 dias.", L / 2, L + 130);
  return new Promise(ok => c.toBlob(ok, "image/png"));
}
function QRConvite({ link, casa, quem, act }) {
  const [svg, setSvg] = useState(null), [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true; setSvg(null); setFalhou(false);
    escritorQR().then(m => m.writeBarcode(link, { format: "QRCode", ecLevel: "M", withQuietZones: true }))
      .then(r => { if (vivo) r && r.svg ? setSvg(r.svg) : setFalhou(true); }).catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [link]);
  const mandar = async () => {
    try {
      const blob = await imagemConvite(svg, casa, quem), arq = new File([blob], "convite-avina.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [arq] })) { try { await navigator.share({ files: [arq], title: "Convite para a casa" }); } catch (e) {} return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = arq.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      act.toast("Imagem do convite salva");
    } catch (e) { act.toast("Não consegui gerar a imagem"); }
  };
  if (falhou) return <div className="hint">Não consegui gerar o QR code. Use o link.</div>;
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10, padding: "18px 16px 14px", borderRadius: 20, background: "#fff", color: "#14161c", textAlign: "center" }}>
      {svg ? <img src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)} alt={`QR code do convite para a casa ${casa}`} style={{ width: "min(230px, 70vw)", height: "auto", aspectRatio: "1", imageRendering: "pixelated" }} />
        : <div style={{ width: "min(230px, 70vw)", aspectRatio: "1", display: "grid", placeItems: "center", color: "#555b66", fontSize: 13 }}>Gerando o QR code…</div>}
      <b style={{ fontSize: 15 }}>Aponte a câmera do celular</b>
      <small style={{ color: "#555b66", fontSize: 12.5, lineHeight: 1.4 }}>Abre o convite para a casa “{casa}”. É grátis, e vale 7 dias.</small>
      {svg && <button type="button" className="bub-act" onClick={mandar}>Mandar como imagem</button>}
    </div>
  );
}

/* ---------- gráficos (cores de gráfico validadas para os dois temas: --g-<categoria>) ---------- */
// Os últimos meses da casa (só a partir do primeiro com gasto); tocar numa barra abre aquele mês
function GraficoMeses({ C, off, onEscolher }) {
  const todos = [-5, -4, -3, -2, -1, 0].map(k => { const m = mesDe(off + k); return { ...m, k: off + k, total: soma(C.lanc.filter(l => (l.data || "").startsWith(m.ch))) }; });
  const ini = todos.findIndex(m => m.total > 0), meses = ini < 0 ? [] : todos.slice(Math.min(ini, todos.length - 2));
  if (meses.filter(m => m.total > 0).length < 2) return null; // um mês só não é histórico
  const maior = Math.max(...meses.map(m => m.total), 1), media = soma(meses.filter(m => m.total > 0).map(m => ({ valor: m.total }))) / meses.filter(m => m.total > 0).length;
  return (
    <section className="panel c2-meses">
      <div className="panel-head"><h3>Mês a mês</h3><small>média {brl(media)}</small></div>
      <div className="g-meses c2-barras" role="group" aria-label="Gastos da casa mês a mês" style={{ "--n": meses.length }}>
        {meses.map((m, i) => (
          <button key={m.ch} type="button" className={"g-mes" + (m.k === off ? " on" : "")} disabled={m.k > 0} onClick={() => onEscolher(m.k)} title={`${Mai(m.nome)}: ${brlReal(m.total)}`} aria-label={`${Mai(m.nome)}: ${brlReal(m.total)}`} style={{ "--i": i }}>
            <small className="g-val">{m.total > 0 ? brl(m.total).replace(/,\d+$/, "") : ""}</small>
            <i style={{ height: `${Math.max(4, (m.total / maior) * 100)}%` }} />
            <span>{m.curto}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Quem pagou quanto, com a marca da parte justa de cada um (igual ou proporcional)
function GraficoQuem({ C, itens }) {
  const pagou = {}, justo = {};
  C.membros.forEach(m => { pagou[m.id] = 0; justo[m.id] = 0; });
  itens.forEach(l => { if (l.pagou in pagou) pagou[l.pagou] += l.valor; Object.entries(partes(l, C.membros)).forEach(([p, v]) => { justo[p] += v; }); });
  const maior = Math.max(...C.membros.map(m => Math.max(pagou[m.id], justo[m.id])), 1);
  return (
    <div className="g-quem">
      <b className="g-tit">Quem pagou</b>
      {C.membros.map(m => { const dif = pagou[m.id] - justo[m.id]; return (
        <div key={m.id} className="g-quem-l" title={`${nomeDe(C, m.id)} pagou ${brlReal(pagou[m.id])}; a parte justa é ${brlReal(justo[m.id])}`}>
          <span className="g-quem-n"><Pessoa m={m} />{nomeDe(C, m.id)}</span>
          <span className="g-quem-b"><i style={{ width: `${(pagou[m.id] / maior) * 100}%` }} /><em style={{ left: `${(justo[m.id] / maior) * 100}%` }} aria-hidden="true" /></span>
          <span className="g-quem-v"><b className="num">{brl(pagou[m.id])}</b><small>{Math.abs(dif) < 0.5 ? "na medida" : dif > 0 ? `+${brl(dif)} a mais` : `${brl(-dif)} a menos`}</small></span>
        </div>
      ); })}
      <small className="g-nota"><em aria-hidden="true" /> parte justa de cada um</small>
    </div>
  );
}

/* ---------- contas fixas da casa ---------- */
function ContasDaCasa({ C, act }) {
  const ch = todayISO().slice(0, 7), hoje = Number(todayISO().slice(8, 10));
  const lista = [...C.contas].sort((a, b) => a.dia - b.dia);
  const pagaEm = c => C.lanc.find(l => l.contaId === c.id && l.mes === ch);
  const pagar = async c => {
    const parts = C.membros.map(m => m.id);
    await C.salvar("lanc", { valor: c.valor, desc: c.nome, cat: c.cat || "casa", data: todayISO(), pagou: C.eu, participantes: parts, pesos: pesosDe(C.config, parts), contaId: c.id, mes: ch, criado: Date.now(), autor: C.eu });
    vibrar("ok"); act.toast(`${c.nome} paga e dividida`);
  };
  const aPagar = lista.filter(c => !pagaEm(c)).reduce((s, c) => s + c.valor, 0);
  return (
    <section className="panel casa-contas">
      <div className="panel-head"><h3>Contas da casa</h3>{aPagar > 0 && <small className="casa-contas-falta">{brl(aPagar)} a pagar</small>}</div>
      {lista.length === 0 && <div className="hint">Aluguel, luz, internet… Coloque as contas fixas da casa: quem pagar marca, e o valor já entra dividido.</div>}
      {lista.map(c => { const p = pagaEm(c), cat = catDe(c.cat || "casa"), atrasada = !p && c.dia < hoje; return (
        <div key={c.id} className={"casa-conta" + (p ? " paga" : atrasada ? " atrasada" : "")}>
          <button className="casa-conta-in" onClick={() => act.abrirContaCasa(c)}>
            <span className="ci" style={catVars(cat)}><CatIcon cat={cat} /></span>
            <span className="mid"><b>{c.nome}</b><small>{p ? `Paga por ${nomeDe(C, p.pagou)} · ${dm(p.data)}` : atrasada ? `Venceu dia ${c.dia}` : `Vence dia ${c.dia}`}</small></span>
            <span className="amt num">{brl(c.valor)}</span>
          </button>
          {!p ? <button className="bub-act" onClick={() => pagar(c)}>Paguei</button> : <span className="casa-conta-ok" aria-label="Paga"><I.check /></span>}
        </div>
      ); })}
      <button className="link" onClick={() => act.abrirContaCasa()}><I.plus /> Conta da casa</button>
    </section>
  );
}

export function ContaCasaSheet({ casa: C, inicial, onClose, act }) {
  const [nome, setNome] = useState(inicial ? inicial.nome : "");
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [dia, setDia] = useState(inicial ? String(inicial.dia) : "10");
  const [cat, setCat] = useState(inicial ? inicial.cat || "casa" : "casa");
  const ok = nome.trim() && num(valor) > 0 && Number(dia) >= 1 && Number(dia) <= 31;
  const SUG = ["Aluguel", "Condomínio", "Luz", "Água", "Internet", "Gás", "Diarista", "Streaming"];
  const salvar = async () => { await C.salvar("conta", { ...(inicial || {}), nome: nome.trim(), valor: num(valor), dia: Number(dia), cat, autor: (inicial && inicial.autor) || C.eu }); vibrar("ok"); act.toast(inicial ? "Conta atualizada" : `${nome.trim()} na casa`); onClose(); };
  return (
    <Sheet title={inicial ? "Conta da casa" : "Nova conta da casa"} sub="Todo mês, quem pagar marca e o valor entra dividido" onClose={onClose}>
      {!inicial && <div className="casa-chips">{SUG.map(s => <button key={s} type="button" className={nome === s ? "on" : ""} onClick={() => setNome(s)}>{s}</button>)}</div>}
      <div className="fields">
        <Field label="Nome" htmlFor="cc-n"><input id="cc-n" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Aluguel" autoComplete="off" /></Field>
      </div>
      <div className="fields duas">
        <Field label="Valor (R$)" htmlFor="cc-v"><input id="cc-v" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" /></Field>
        <Field label="Vence dia" htmlFor="cc-d"><input id="cc-d" inputMode="numeric" value={dia} onChange={e => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} /></Field>
      </div>
      <div className="casa-chips" role="radiogroup" aria-label="Categoria">{CATEGORIAS.filter(c => c.id !== "outros").slice(0, 6).map(c => <button key={c.id} type="button" className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)}>{c.nome}</button>)}</div>
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : "Colocar na casa"}</button>
      {inicial && <ConfirmButton label="Tirar esta conta" titulo={`Tirar ${inicial.nome}?`} texto="Ela some da casa. Os pagamentos que já foram anotados continuam." acao="Tirar" onConfirm={async () => { await C.apagar("conta", inicial.id); onClose(); }} />}
    </Sheet>
  );
}

/* ---------- lista de compras da casa (aparece na hora no celular de todos) ---------- */
function ListaCompras({ C, act }) {
  const [txt, setTxt] = useState("");
  const hist = useMemo(() => historico(C.lanc), [C.lanc]);
  const preco = x => { const u = ultimoPreco(hist, x.texto); return u ? { ...u, total: u.unit * (x.qtd || 1) } : null; };
  const ordem = Object.fromEntries([...SECOES.map(s => s[0]), "outros"].map((s, i) => [s, i]));
  const abertos = C.compras.filter(x => !x.feito).map(x => ({ ...x, secao: x.secao || secaoDe(x.texto) })).sort((a, b) => ordem[a.secao] - ordem[b.secao] || (a.criado || 0) - (b.criado || 0));
  const feitos = C.compras.filter(x => x.feito).sort((a, b) => (a.criado || 0) - (b.criado || 0));
  const comPreco = abertos.map(preco).filter(Boolean), estimado = comPreco.reduce((s, p) => s + p.total, 0);
  // o que a casa sempre compra e não está na lista (pelas notas): sugestão de "acabou?"
  const sugestoes = useMemo(() => Object.entries(hist).filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length)
    .map(([k]) => k.split(" ")[0]).filter((w, i, arr) => arr.indexOf(w) === i && !C.compras.some(x => combina(x.texto, w) || combina(w, x.texto))).slice(0, 6), [hist, C.compras]);
  const adicionar = textos => textos.forEach((s, i) => { const it = lerItem(s); if (it.texto) C.salvar("compra", { texto: it.texto, qtd: it.qtd, secao: secaoDe(it.texto), feito: false, criado: Date.now() + i, autor: C.eu }); });
  const add = e => { e.preventDefault(); const t = txt.trim(); if (!t) return; adicionar(t.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)); setTxt(""); vibrar("toque"); };
  const limpar = () => feitos.forEach(x => C.apagar("compra", x.id));
  const mandar = async () => {
    const linhas = abertos.map(x => `• ${x.qtd > 1 ? x.qtd + "× " : ""}${x.texto}`).join("\n");
    const texto = `Lista de compras (${C.casa.nome}):\n${linhas}`;
    if (navigator.share) { try { await navigator.share({ text: texto }); return; } catch (e) { if (e.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };
  const grupos = []; abertos.forEach(x => { const g = grupos[grupos.length - 1]; if (g && g.secao === x.secao) g.itens.push(x); else grupos.push({ secao: x.secao, itens: [x] }); });
  const Item = ({ x }) => { const p = !x.feito && preco(x); return (
    <div className={"casa-item" + (x.feito ? " feito" : "")}>
      <button className={"box " + (x.feito ? "done" : "up")} onClick={() => { vibrar("toque"); C.salvar("compra", { ...x, feito: !x.feito, por: C.eu }); }} aria-label={x.feito ? `Desmarcar ${x.texto}` : `Marcar ${x.texto}`}>{x.feito && <I.check />}</button>
      <span>{x.qtd > 1 && <b className="casa-item-q">{x.qtd}×</b>}{x.texto}{x.autor && x.autor !== C.eu ? <small> · {nomeDe(C, x.autor)}</small> : null}</span>
      {p && <small className="casa-item-p" title={`Último preço: ${brlReal(p.unit)} em ${p.loja}, ${dm(p.data)}`}>~{brl(p.total)}</small>}
      <button className="casa-item-x" onClick={() => C.apagar("compra", x.id)} aria-label={`Tirar ${x.texto}`}><I.x /></button>
    </div>
  ); };
  return (
    <section className="panel casa-compras">
      <div className="panel-head"><h3>Lista de compras</h3>{C.compras.length > 0 && <small>{feitos.length} de {C.compras.length}</small>}</div>
      <form className="casa-compras-add" onSubmit={add}>
        <input value={txt} onChange={e => setTxt(e.target.value)} placeholder="Adicionar (ex.: 2 leite, pão, café)" aria-label="Item da lista de compras" enterKeyHint="done" />
        <button type="submit" className="icon-btn" aria-label="Adicionar" disabled={!txt.trim()}><I.plus /></button>
      </form>
      {sugestoes.length > 0 && <div className="casa-sug"><small>Vocês sempre compram. Acabou?</small>{sugestoes.map(s => <button key={s} type="button" onClick={() => { adicionar([s]); vibrar("toque"); }}><I.plus />{s}</button>)}</div>}
      {C.compras.length === 0 && <div className="hint">O que um coloca aparece na hora para os outros, já separado por corredor. Depois da compra, leia a nota: os itens da lista se riscam sozinhos e os preços ficam guardados.</div>}
      {grupos.map(g => (
        <div key={g.secao} className="casa-secao">
          {abertos.length >= 4 && <small className="casa-secao-t">{nomeSecao(g.secao)}</small>}
          {g.itens.map(x => <Item key={x.id} x={x} />)}
        </div>
      ))}
      {feitos.length > 0 && <div className="casa-secao feitos"><small className="casa-secao-t">No carrinho</small>{feitos.map(x => <Item key={x.id} x={x} />)}</div>}
      {estimado > 0 && <div className="casa-estimado"><span>Estimativa da lista</span><b className="num">{brl(estimado)}</b><small>pelo último preço de {comPreco.length} {comPreco.length === 1 ? "item" : "itens"}</small></div>}
      <button className="btn mode" onClick={() => act.lerNotaCasa()}><I.receipt /> Ler a nota do mercado</button>
      {(abertos.length > 0 || feitos.length > 0) && <div className="btn-row">
        {abertos.length > 0 && <button className="btn ghost" onClick={mandar}><I.share /> Mandar a lista</button>}
        {feitos.length > 0 && <button className="btn ghost" onClick={limpar}>Limpar comprados</button>}
      </div>}
    </section>
  );
}

/* ---------- mercado da casa: últimas notas e preços que mudaram ---------- */
function MercadoCasa({ C, act }) {
  const comNota = C.lanc.filter(l => l.nota && Array.isArray(l.nota.itens)).sort((a, b) => b.data.localeCompare(a.data));
  const hist = useMemo(() => historico(C.lanc), [C.lanc]);
  if (!comNota.length) return null;
  const ch = todayISO().slice(0, 7);
  const mesMercado = C.lanc.filter(l => (l.data || "").startsWith(ch) && (l.cat === "mercado" || l.nota)).reduce((s, l) => s + l.valor, 0);
  // preços que mudaram entre as duas últimas compras do mesmo produto
  const mudou = Object.values(hist).filter(v => v.length >= 2).map(v => { const a = v[v.length - 2], b = v[v.length - 1]; return { nome: b.nome, de: a, para: b, pct: a.unit > 0 ? (b.unit - a.unit) / a.unit : 0 }; })
    .filter(x => Math.abs(x.pct) >= 0.03).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5);
  return (
    <section className="panel casa-mercado">
      <Ilustra n="carrinho" className="casa-mercado-ilu" />
      <div className="panel-head"><h3>Mercado da casa</h3></div>
      <div className="casa-mercado-n"><span><b className="num">{brl(mesMercado)}</b><small>em mercado este mês</small></span><span><b>{comNota.length}</b><small>{comNota.length === 1 ? "nota guardada" : "notas guardadas"}</small></span></div>
      <small className="casa-secao-t">Últimas notas</small>
      {comNota.slice(0, 4).map(l => (
        <button key={l.id} className="casa-nota-l" onClick={() => act.verNotaCasa(l)}>
          <span className="mid"><b>{nomeLoja(l.nota.loja) || l.desc || "Mercado"}</b><small>{dm(l.data)} · {l.nota.itens.length} itens · {nomeDe(C, l.pagou)} pagou</small></span>
          <b className="num">{brl(l.valor)}</b><I.chev />
        </button>
      ))}
      {mudou.length > 0 && <>
        <small className="casa-secao-t">Preços que mudaram</small>
        {mudou.map(x => (
          <div key={x.nome} className={"casa-preco" + (x.pct > 0 ? " subiu" : " caiu")}>
            <span className="mid"><b>{x.nome.toLowerCase()}</b><small>era {brlReal(x.de.unit)} ({x.de.loja}, {dm(x.de.data)})</small></span>
            <span className="v"><b className="num">{brlReal(x.para.unit)}</b><small>{x.pct > 0 ? "▲" : "▼"} {Math.round(Math.abs(x.pct) * 100)}%</small></span>
          </div>
        ))}
      </>}
    </section>
  );
}

/* ---------- ler a nota do mercado: QR code (mais preciso), foto (a IA lê), link ou chave de acesso ---------- */
// Por que nem toda nota lê pelo QR: cada estado tem a sua página na Sefaz. Algumas pedem "não sou robô" ou só
// abrem no navegador; aí nenhum app consegue ler sozinho. Nesses casos a foto da nota (a IA lê) é o caminho.
const MOTIVOS = {
  captcha: uf => `A Sefaz${uf ? ` de ${uf}` : ""} pede “não sou robô” e não deixa nenhum app ler a nota sozinho. Pela foto eu leio.`,
  js: uf => `A página da Sefaz${uf ? ` de ${uf}` : ""} só abre no navegador, e eu não consigo ler os itens dela. Pela foto eu leio.`,
  "ainda-nao": () => "Essa nota ainda não chegou na Sefaz (acontece logo depois da compra, ou quando o caixa estava sem internet). Tente pelo QR mais tarde, ou leia pela foto agora.",
};
// Também serve à loja: sem casa (C nulo), com a lista dela (lista) e o que fazer ao salvar (onSalvar)
export function NotaSheet({ casa: C, servidor, onClose, act, lista: listaExt, onSalvar, titulo, onSemNota, arquivo }) {
  const [etapa, setEtapa] = useState("escolher"); // escolher | camera | lendo | revisar
  const [nota, setNota] = useState(null), [erro, setErro] = useState(null), [link, setLink] = useState(""), [lendo, setLendo] = useState("");
  const [dica, setDica] = useState(""), [luz, setLuz] = useState(null); // luz: null = aparelho sem lanterna
  const [pagou, setPagou] = useState(C ? C.eu : null), [modo, setModo] = useState("dividir");
  // quem: a loja pelo CNPJ (BrasilAPI): o nome que as pessoas conhecem e o ramo, que escolhe a categoria
  const [quem, setQuem] = useState(null);
  const descobrir = cnpj => { if (cnpj) buscarCnpj(cnpj).then(i => { if (i && vivo.current) setQuem(i); }).catch(() => {}); };
  const video = React.useRef(null), stream = React.useRef(null), vivo = React.useRef(true), fotoRef = React.useRef(null);
  const parar = () => { if (stream.current) stream.current.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); stream.current = null; setLuz(null); };
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; parar(); }; }, []);
  // erro: { t: texto, foto: mostra o botão de tirar foto, sefaz: link para abrir a nota no site da Sefaz }
  const falhou = (t, extra = {}) => { if (!vivo.current) return; setErro({ t, ...extra }); setEtapa("escolher"); vibrar("erro"); };
  const pronto = n => { if (!n.itens.length) return falhou("Não achei os itens dessa nota. Tire a foto de perto, com a nota inteira e reta.", { foto: true }); setNota(n); setEtapa("revisar"); vibrar("ok"); descobrir(n.cnpj); };

  // foto: a IA lê a nota inteira (motivo: por que caiu aqui em vez do QR)
  const pelaIA = async (f, motivo) => {
    if (!servidor) return falhou("Para ler a foto da nota, ligue o servidor de avisos (Perfil → Avisos).");
    setEtapa("lendo"); setLendo(motivo || "");
    try {
      const imagem = await reduzirFoto(f, 1400, 0.72);
      const r = await fetch(`${servidor}/ler-nota`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagem, hoje: todayISO() }), signal: AbortSignal.timeout(60000) });
      const j = await r.json().catch(() => ({}));
      if (j.erro === "limite") return falhou(j.nivel === "pro" ? "Você usou bastante a leitura por foto hoje. Amanhã renova. Pelo QR code continua funcionando." : "As leituras por foto de hoje acabaram (no Avina Pro é à vontade). Pelo QR code continua funcionando, ou anote só o total.");
      if (!r.ok || !j.nota) return falhou("Não consegui ler a foto. Tire de perto, com boa luz e a nota inteira e reta.", { foto: true });
      pronto({ ...arrumarNotaIA(j.nota), fonte: "foto", foto: await reduzirFoto(f, 800, 0.55) });
    } catch (e) { falhou("Não consegui ler a foto. Confira a internet e tente de novo.", { foto: true }); }
  };

  // QR code: o servidor busca a página da Sefaz e o aparelho lê os itens.
  // Se a Sefaz não deixar e houver uma foto (o QR veio de uma foto), a IA lê a mesma foto, sem pedir de novo.
  const buscar = async (texto, arquivo) => {
    const q = lerTextoNota(texto);
    if (q.erro) return falhou(q.erro === "chave" ? "O QR code saiu cortado ou borrado (a chave da nota não confere). Tente de novo, mais de perto e com a nota esticada." : "Esse QR code não é o da nota fiscal. Procure o do fim do cupom, perto de “Consulte pela chave de acesso”.");
    if (!servidor) return falhou("Para ler a nota, ligue o servidor de avisos (Perfil → Avisos).");
    const uf = ufDaChave(q.chave);
    setEtapa("lendo"); setLendo(""); setErro(null); setQuem(null);
    descobrir(cnpjDaChave(q.chave)); // o CNPJ está na chave: mesmo se a Sefaz não deixar ler, já sei de que loja é
    let motivo = "", extra = { foto: true };
    try {
      const r = await fetch(`${servidor}/nfce`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: q.url }), signal: AbortSignal.timeout(30000) });
      if (r.ok) {
        const buf = await r.arrayBuffer(), ct = r.headers.get("content-type") || "";
        const cs = (ct.match(/charset=([\w-]+)/i) || [])[1];
        let html; try { html = new TextDecoder(cs || "utf-8").decode(buf); } catch (e) { html = new TextDecoder("utf-8").decode(buf); }
        if (!cs) { const m = html.match(/<meta[^>]+charset=["']?([\w-]+)/i); if (m && !/utf-?8/i.test(m[1])) { try { html = new TextDecoder(m[1]).decode(buf); } catch (e) {} } }
        const n = lerPaginaNfce(html);
        if (n.itens.length) return pronto({ ...n, fonte: "qr", url: q.url });
        motivo = MOTIVOS[n.bloqueio] ? MOTIVOS[n.bloqueio](uf) : n.recusa ? `A Sefaz${uf ? ` de ${uf}` : ""} respondeu: “${n.recusa}”.` : `Não reconheci a página da Sefaz${uf ? ` de ${uf}` : ""}. Pela foto eu leio.`;
        if (n.bloqueio === "js" || n.bloqueio === "captcha") extra.sefaz = q.url;
      } else motivo = `A Sefaz${uf ? ` de ${uf}` : ""} não respondeu agora. Pela foto eu leio.`;
    } catch (e) { motivo = "Não consegui falar com a Sefaz. Confira a internet, ou leia pela foto."; }
    if (arquivo) return pelaIA(arquivo, motivo.replace(/ Pela foto eu leio\.$/, "") + " Lendo pela foto…");
    falhou(motivo, extra);
  };

  const abrirCamera = async () => {
    setErro(null); setDica(""); setEtapa("camera");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (!vivo.current) { s.getTracks().forEach(t => t.stop()); return; }
      stream.current = s; const v = video.current; v.srcObject = s; v.setAttribute("playsinline", ""); await v.play().catch(() => {});
      try { const cap = s.getVideoTracks()[0].getCapabilities(); if (cap && cap.torch) setLuz(false); } catch (e) {}
      const tela = document.createElement("canvas");
      let n = 0, ruins = 0, outros = 0;
      const passo = async () => {
        if (!vivo.current || !stream.current) return;
        try {
          if (v.videoWidth) {
            // um quadro inteiro, outro só o meio (o QR do cupom é pequeno e denso: recortado, o leitor enxerga melhor)
            const W = v.videoWidth, H = v.videoHeight, meio = n++ % 2 === 1, lado = Math.round(Math.min(W, H) * 0.7);
            const ctx = tela.getContext("2d", { willReadFrequently: true });
            if (meio) { tela.width = lado; tela.height = lado; ctx.drawImage(v, (W - lado) / 2, (H - lado) / 2, lado, lado, 0, 0, lado, lado); }
            else { tela.width = W; tela.height = H; ctx.drawImage(v, 0, 0); }
            const lidos = (await lerQRs(tela)).map(t => ({ t, q: lerTextoNota(t) }));
            const bom = lidos.find(x => x.q.url);
            if (bom) { parar(); vibrar("toque"); return buscar(bom.t); }
            // leu algo, mas não serve: avisa o porquê (sem parar a câmera)
            if (lidos.some(x => x.q.erro === "chave") && ++ruins >= 2) setDica("Quase! Chegue um pouco mais perto e segure firme");
            else if (lidos.length && ++outros >= 3) setDica("Esse é outro QR code. Procure o do fim da nota");
          }
        } catch (e) {}
        setTimeout(passo, 200);
      };
      passo();
    } catch (e) { parar(); falhou(e && e.name === "NotAllowedError" ? "A câmera não foi liberada. Use a foto da nota." : "Não consegui abrir a câmera. Use a foto da nota.", { foto: true }); }
  };
  const lanterna = async () => { const t = stream.current && stream.current.getVideoTracks()[0]; if (!t) return; try { await t.applyConstraints({ advanced: [{ torch: !luz }] }); setLuz(!luz); } catch (e) {} };
  // foto: primeiro procura o QR code nela (mais preciso); se não tiver, ou a Sefaz não deixar, a IA lê a nota inteira
  const daFoto = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) lerFoto(f); };
  const lerFoto = async f => {
    parar(); setErro(null); setEtapa("lendo"); setLendo(""); setQuem(null);
    let t = null; try { t = (await lerQRs(f)).find(ehLinkNfce); } catch (e2) {}
    if (t) return buscar(t, f);
    pelaIA(f);
  };
  const tirarFoto = () => fotoRef.current && fotoRef.current.click();
  // chegou uma foto de fora (o "Compartilhar" do celular): já começa lendo
  useEffect(() => { if (arquivo) lerFoto(arquivo); }, []);
  const tirar = i => setNota(n => { const it = n.itens[i]; return { ...n, itens: n.itens.filter((_, k) => k !== i), total: Math.max(0, Math.round((n.total - it.valor) * 100) / 100) }; });
  const lista = listaExt || C.compras;
  const naNota = nota ? lista.filter(x => nota.itens.some(i => combina(x.texto, i.nome))) : [];
  const ficou = nota ? lista.filter(x => !x.feito && !naNota.includes(x)) : [];
  // a loja pelo CNPJ (quando achou) dá o nome e a categoria; sem ela, fica como antes
  const nomeNota = n => (quem && quem.nome) || nomeLoja(n.loja);
  const comQuem = n => (quem ? { ...n, loja: quem.nome, cnpj: quem.cnpj } : n);
  const salvar = async () => {
    if (onSalvar) { const { _tr, recusa, bloqueio, ...n } = nota; await onSalvar(comQuem(n), naNota, quem); onClose(); return; }
    const parts = modo === "dividir" ? C.membros.map(m => m.id) : [pagou];
    const { _tr, recusa, bloqueio, ...n0 } = nota, n = comQuem(n0);
    await C.salvar("lanc", { valor: n.total, desc: nomeLoja(n.loja) || "Mercado", cat: (quem && quem.cat) || "mercado", data: n.data || todayISO(), pagou, participantes: parts, pesos: modo === "dividir" ? pesosDe(C.config, parts) : undefined, nota: n, criado: Date.now(), autor: C.eu });
    naNota.forEach(x => C.apagar("compra", x.id));
    vibrar("ok"); act.toast(naNota.length ? `Compra salva · ${naNota.length} ${naNota.length === 1 ? "item da lista riscado" : "itens da lista riscados"}` : "Compra salva com a nota");
    onClose();
  };
  return (
    <Sheet title={titulo || "Nota do mercado"} sub={etapa === "revisar" ? "Confira e salve" : "Os itens e os preços ficam guardados"} onClose={onClose}>
      {(etapa === "escolher" || etapa === "camera") && <>
        {erro && <div className="nota-erro" role="alert">
          <span>{quem && <b>{quem.nome}: </b>}{erro.t}</span>
          {(erro.foto || erro.sefaz) && <div className="btn-row">
            {erro.foto && <button type="button" className="btn mode" onClick={tirarFoto}><I.camera /> Tirar foto da nota</button>}
            {erro.sefaz && <a className="btn ghost" href={erro.sefaz} target="_blank" rel="noopener noreferrer">Ver no site da Sefaz</a>}
          </div>}
        </div>}
        <div className={"boleto-cam nota-cam" + (etapa === "camera" ? " on" : "")}>
          <video ref={video} muted playsInline aria-label="Câmera" />
          {etapa === "camera" ? <><i className="nota-guia" aria-hidden="true" /><span className="boleto-dica">{dica || "Aponte para o QR code no fim da nota"}</span></>
            : <button type="button" className="boleto-abrir" onClick={abrirCamera}><I.camera /><b>Apontar para o QR code</b><small>o jeito mais preciso: vêm todos os itens e preços</small></button>}
        </div>
        <div className="acts-linha">
          <button type="button" className="pill-btn" onClick={tirarFoto}><I.upload /> Foto da nota</button>
          {etapa === "camera" && luz !== null && <button type="button" className={"pill-btn" + (luz ? " on" : "")} onClick={lanterna} aria-pressed={luz}>{luz ? "Apagar luz" : "Acender luz"}</button>}
          {etapa === "camera" && <button type="button" className="pill-btn" onClick={() => { parar(); setEtapa("escolher"); }}>Parar câmera</button>}
        </div>
        <input ref={fotoRef} type="file" accept="image/*" capture="environment" hidden onChange={daFoto} />
        <form className="nota-link" onSubmit={e => { e.preventDefault(); if (link.trim()) buscar(link.trim()); }}>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="Ou cole o link, ou digite a chave (44 números)" aria-label="Link do QR code ou chave de acesso da nota" autoComplete="off" />
          <button type="submit" className="bub-act" disabled={!link.trim()}>Buscar</button>
        </form>
        <button className="btn text" onClick={() => onSemNota ? onSemNota(quem) : act.abrirGastoCasa(null, { desc: (quem && quem.nome) || "Mercado", cat: (quem && quem.cat) || "mercado" })}>{quem ? `Anotar só o total (${quem.nome})` : "Sem nota? Anotar só o total"}</button>
      </>}
      {etapa === "lendo" && <div className="nota-lendo"><Ilustra n="carrinho" /><b>Lendo a nota…</b><small>{lendo || "Isso leva alguns segundos."}</small></div>}
      {etapa === "revisar" && nota && <>
        <div className="nota-topo">
          <span><b>{nomeNota(nota) || "Mercado"}</b><small>{nota.data ? dm(nota.data) : "Hoje"} · {nota.itens.length} itens · {nota.fonte === "qr" ? "lida pelo QR code" : "lida pela foto (confira os valores)"}{C && quem && quem.cat && quem.cat !== "mercado" ? ` · vai em ${catDe(quem.cat).nome}` : ""}</small></span>
          <b className="num nota-total">{brl(nota.total)}</b>
        </div>
        {lista.length > 0 && <div className={"nota-bate" + (ficou.length ? "" : " tudo")}>
          <I.check /><span>{naNota.length ? <><b>{naNota.length} {naNota.length === 1 ? "item da lista veio" : "itens da lista vieram"}</b>{ficou.length ? <> · ficou faltando: {ficou.slice(0, 4).map(x => x.texto).join(", ")}{ficou.length > 4 ? "…" : ""}</> : " · a lista está completa!"}</> : "Nenhum item da lista apareceu nesta nota."}</span>
        </div>}
        <div className="nota-itens">
          {nota.itens.map((x, i) => { const ok = lista.some(l => combina(l.texto, x.nome)); return (
            <div key={i} className={"nota-item" + (ok ? " da-lista" : "")}>
              <span className="mid"><b>{x.nome}</b><small>{x.qtd !== 1 ? `${String(x.qtd).replace(".", ",")} ${x.un || "un"} × ${brlReal(x.unit)}` : brlReal(x.unit)}{ok ? " · da lista" : ""}</small></span>
              <b className="num">{brlReal(x.valor)}</b>
              {nota.fonte === "foto" && <button type="button" className="casa-item-x" onClick={() => tirar(i)} aria-label={`Tirar ${x.nome}`}><I.x /></button>}
            </div>
          ); })}
        </div>
        {nota.fonte === "foto" && <div className="hint">A foto pode trocar um número ou outro: toque no × para tirar o que a IA leu errado.</div>}
        {C && C.membros.length > 1 && <>
          <div className="hint">Quem pagou</div>
          <div className="casa-chips" role="radiogroup" aria-label="Quem pagou">{C.membros.map(m => <button key={m.id} type="button" className={pagou === m.id ? "on" : ""} onClick={() => setPagou(m.id)}><Pessoa m={m} />{m.id === C.eu ? "Você" : m.nome}</button>)}</div>
          <Seg value={modo} onChange={setModo} options={[{ v: "dividir", l: "Dividir entre todos" }, { v: "mostrar", l: "Só guardar" }]} />
        </>}
        <button className="btn mode" onClick={salvar}><I.check /> Salvar a compra ({brl(nota.total)})</button>
        <button className="btn text" onClick={() => { setNota(null); setEtapa("escolher"); }}>Ler outra nota</button>
      </>}
    </Sheet>
  );
}

// Ver uma nota guardada: itens, preços e a foto (ou o link da Sefaz)
export function NotaVerSheet({ lanc: l, onClose }) {
  const n = l.nota || { itens: [] };
  return (
    <Sheet title={nomeLoja(n.loja) || l.desc || "Nota do mercado"} sub={`${dm(l.data)} · ${n.itens.length} itens`} onClose={onClose}>
      <div className="nota-topo"><span><b>Total</b><small>{n.fonte === "qr" ? "Lida pelo QR code" : "Lida pela foto"}</small></span><b className="num nota-total">{brl(l.valor)}</b></div>
      <div className="nota-itens">
        {n.itens.map((x, i) => (
          <div key={i} className="nota-item">
            <span className="mid"><b>{x.nome}</b><small>{x.qtd !== 1 ? `${String(x.qtd).replace(".", ",")} ${x.un || "un"} × ${brlReal(x.unit)}` : brlReal(x.unit)}</small></span>
            <b className="num">{brlReal(x.valor)}</b>
          </div>
        ))}
      </div>
      {n.foto && <img className="nota-foto" src={n.foto} alt="Foto da nota" />}
      {n.url && <a className="btn ghost" href={n.url} target="_blank" rel="noopener noreferrer"><I.share /> Ver a nota na Sefaz</a>}
    </Sheet>
  );
}

/* ---------- como a casa divide: igual ou proporcional (por exemplo, pela renda) ---------- */
function ComoDividem({ C }) {
  const cfg = C.config || {};
  const [modo, setModo] = useState(cfg.modo || "igual");
  const [pcts, setPcts] = useState(() => Object.fromEntries(C.membros.map(m => [m.id, String((cfg.pcts && cfg.pcts[m.id]) || Math.round(100 / C.membros.length))])));
  const soma = C.membros.reduce((s, m) => s + (Number(pcts[m.id]) || 0), 0);
  const salvar = (md, p = pcts) => C.salvar("config", { id: "divisao", modo: md, pcts: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Number(v) || 0])) });
  useEffect(() => { if (modo === "proporcional" && soma === 100) { const t = setTimeout(() => salvar("proporcional"), 600); return () => clearTimeout(t); } }, [pcts]);
  return (
    <section className="panel casa-divide">
      <div className="panel-head"><h3>Como vocês dividem</h3></div>
      <Seg value={modo} onChange={md => { setModo(md); salvar(md); vibrar("toque"); }} options={[{ v: "igual", l: "Igual" }, { v: "proporcional", l: "Proporcional" }]} />
      {modo === "igual" ? <div className="hint">Cada gasto é dividido em partes iguais entre quem participa.</div> : <>
        <div className="hint">Bom quando um ganha mais que o outro: cada um paga a sua porcentagem. Vale para os gastos anotados daqui para a frente.</div>
        {C.membros.map(m => (
          <label key={m.id} className="casa-pct"><span><Pessoa m={m} />{nomeDe(C, m.id)}</span><input inputMode="numeric" value={pcts[m.id]} onChange={e => setPcts(p => ({ ...p, [m.id]: e.target.value.replace(/\D/g, "").slice(0, 3) }))} aria-label={`Porcentagem de ${nomeDe(C, m.id)}`} /><small>%</small></label>
        ))}
        {soma !== 100 && <div className="error">A soma está em {soma}%. Precisa dar 100%.</div>}
      </>}
    </section>
  );
}

// Os últimos acertos (quem pagou quem)
function Acertos({ C }) {
  const ult = [...C.acertos].sort((a, b) => (b.criado || 0) - (a.criado || 0)).slice(0, 3);
  if (!ult.length) return null;
  return <div className="casa-acertos"><small>Últimos acertos</small>{ult.map(a => <span key={a.id}>{nomeDe(C, a.de)} pagou {brl(a.valor)} para {a.para === C.eu ? "você" : nomeDe(C, a.para)} · {relativo(a.data).toLowerCase()}</span>)}</div>;
}

/* ---------- anotar ou corrigir um gasto da casa ---------- */
export function GastoCasaSheet({ casa: C, inicial, pre, onClose, act }) {
  const [valor, setValor] = useState(inicial ? fmtNum(inicial.valor) : "");
  const [desc, setDesc] = useState(inicial ? inicial.desc || "" : (pre && pre.desc) || "");
  const [cat, setCat] = useState(inicial ? inicial.cat || "casa" : (pre && pre.cat) || "mercado");
  const [pagou, setPagou] = useState(inicial ? inicial.pagou : C.eu);
  const [parts, setParts] = useState(() => new Set(inicial && inicial.participantes ? inicial.participantes : C.membros.map(m => m.id)));
  const [data, setData] = useState(inicial ? inicial.data : todayISO());
  const v = num(valor), ok = v > 0 && parts.size > 0;
  const nome = m => m.id === C.eu ? "Você" : m.nome;
  // pesos: os do próprio gasto (se os participantes não mudaram) ou os da casa
  const mesmos = inicial && inicial.participantes && inicial.participantes.length === parts.size && inicial.participantes.every(p => parts.has(p));
  const pesos = mesmos && inicial.pesos ? inicial.pesos : pesosDe(C.config, [...parts]);
  const previa = v > 0 && parts.size > 1 ? partes({ valor: v, participantes: [...parts], pesos }, C.membros) : null;
  const salvar = async () => {
    await C.salvar("lanc", { ...(inicial || {}), valor: v, desc: desc.trim(), cat, pagou, participantes: [...parts], pesos, data, criado: inicial ? inicial.criado : Date.now(), autor: (inicial && inicial.autor) || C.eu });
    vibrar("ok"); act.toast(inicial ? "Gasto da casa atualizado" : `Gasto da casa anotado: ${brlReal(v)}`); onClose();
  };
  return (
    <Sheet title={inicial ? "Gasto da casa" : "Anotar gasto da casa"} sub={C.casa ? C.casa.nome : ""} onClose={onClose}>
      <label className="big-amt" htmlFor="cg-v"><span>R$</span><input id="cg-v" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="0,00" autoFocus={!inicial} aria-label="Valor" /></label>
      <div className="fields"><Field label="O que foi" htmlFor="cg-d"><input id="cg-d" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: Mercado do mês, Luz, Pizza" autoComplete="off" /></Field></div>
      <div className="casa-chips" role="radiogroup" aria-label="Categoria">{CATEGORIAS.filter(c => c.id !== "outros").slice(0, 6).map(c => <button key={c.id} type="button" className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)}>{c.nome}</button>)}</div>
      {C.membros.length > 1 && <>
        <div className="hint">Quem pagou</div>
        <div className="casa-chips" role="radiogroup" aria-label="Quem pagou">{C.membros.map(m => <button key={m.id} type="button" className={pagou === m.id ? "on" : ""} onClick={() => setPagou(m.id)}><Pessoa m={m} />{nome(m)}</button>)}</div>
        <div className="hint">Dividir entre</div>
        <div className="casa-chips" role="group" aria-label="Dividir entre">{C.membros.map(m => <button key={m.id} type="button" className={parts.has(m.id) ? "on" : ""} onClick={() => setParts(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}>{parts.has(m.id) && <I.check />}{nome(m)}</button>)}</div>
        {v > 0 && parts.size === 1 && <div className="hint">Ninguém fica devendo: o gasto só aparece para a casa.</div>}
        {previa && <div className="hint">{pesos ? "Proporcional: " : "Cada um: "}{Object.entries(previa).map(([id, x]) => `${nomeDe(C, id)} ${brlReal(x)}`).join(" · ")}.</div>}
      </>}
      <div className="fields"><Field label="Quando" htmlFor="cg-dt"><input id="cg-dt" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} /></Field></div>
      <button className="btn mode" disabled={!ok} onClick={salvar}><I.check /> {inicial ? "Salvar" : "Anotar"}</button>
      {inicial && inicial.nota && <button className="btn ghost" onClick={() => act.verNotaCasa(inicial)}><I.receipt /> Ver a nota ({inicial.nota.itens.length} itens)</button>}
      {inicial && <ConfirmButton label="Apagar este gasto" titulo="Apagar o gasto da casa?" texto="Ele some para todas as pessoas da casa. O seu lançamento pessoal (se veio de lá) continua." acao="Apagar" onConfirm={async () => { await C.apagar("lanc", inicial.id); act.desligarDaCasa(inicial.id); onClose(); }} />}
    </Sheet>
  );
}

/* ---------- levar gastos pessoais para a casa (a pessoa escolhe quais) ---------- */
export function TrazerGastosSheet({ casa: C, db, ids0, onClose, act }) {
  const desde = addDays(todayISO(), -60);
  const lista = useMemo(() => db.pessoal.lanc.filter(l => l.tipo === "saida" && !l.casaId && (l.data >= desde || (ids0 || []).includes(l.id))).sort((a, b) => b.data.localeCompare(a.data)), [db]);
  const [sel, setSel] = useState(() => new Set((ids0 || []).filter(id => lista.some(l => l.id === id))));
  const [modo, setModo] = useState("dividir");
  const marcar = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const total = lista.filter(l => sel.has(l.id)).reduce((s, l) => s + l.valor, 0);
  const sozinho = C.membros.length < 2;
  const levar = async () => { await act.compartilharComCasa([...sel], modo === "dividir" && !sozinho); onClose(); };
  return (
    <Sheet title="Levar para a casa" sub="Escolha quais gastos seus a casa vai ver" onClose={onClose}>
      {!sozinho && <Seg value={modo} onChange={setModo} options={[{ v: "dividir", l: "Dividir entre todos" }, { v: "mostrar", l: "Só mostrar" }]} />}
      <div className="hint">{sozinho ? "Quando alguém entrar na casa, vai ver estes gastos." : modo === "dividir" ? `Cada gasto é dividido ${C.config && C.config.modo === "proporcional" ? "pela porcentagem de cada um" : `igual entre as ${C.membros.length} pessoas`}: quem não pagou fica devendo a parte dele.` : "A casa vê o gasto, mas ninguém fica devendo nada."}</div>
      {lista.length === 0 ? <div className="empty">Nenhum gasto seu nos últimos 60 dias que ainda não esteja na casa.</div> : (
        <div className="casa-escolha">
          {lista.map(l => { const cat = catDe(l.cat); return (
            <button key={l.id} type="button" className={"casa-escolha-item" + (sel.has(l.id) ? " on" : "")} aria-pressed={sel.has(l.id)} onClick={() => marcar(l.id)}>
              <span className={"box " + (sel.has(l.id) ? "done" : "up")}>{sel.has(l.id) && <I.check />}</span>
              <span className="ci" style={catVars(cat)}><CatIcon cat={cat} /></span>
              <span className="mid"><b>{l.desc || cat.nome}</b><small>{cat.nome} · {relativo(l.data).toLowerCase()}</small></span>
              <span className="amt num"><Money v={l.valor} /></span>
            </button>
          ); })}
        </div>
      )}
      <button className="btn mode" disabled={!sel.size} onClick={levar}><I.check /> {sel.size ? `Levar ${sel.size} ${sel.size === 1 ? "gasto" : "gastos"} (${brl(total)})` : "Escolha os gastos"}</button>
    </Sheet>
  );
}

// Abriu um link de convite: mostra de quem é a casa e entra
export function ConviteCasaSheet({ casa: C, token, onClose, onEntrou }) {
  const [info, setInfo] = useState(null), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!C.nuvem) { setErro("Para entrar numa casa, use a sua conta com e-mail e senha. Na demonstração não dá."); return; }
    C.verConvite(token).then(i => i && i.valido ? setInfo(i) : setErro(erroDe("convite invalido"))).catch(e => setErro(erroDe(e)));
  }, [token]);
  const entrar = async () => { setOcupado(true); try { await C.entrar(token); vibrar("ok"); onEntrou(); } catch (e) { setErro(erroDe(e)); setOcupado(false); } };
  return (
    <Sheet title="Convite para a casa" onClose={onClose}>
      <div className="casa-intro"><Ilustra n="dinheiro" />
        {info ? <p><b>{info.convidou || "Alguém"}</b> te chamou para dividir as contas da casa <b>“{info.casa}”</b> ({info.pessoas} {info.pessoas === 1 ? "pessoa" : "pessoas"}).<br /><br />Vocês vão ver os gastos da casa e quem deve quanto. <b>Seus gastos pessoais continuam só seus</b>, a não ser os que você escolher levar.<br /><br /><b>Entrar é grátis.</b> A casa (gastos, contas e lista de compras) não tem custo para ninguém.</p>
          : !erro ? <p>Abrindo o convite…</p> : null}
      </div>
      {erro && <div className="error">{erro}</div>}
      {info && <button className="btn mode" disabled={ocupado} onClick={entrar}><I.check /> {ocupado ? "Entrando…" : "Entrar na casa"}</button>}
      <button className="btn text" onClick={onClose}>Agora não</button>
    </Sheet>
  );
}
