// Parte do app carregada sob demanda (só quando é aberta). Gerado a partir do App.jsx.
import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import PORQUINHO from "../assets/porquinho.webp";
import { createPortal, flushSync } from "react-dom";
import { PROFISSOES, fmtNum, idadeDe, PhotoPicker, Field, I, todayISO, DURACOES, num, soNumero, Seg, AVISOS_PADRAO, vibrar } from "../App.jsx";

function Onboarding({ conta, onDone, onSair }) {
  const p0 = conta.perfil || {};
  const [i, setI] = useState(0);
  const [nome, setNome] = useState(conta.nome || "");
  const [foto, setFoto] = useState(conta.foto || null);
  const [nasc, setNasc] = useState(p0.nascimento || "");
  const [prof, setProf] = useState(p0.profissao ? (PROFISSOES.some(x => x.id === p0.profissao) ? p0.profissao : "Outra") : "");
  const [outra, setOutra] = useState(p0.profissao && !PROFISSOES.some(x => x.id === p0.profissao) ? p0.profissao : "");
  const [termo, setTermo] = useState(p0.termo || "");
  const [dur, setDur] = useState(p0.duracao || 0);
  const [valor, setValor] = useState(p0.valorPadrao ? fmtNum(p0.valorPadrao) : "");
  const [temSub, setTemSub] = useState(p0.subPadrao ? "sim" : p0.valorPadrao ? "nao" : "");
  const [sub, setSub] = useState(p0.subPadrao ? String(p0.subPadrao).replace(".", ",") : "");
  const [subTipo, setSubTipo] = useState(p0.subTipo || "fixed");
  const [meta, setMeta] = useState(p0.meta ? fmtNum(p0.meta) : "");
  const [estilo, setEstilo] = useState(p0.estilo || "");
  const [pessoal, setPessoal] = useState(p0.pessoal === undefined ? "" : p0.pessoal ? "sim" : "nao");
  const [cidade, setCidade] = useState(p0.cidade || "");
  const [erro, setErro] = useState("");
  const idade = idadeDe(nasc);
  const profissao = prof === "Outra" ? outra.trim() : prof;
  const escolherProf = id => { setProf(id); const d = (PROFISSOES.find(x => x.id === id) || { termo: "Cliente" }).termo; if (!termo || termo !== d) setTermo(d); };
  const Choice = ({ on, onClick, children, sub, wide }) => <button type="button" className={"choice" + (on ? " on" : "") + (wide ? " wide" : "")} aria-pressed={on} onClick={onClick}>{children}{sub && <small>{sub}</small>}</button>;

  const passos = [
    { q: "Como você quer ser chamado(a)?", why: "É assim que eu vou falar com você todo dia.",
      valida: () => nome.trim() ? "" : "Escreva como quer ser chamado(a).",
      body: <><PhotoPicker nome={nome} foto={foto} onChange={setFoto} /><div className="fields"><Field label="Seu nome" icon={<I.user />} htmlFor="o-nome"><input id="o-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Camila" /></Field></div></> },
    { q: "Quando você nasceu?", why: "Pra eu lembrar do seu aniversário e deixar o dia mais leve.",
      valida: () => !nasc ? "Escolha sua data de nascimento." : idade < 16 || idade > 100 ? "Confere o ano, por favor." : "",
      body: <><div className="fields"><Field label="Data de nascimento" icon={<I.cal />} htmlFor="o-nasc"><input id="o-nasc" type="date" value={nasc} max={todayISO()} onChange={e => setNasc(e.target.value)} /></Field></div>{idade >= 16 && idade <= 100 && <div className="big-num num">{idade} <span style={{ fontSize: 20, color: "var(--muted)" }}>anos</span></div>}</> },
    { q: "Qual é a sua área?", why: "Assim eu uso as palavras certas da sua profissão.",
      valida: () => profissao ? "" : prof === "Outra" ? "Escreva sua área." : "Escolha uma opção.",
      body: <><div className="choices">{PROFISSOES.map(x => <Choice key={x.id} on={prof === x.id} onClick={() => escolherProf(x.id)}>{x.id}</Choice>)}<Choice wide on={prof === "Outra"} onClick={() => escolherProf("Outra")}>Outra área</Choice></div>
        {prof === "Outra" && <div className="fields"><Field label="Qual?" htmlFor="o-outra"><input id="o-outra" value={outra} onChange={e => setOutra(e.target.value)} placeholder="Ex.: Arteterapia" /></Field></div>}</> },
    { q: "Como você chama quem você atende?", why: "Vou usar essa palavra no app inteiro: nos botões, nas listas e nos avisos.",
      valida: () => termo ? "" : "Escolha uma opção.",
      body: <div className="choices">{[["Paciente", "Novo paciente"], ["Cliente", "Novo cliente"], ["Analisando", "Novo analisando"]].map(([v, ex]) => <Choice key={v} wide on={termo === v} onClick={() => setTermo(v)} sub={`Ex.: "${ex}"`}>{v}</Choice>)}</div> },
    { q: "Quanto tempo dura cada sessão?", why: "Uso isso pra montar sua linha do tempo e mostrar os intervalos livres.",
      valida: () => dur ? "" : "Escolha a duração.",
      body: <div className="choices">{DURACOES.map(d => <Choice key={d} on={dur === d} onClick={() => setDur(d)} wide={d === 50}>{d} minutos</Choice>)}</div> },
    { q: "Qual o valor normal da sessão?", why: "Já deixo esse valor pronto quando você cadastrar alguém. Dá pra mudar a qualquer hora.",
      valida: () => !(num(valor) > 0) ? "Digite o valor da sessão." : !temSub ? "Diga se paga sublocação." : temSub === "sim" && !(num(sub) > 0) ? "Digite o valor da sublocação." : "",
      body: <><label className="big-amt" htmlFor="o-valor"><span>R$</span><input id="o-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(soNumero(e.target.value))} aria-label="Valor da sessão" /></label>
        <div className="hint">Você paga sublocação de sala?</div>
        <div className="choices"><Choice on={temSub === "sim"} onClick={() => setTemSub("sim")}>Sim</Choice><Choice on={temSub === "nao"} onClick={() => setTemSub("nao")}>Não</Choice></div>
        {temSub === "sim" && <div className="fields"><Field label={subTipo === "percent" ? "Sublocação (% da sessão)" : "Sublocação por sessão (R$)"} icon={<I.door />} htmlFor="o-sub"><input id="o-sub" inputMode="decimal" value={sub} onChange={e => setSub(soNumero(e.target.value))} placeholder={subTipo === "percent" ? "20" : "25,00"} /><Seg value={subTipo} onChange={setSubTipo} options={[{ v: "fixed", l: "Valor fixo" }, { v: "percent", l: "Porcentagem" }]} /></Field></div>}</> },
    { q: "Quanto você quer ganhar por mês?", why: "Com uma meta, eu mostro se o mês está no ritmo e quantas sessões faltam. Pode pular.", opcional: true,
      valida: () => "",
      body: <><label className="big-amt in" htmlFor="o-meta"><span>R$</span><input id="o-meta" inputMode="decimal" placeholder="0,00" value={meta} onChange={e => setMeta(soNumero(e.target.value))} aria-label="Meta mensal" /></label><div className="hint" style={{ textAlign: "center" }}>Valor líquido, já sem a sublocação.</div></> },
    { q: "Em que cidade você atende?", why: "Pra eu avisar quando for chover perto do horário das suas sessões. Pode pular.", opcional: true,
      valida: () => "",
      body: <div className="fields"><Field label="Cidade" icon={<I.cloud />} htmlFor="o-cidade"><input id="o-cidade" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex.: Curitiba" autoComplete="address-level2" /></Field></div> },
    { q: "Como prefere que eu fale com você?", why: "Tem dia que menos é mais. Você muda isso quando quiser.",
      valida: () => !estilo ? "Escolha como prefere o resumo." : !pessoal ? "Diga se quer usar o modo Pessoal." : "",
      body: <><div className="choices"><Choice wide on={estilo === "curto"} onClick={() => setEstilo("curto")} sub="Só os 2 avisos mais importantes">Direto ao ponto</Choice><Choice wide on={estilo === "detalhado"} onClick={() => setEstilo("detalhado")} sub="Até 4 avisos, com mais contexto">Completo</Choice></div>
        <div className="hint">Quer anotar também os gastos e as contas da casa?</div>
        <div className="choices"><Choice on={pessoal === "sim"} onClick={() => setPessoal("sim")}>Sim, quero</Choice><Choice on={pessoal === "nao"} onClick={() => setPessoal("nao")}>Só o consultório</Choice></div></> },
  ];
  const n = passos.length, P = passos[i];
  const terminar = () => onDone({ nome: nome.trim(), foto, perfil: { nascimento: nasc, profissao, termo, duracao: dur, valorPadrao: num(valor), subPadrao: temSub === "sim" ? num(sub) : 0, subTipo, meta: num(meta) || 0, estilo, pessoal: pessoal === "sim", cidade: cidade.trim(), avisos: p0.avisos || AVISOS_PADRAO } });
  const avancar = () => { const e = P.valida(); if (e) { vibrar("erro"); return setErro(e); } vibrar("toque"); setErro(""); if (i === n - 1) terminar(); else { setI(i + 1); window.scrollTo(0, 0); } };
  return (
    <main className="ob">
      <div className="ob-top">
        {i > 0 ? <button className="icon-btn" onClick={() => { setI(i - 1); setErro(""); }} aria-label="Voltar"><I.chevL /></button> : <button className="icon-btn" onClick={onSair} aria-label="Sair"><I.x /></button>}
        <div className="ob-prog" style={{ gridTemplateColumns: `repeat(${n},1fr)` }} aria-hidden="true">{passos.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
        <span className="ob-step">{i + 1} de {n}</span>
      </div>
      <div>
        <h1 className="ob-q">{P.q}</h1>
        <div className="ob-why"><I.chat /><span>{P.why}</span></div>
      </div>
      <div className="ob-body" key={i}>{P.body}</div>
      {erro && <div className="error" role="alert">{erro}</div>}
      <div className="ob-foot">
        <button className="btn" onClick={avancar}>{i === n - 1 ? "Tudo certo, começar" : "Continuar"}</button>
        {P.opcional && <button className="btn text" onClick={() => { if (i === 6) setMeta(""); else setCidade(""); setErro(""); if (i === n - 1) terminar(); else setI(i + 1); }}>Pular por agora</button>}
      </div>
    </main>
  );
}

export { Onboarding };
