// Parte do app carregada sob demanda (só quando é aberta). Gerado a partir do App.jsx.
import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import PORQUINHO from "../assets/porquinho.webp";
import { createPortal, flushSync } from "react-dom";
import { fmtNum, AVISOS_PADRAO, num, todayISO, liquidoMes, addDays, itensDoDia, idadeDe, termoDe, DIA_CURTO, I, brl, pushLigado, appInstalado, Avatar, ESCONDER, ConfirmButton, PhotoPicker, Field, PROFISSOES, Seg, ehAniversario, DURACOES, Toggle, soNumero, vibrar, BASE, lerJSON, K_PUSH_URL, motivoSemPush, K_PUSH, lerArquivo, FUNDOS, Cropper, pedidoInstalar, ehIOS , ajustarVibrar, limparPedidoInstalar, Ilustra, dm, useCamada, Marca } from "../App.jsx";
import { DadosRecibo } from "./consultorio.jsx";
import { AssinaturaPagina, useAssinatura, resumoAssinatura, TITULO_ASSIN, voltaAssin } from "./assinatura.jsx";
import { GradeHorarios, LinkAgendamento, linkDo } from "./agendamento.jsx";
import { gradeDo, resumoGrade, periodosIniciais } from "../horarios.js";
import { nivelDe, TRILHAS } from "../conquistas.js";

const TXT_PUSH = {
  servidor: "Falta ligar o servidor de avisos (uma vez só). No computador, dentro da pasta do app, rode: bash servidor-avisos/instalar-avisos.sh",
  instalar: "No iPhone, os avisos com o app fechado só funcionam com o app instalado: no Safari, toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone.",
  indisponivel: "Este navegador não recebe avisos com o app fechado. No iPhone, precisa do iOS 16.4 ou mais novo e do app instalado na tela inicial.",
  negado: "As notificações estão bloqueadas para o app.",
  permissao: "Toque em Ligar e escolha Permitir.",
  "servidor-fora": "Não consegui falar com o servidor de avisos. Confira a internet e tente de novo.",
  "sem-sw": "O app ainda está terminando de instalar. Feche, abra de novo pelo ícone e tente outra vez.",
  tempo: "Demorou demais para responder. Tente de novo.",
};

const textoNegado = () => ehIOS()
  ? "As notificações estão bloqueadas. Libere em: Ajustes do iPhone → Notificações → Alvena → Permitir Notificações. Depois volte aqui."
  : "As notificações estão bloqueadas. Libere nas configurações do celular: Apps → Alvena (ou Chrome) → Notificações. Depois volte aqui.";

function AvisosFechado({ act }) {
  const [ligado, setLigado] = useState(() => pushLigado());
  const [estado, setEstado] = useState(null);
  const [url, setUrl] = useState(() => lerJSON(K_PUSH_URL, ""));
  const motivo = motivoSemPush();
  const st = lerJSON(K_PUSH, {});
  const explica = m => m === "negado" ? textoNegado() : TXT_PUSH[m] || `Não deu certo (${m}). Tente de novo.`;
  const rodar = async (fn, okTxt) => {
    setEstado({ tipo: "carregando" });
    const r = await fn();
    setLigado(pushLigado());
    setEstado(r === "ok" ? { tipo: "ok", txt: okTxt } : { tipo: "erro", txt: explica(r) });
  };
  return (
    <div className="push-card">
      <div className="push-head">
        <i className={ligado ? "on" : ""}><I.bell /></i>
        <div>
          <b>Avisos com o app fechado</b>
          <span>{ligado ? `Ligados · ${st.total ?? 0} avisos guardados para os próximos dias` : "Sessão chegando, conta vencendo e fechar o dia, mesmo com o celular bloqueado."}</span>
        </div>
      </div>
      {!ligado && motivo && <div className="test-res"><div className="no"><I.alert /><span>{explica(motivo)}</span></div></div>}
      {!ligado && motivo === "servidor" && (
        <Field label="Ou cole o endereço do servidor" icon={<I.send />} htmlFor="s-srv">
          <input id="s-srv" inputMode="url" autoCapitalize="off" autoCorrect="off" value={url} placeholder="https://agenda-avisos….workers.dev" onChange={e => { setUrl(e.target.value); act.setServidor(e.target.value); }} />
        </Field>
      )}
      {!ligado && !motivo && <button className="btn" disabled={estado && estado.tipo === "carregando"} onClick={() => rodar(act.ligarPush, "Pronto! Agora teste: toque em “Testar em 10 s” e feche o app.")}><I.bell /> Ligar avisos com o app fechado</button>}
      {ligado && (
        <div className="btn-row">
          <button className="btn ghost" onClick={() => rodar(() => act.testarPush(0), "Enviado! Deve chegar em alguns segundos.")}>Testar agora</button>
          <button className="btn ghost" onClick={() => rodar(() => act.testarPush(10000), "Agora feche o app (vá para a tela inicial) e espere 10 segundos.")}>Testar em 10 s</button>
        </div>
      )}
      {estado && (estado.tipo === "carregando"
        ? <div className="test-res"><div><I.clock /><span>Só um instante…</span></div></div>
        : <div className="test-res"><div className={estado.tipo === "ok" ? "ok" : "no"}>{estado.tipo === "ok" ? <I.check /> : <I.alert />}<span>{estado.txt}</span></div></div>)}
      {ligado && st.erro && !estado && <div className="hint">Último problema: {explica(st.erro)}</div>}
      {ligado && <button className="btn text" onClick={async () => { await act.desligarPush(); setLigado(false); setEstado(null); }}>Desligar avisos com o app fechado</button>}
    </div>
  );
}

function PerfilPage({ db, conta, tema, inicio, onClose, act, nuvem }) {
  const pf = conta.perfil || {};
  const [aba, setAba] = useState(inicio || null);
  // voltar do Android: de uma seção volta para o Perfil; do Perfil, fecha
  const abaRef = useRef(aba); abaRef.current = aba;
  // telas de dentro da assinatura (planos, pagamento…): voltar passa por elas antes
  const [assin, setAssin] = useAssinatura(conta);
  const [sub, setSub] = useState(null);
  const subRef = useRef(sub); subRef.current = sub;
  useCamada(() => { if (subRef.current) { setSub(voltaAssin(subRef.current)); return false; } if (abaRef.current && !inicio) { setAba(null); return false; } onClose(); }, { escurece: false });
  const [nome, setNome] = useState(conta.nome);
  const [foto, setFoto] = useState(conta.foto || null);
  const [profissao, setProfissao] = useState(pf.profissao || "Psicologia");
  const [nasc, setNasc] = useState(pf.nascimento || "");
  const [cidade, setCidade] = useState(pf.cidade || "");
  const [pix, setPix] = useState(db.settings.pix || "");
  const [termo, setTermo] = useState(pf.termo || "Paciente");
  const [dur, setDur] = useState(pf.duracao || 50);
  const [grade, setGrade] = useState(() => gradeDo(pf));
  const [periodos, setPeriodos] = useState(() => periodosIniciais(pf));
  const { horaIni: hIni, horaFim: hFim, diasTrab: diasT } = resumoGrade(grade, periodos);
  const [falta, setFalta] = useState(pf.falta || { cobrar: false, horas: 24 });
  const [regLembrar, setRegLembrar] = useState(pf.registro !== false);
  const [meta, setMeta] = useState(pf.meta ? fmtNum(pf.meta) : "");
  const [valorPadrao, setValorPadrao] = useState(pf.valorPadrao ? fmtNum(pf.valorPadrao) : "");
  const [subPadrao, setSubPadrao] = useState(pf.subPadrao ? fmtNum(pf.subPadrao) : "");
  const [reserva, setReserva] = useState(pf.reserva || 0);
  const av0 = { ...AVISOS_PADRAO, ...(pf.avisos || {}) };
  const [avAtivo, setAvAtivo] = useState(av0.ativo);
  const [antec, setAntec] = useState(av0.antecedencia);
  const [avNomes, setAvNomes] = useState(!!av0.nomes);
  const [avResumo, setAvResumo] = useState(av0.resumo !== false);
  const [avFechar, setAvFechar] = useState(av0.fechar !== false);
  const [avSemana, setAvSemana] = useState(av0.semana !== false);
  const [estilo, setEstilo] = useState(pf.estilo || "detalhado");
  const [vib, setVib] = useState(pf.vibrar !== false);
  const [pessoal, setPessoal] = useState(pf.pessoal !== false || pf.consultorio === false);
  const [consult, setConsult] = useState(pf.consultorio !== false);
  const [permissao, setPermissao] = useState(() => "Notification" in window ? Notification.permission : "indisponivel");
  const [teste, setTeste] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const primeira = useRef(true);
  const topo = useRef(null);

  // Salva sozinho meio segundo depois da última mudança
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    const t = setTimeout(() => {
      const atual = conta.perfil || {};
      act.salvarPerfil({
        nome: nome.trim() || conta.nome, foto,
        perfil: { ...atual, profissao, nascimento: nasc, cidade: cidade.trim(), termo, duracao: dur, horaIni: hIni, horaFim: hFim, diasTrab: diasT, grade, periodos, falta, registro: regLembrar,
          meta: num(meta) || 0, valorPadrao: num(valorPadrao) || atual.valorPadrao || 0, subPadrao: num(subPadrao), reserva,
          avisos: { ...av0, ...(atual.avisos || {}), ativo: avAtivo, antecedencia: antec, nomes: avNomes, resumo: avResumo, fechar: avFechar, semana: avSemana },
          estilo, vibrar: vib, pessoal: pessoal || !consult, consultorio: consult },
      }, pix.trim());
      setSalvo(true);
    }, 450);
    return () => clearTimeout(t);
  }, [nome, foto, profissao, nasc, cidade, pix, termo, dur, grade, periodos, falta, regLembrar, meta, valorPadrao, subPadrao, reserva, avAtivo, antec, avNomes, avResumo, avFechar, avSemana, estilo, vib, pessoal, consult]);
  useEffect(() => { if (!salvo) return; const t = setTimeout(() => setSalvo(false), 1600); return () => clearTimeout(t); }, [salvo]);
  useEffect(() => { if (topo.current) topo.current.scrollTop = 0; }, [aba, sub]);
  useEffect(() => { if (aba !== "assinatura") setSub(null); }, [aba]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = e => { if (e.key === "Escape") { if (subRef.current) setSub(voltaAssin(subRef.current)); else if (aba) setAba(null); else onClose(); } };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", k); };
  }, [aba]);

  const testar = atraso => { setTeste({ esperando: atraso > 0 }); act.testarAviso(atraso).then(r => { setTeste({ r }); if ("Notification" in window) setPermissao(Notification.permission); }); };
  const textoTeste = {
    ok: "Notificação enviada. Se não apareceu, confira se o app pode mostrar notificações nas configurações do celular.",
    negado: "As notificações estão bloqueadas. Libere nas configurações do celular.",
    pendente: "Você ainda não permitiu as notificações. Toque em Testar e escolha Permitir.",
    indisponivel: "Este navegador não tem notificações. No iPhone, instale o app na tela inicial (iOS 16.4 ou mais novo).",
    bloqueado: "O navegador bloqueou a notificação. Instale o app na tela inicial e teste de novo.",
  };
  const textoPermissao = { granted: "Permitidas", denied: "Bloqueadas", default: "Ainda não pedidas", indisponivel: "Indisponíveis neste navegador" };

  // Números do cartão
  const hoje = todayISO(), chave = hoje.slice(0, 7);
  const ativos = db.patients.filter(p => p.active).length;
  const sessMes = db.sessions.filter(s => s.status === "done" && s.date.startsWith(chave)).length;
  const liqMes = liquidoMes(db, chave);
  let seguidos = 0;
  for (let i = 1; i < 60; i++) { const d = addDays(hoje, -i); if (!itensDoDia(db, d).length) continue; if ((db.fechados || {})[d]) seguidos++; else break; }
  const idade = idadeDe(nasc);
  const T = termoDe(termo);
  const diasTxt = diasT.length === 5 && [1, 2, 3, 4, 5].every(d => diasT.includes(d)) ? "seg a sex" : [1, 2, 3, 4, 5, 6, 0].filter(d => diasT.includes(d)).map(d => DIA_CURTO[d].toLowerCase()).join(", ");
  const temaNome = { dark: "Escuro", light: "Claro", auto: "Do aparelho" }[tema.modo];

  const secoes = [
    { grupo: "Você", itens: [
      { id: "dados", ic: <I.user />, t: "Dados pessoais", v: [profissao, cidade].filter(Boolean).join(" · ") || "Nome, foto e cidade" },
      { id: "pix", ic: <I.key />, t: "Chave Pix", v: pix ? "Entra nas cobranças" : "Ainda não colocou" },
    ] },
    ...(consult ? [{ grupo: "Consultório", itens: [
      { id: "agenda", ic: <I.cal />, t: "Agenda", v: diasT.length ? `${diasTxt} · ${hIni}h às ${hFim}h` : "Escolha os dias em que atende" },
      { id: "link", ic: <I.share />, t: "Link de agendamento", v: (db.pedidos || []).length ? `${db.pedidos.length} ${db.pedidos.length === 1 ? "pedido esperando" : "pedidos esperando"}` : linkDo(pf).ativo ? "O paciente escolhe o horário" : "Desligado" },
      { id: "dinheiro", ic: <I.wallet />, t: "Valores e metas", v: meta ? `Meta de ${brl(num(meta))}` : "Sem meta" },
      { id: "docs", ic: <I.receipt />, t: "Recibos e imposto", v: pf.doc && pf.doc.registro ? "Seus dados prontos para o recibo" : "CPF, registro e assinatura" },
    ] }] : []),
    { grupo: "Avisos", itens: [
      { id: "avisos", ic: <I.bell />, t: "Avisos", v: !avAtivo ? "Desligados" : pushLigado() ? (consult ? `Com o app fechado · ${antec} min antes` : "Com o app fechado") : consult ? `${antec} min antes` : "Ligados" },
    ] },
    { grupo: "App", itens: [
      { id: "visual", ic: <I.sun />, t: "Aparência e fundo", v: temaNome },
      { id: "pessoal", ic: <I.piggy />, t: "Como você usa o app", v: !consult ? "Só a vida pessoal" : pessoal ? "Consultório e vida pessoal" : "Só o consultório" },
      { id: "app", ic: <I.down />, t: "Instalar e atalhos", v: appInstalado() ? "Instalado" : "Colocar na tela inicial" },
    ] },
  ];
  const conq = act.conquistas || [], nConq = conq.filter(c => c.feito).length, nivel = nivelDe(nConq);
  const resAssin = resumoAssinatura(assin);
  const titulo = (aba === "assinatura" && sub && TITULO_ASSIN[sub]) || { assinatura: "Assinatura", link: "Link de agendamento", conquistas: "Conquistas", dados: "Dados pessoais", pix: "Chave Pix", agenda: "Agenda", dinheiro: "Valores e metas", docs: "Recibos e imposto", avisos: "Avisos", visual: "Aparência e fundo", pessoal: "Como você usa o app", app: "Instalar e atalhos" }[aba];

  return createPortal(
    <div className="perfil" data-mode={act.modo} role="dialog" aria-modal="true" aria-label={titulo || "Perfil"} ref={topo}>
      <div className="perfil-in">
        <div className="perfil-top">
          <button className="icon-btn" onClick={() => sub ? setSub(voltaAssin(sub)) : aba ? setAba(null) : onClose()} aria-label={aba ? "Voltar" : "Fechar"}>{aba ? <I.chevL /> : <I.x />}</button>
          <b>{titulo || "Perfil"}</b>
          <span className={"perfil-salvo" + (salvo ? " on" : "")} aria-live="polite">{salvo ? <><I.check /> Salvo</> : ""}</span>
        </div>

        {!aba && <>
          <div className="perfil-hero">
            <button className="perfil-foto" onClick={() => setAba("dados")} aria-label="Trocar foto e dados">
              <Avatar conta={{ nome: nome || "?", foto }} /><i><I.pencil /></i>
            </button>
            <h2>{nome || conta.nome}</h2>
            <p>{[profissao, idade ? `${idade} anos` : null].filter(Boolean).join(" · ")}</p>
            <span className="perfil-email">{conta.email}{conta.demo ? " · demonstração" : ""}</span>
            {nuvem && <span className={"perfil-nuvem " + nuvem.estado} role="status"><I.cloud />{{ ok: "Tudo salvo na nuvem", enviando: "Sincronizando…", offline: nuvem.pendentes ? `Sem internet · ${nuvem.pendentes} ${nuvem.pendentes === 1 ? "mudança guardada" : "mudanças guardadas"} aqui` : "Sem internet · tudo guardado aqui", erro: "A nuvem não respondeu · tento de novo sozinho" }[nuvem.estado]}</span>}
            <div className="perfil-nums">
              <div><b>{ativos}</b><span>{ativos === 1 ? `${T.s} ativo` : `${T.p} ativos`}</span></div>
              <div><b>{sessMes}</b><span>{sessMes === 1 ? "sessão no mês" : "sessões no mês"}</span></div>
              <div><b className="num">{ESCONDER ? "R$ •••" : `R$ ${Math.round(liqMes).toLocaleString("pt-BR")}`}</b><span>líquido no mês</span></div>
            </div>
            {seguidos >= 2 && <div className="perfil-seq"><I.flag /> Você fechou o dia {seguidos} vezes seguidas</div>}
            {conq.length > 0 && (
              <button className="perfil-conq" onClick={() => setAba("conquistas")}>
                <Ilustra n="trofeu" />
                <span><b>Nível {nivel.nome}</b><small>{nConq} de {conq.length} conquistas{nivel.prox ? ` · faltam ${nivel.faltam} para ${nivel.prox}` : ""}</small></span>
                <I.chev />
              </button>
            )}
          </div>

          <div className="perfil-grupo">
            <h3>Assinatura</h3>
            <div className="perfil-lista">
              <button className="perfil-row" onClick={() => setAba("assinatura")}>
                <i className="assin-ic"><Marca /></i><span><b>Alvena</b><small>{resAssin.texto}</small></span>
                {resAssin.selo && <em className="assin-selo">{resAssin.selo}</em>}<I.chev />
              </button>
              <button className="perfil-row" onClick={() => { setAba("assinatura"); setSub("indicar"); }}>
                <i><I.users /></i><span><b>Indique um colega</b><small>Vocês dois ganham 1 mês grátis</small></span><I.chev />
              </button>
            </div>
          </div>

          {secoes.map(g => (
            <div key={g.grupo} className="perfil-grupo">
              <h3>{g.grupo}</h3>
              <div className="perfil-lista">
                {g.itens.map(it => (
                  <button key={it.id} className="perfil-row" onClick={() => setAba(it.id)}>
                    <i>{it.ic}</i><span><b>{it.t}</b><small>{it.v}</small></span><I.chev />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="perfil-grupo">
            <h3>Conta</h3>
            <div className="perfil-seguro">
              <Ilustra n="cadeados" />
              <span><b>{conta.uid ? "Seus dados estão protegidos" : conta.demo ? "Demonstração" : "Seus dados ficam neste aparelho"}</b>
                <small>{conta.uid ? "Login com senha, cópia na nuvem e cada conta só enxerga os próprios dados." : conta.demo ? "Nada daqui sai do aparelho. Crie uma conta para guardar de verdade." : "Crie uma conta com login para ter uma cópia na nuvem e usar em outros aparelhos."}</small></span>
            </div>
            <div className="perfil-lista">
              <button className="perfil-row" onClick={act.refazer}><i><I.repeat /></i><span><b>Refazer perguntas iniciais</b><small>Muda profissão, valores e jeito do app</small></span><I.chev /></button>
              <button className="perfil-row" onClick={act.sair}><i><I.out /></i><span><b>Sair da conta</b><small>{conta.uid ? "Seus dados continuam guardados na nuvem" : "Seus dados ficam guardados neste aparelho"}</small></span><I.chev /></button>
            </div>
          </div>
          <ConfirmButton label="Apagar meus dados" titulo="Apagar todos os seus dados?" texto={conta.uid ? "Pacientes, sessões, cobranças e gastos somem de vez, da nuvem e de todos os seus aparelhos. A conta continua. Isso não dá para desfazer." : "Pacientes, sessões, cobranças e gastos deste aparelho somem de vez. Isso não dá para desfazer."} acao="Apagar tudo" onConfirm={act.zerar} />
          {conta.uid && <ConfirmButton label="Excluir minha conta" titulo="Excluir sua conta?" texto="O login, o perfil e todos os dados saem da nuvem e deste aparelho, de vez. Isso não dá para desfazer." acao="Excluir conta" onConfirm={act.excluirConta} />}
          {db.patients.length === 0 && <button className="btn text" onClick={act.carregarExemplo}>Carregar dados de exemplo</button>}
        </>}

        {aba === "dados" && <div className="stack">
          <PhotoPicker nome={nome} foto={foto} onChange={setFoto} />
          <div className="fields">
            <Field label="Como quer ser chamado(a)" icon={<I.user />} htmlFor="p-nome"><input id="p-nome" value={nome} onChange={e => setNome(e.target.value)} /></Field>
            <Field label="Data de nascimento" htmlFor="p-nasc"><input id="p-nasc" type="date" value={nasc} onChange={e => setNasc(e.target.value)} /></Field>
            <Field label="Cidade (para o clima e a chuva)" icon={<I.cloud />} htmlFor="p-cidade"><input id="p-cidade" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex.: Curitiba" /></Field>
          </div>
          <h3 className="section-title">Profissão</h3>
          <div className="chips-wrap">{PROFISSOES.map(p => <button type="button" key={p.id} className={"chip-op" + (profissao === p.id ? " on" : "")} aria-pressed={profissao === p.id} onClick={() => { setProfissao(p.id); setTermo(p.termo); }}>{p.id}</button>)}</div>
          <div className="fields"><Field label="Quem você atende"><Seg value={termo} onChange={setTermo} options={["Paciente", "Cliente", "Analisando"].map(v => ({ v, l: v }))} /></Field></div>
          {ehAniversario({ nascimento: nasc }) && <div className="note mint"><I.star /><span>Feliz aniversário! Hoje o app fica mais leve com você.</span></div>}
        </div>}

        {aba === "pix" && <div className="stack">
          <div className="fields"><Field label="Sua chave Pix" icon={<I.key />} htmlFor="p-pix"><input id="p-pix" value={pix} onChange={e => setPix(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" autoCapitalize="off" /></Field></div>
          <div className="hint">Ela entra sozinha no fim das mensagens de cobrança, para o {T.s} só copiar e pagar.</div>
        </div>}

        {aba === "agenda" && <div className="stack">
          <h3 className="section-title">Quando você atende</h3>
          <GradeHorarios grade={grade} periodos={periodos} onGrade={setGrade} onPeriodos={setPeriodos} />
          <div className="fields">
            <Field label="Duração da sessão (minutos)"><Seg value={dur} onChange={setDur} options={DURACOES.map(d => ({ v: d, l: String(d) }))} /></Field>
          </div>
          <Toggle on={regLembrar} onClick={() => setRegLembrar(!regLembrar)}>Lembrar do registro depois de cada sessão</Toggle>
          <Toggle on={falta.cobrar} onClick={() => setFalta({ ...falta, cobrar: !falta.cobrar })}>Cobrar falta sem aviso</Toggle>
          {falta.cobrar && <div className="fields"><Field label="Aviso mínimo para não cobrar (horas)"><Seg value={falta.horas} onChange={h => setFalta({ ...falta, horas: h })} options={[12, 24, 48].map(h => ({ v: h, l: `${h}h` }))} /></Field></div>}
        </div>}

        {aba === "dinheiro" && <div className="stack">
          <div className="fields">
            <Field label="Meta líquida do mês (R$)" icon={<I.target />} htmlFor="p-meta"><input id="p-meta" inputMode="decimal" value={meta} onChange={e => setMeta(soNumero(e.target.value))} placeholder="Sem meta" /></Field>
            <Field label={`Valor padrão da sessão para ${T.p} novos (R$)`} icon={<I.money />} htmlFor="p-valor"><input id="p-valor" inputMode="decimal" value={valorPadrao} onChange={e => setValorPadrao(soNumero(e.target.value))} placeholder="0,00" /></Field>
            <Field label="Sublocação padrão por sessão (R$)" icon={<I.door />} htmlFor="p-sub"><input id="p-sub" inputMode="decimal" value={subPadrao} onChange={e => setSubPadrao(soNumero(e.target.value))} placeholder="Sem sublocação" /></Field>
            <Field label="Separar para o imposto (% do líquido)"><Seg value={reserva} onChange={setReserva} options={[0, 10, 15, 20, 27.5].map(v => ({ v, l: v ? String(v).replace(".", ",") : "Não" }))} /></Field>
          </div>
          <div className="hint">Estimativa simples para não levar susto. O valor certo do Carnê-Leão quem calcula é o contador.</div>
          <div className="fields"><Field label="Resumo do Início"><Seg value={estilo} onChange={setEstilo} options={[{ v: "curto", l: "Direto ao ponto" }, { v: "detalhado", l: "Completo" }]} /></Field></div>
        </div>}

        {aba === "docs" && <div className="stack">
          <button className="perfil-conq" onClick={act.abrirImposto}>
            <Ilustra n="arquivo" />
            <span><b>Imposto de Renda</b><small>O que você recebeu mês a mês, com os CPFs para o Receita Saúde</small></span>
            <I.chev />
          </button>
          <div className="hint">Seus dados abaixo entram nos recibos em PDF (no paciente ou na cobrança paga).</div>
          <DadosRecibo conta={conta} act={act} />
        </div>}

        {aba === "avisos" && <div className="stack">
          <div className="fields">
            <Field label="Avisos de sessão, contas e pendências"><Seg value={avAtivo} onChange={setAvAtivo} options={[{ v: true, l: "Ligados" }, { v: false, l: "Desligados" }]} /></Field>
            <Field label="Avisar antes da sessão (minutos)"><Seg value={antec} onChange={setAntec} options={[5, 10, 15, 30].map(m => ({ v: m, l: String(m) }))} /></Field>
          </div>
          <Toggle on={avResumo} onClick={() => setAvResumo(!avResumo)}>Resumo do dia de manhã</Toggle>
          <Toggle on={avFechar} onClick={() => setAvFechar(!avFechar)}>Lembrar de fechar o dia</Toggle>
          <Toggle on={avSemana} onClick={() => setAvSemana(!avSemana)}>Resumo da semana no domingo às 20h</Toggle>
          <Toggle on={avNomes} onClick={() => setAvNomes(!avNomes)}>Mostrar o nome do {T.s} no aviso</Toggle>
          {!avNomes && <div className="hint">O aviso diz só “Sessão em {antec} min”, sem nome. Mais discreto na tela bloqueada.</div>}
          <AvisosFechado act={act} />
          {!pushLigado() && <>
            <div className="hint">Teste com o app aberto · notificações: <b>{textoPermissao[permissao] || permissao}</b></div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => testar(0)}><I.bell /> Testar aqui</button>
              <button className="btn ghost" onClick={() => testar(10000)}>Em 10 segundos</button>
            </div>
            {teste && (teste.esperando
              ? <div className="test-res"><div><I.clock /><span>Aguarde 10 segundos com o app aberto.</span></div></div>
              : <div className="test-res"><div className={teste.r === "ok" ? "ok" : "no"}>{teste.r === "ok" ? <I.check /> : <I.alert />}<span>{textoTeste[teste.r] || textoTeste.bloqueado}</span></div></div>)}
          </>}
        </div>}

        {aba === "visual" && <div className="stack">
          <div className="fields"><Field label="Aparência"><Seg value={tema.modo} onChange={tema.setModo} options={[{ v: "dark", l: "Escuro" }, { v: "light", l: "Claro" }, { v: "auto", l: "Do aparelho" }]} /></Field></div>
          <div className="fields"><Field label="Barra de baixo"><Seg value={conta.barra === "botoes" ? "botoes" : "inteira"} onChange={act.setBarra} options={[{ v: "inteira", l: "Inteira" }, { v: "botoes", l: "Botões soltos" }]} /></Field></div>
          <div className="hint">{conta.barra === "botoes" ? "Cada aba vira um botão quadrado separado, flutuando sobre a tela." : "Uma faixa só, de ponta a ponta, com as abas lado a lado."}</div>
          <h3 className="section-title">Fundo do app</h3>
          <FundoPicker fundo={conta.fundo} meus={act.meusFundos} onChange={act.setFundo} onAdd={act.addFundo} onUpdate={act.updFundo} onDelete={act.delFundo} />
          <Toggle on={conta.vidro !== false} onClick={() => act.setVidro(conta.vidro === false)}>Efeito de vidro</Toggle>
          <div className="hint">{conta.vidro === false ? "Desligado: cartões, botões e a fala ficam sólidos, mais nítidos e mais leves no celular. A foto de fundo continua aparecendo atrás." : "Ligado: cartões e botões ficam transparentes, deixando a foto de fundo aparecer por trás. Desligue se preferir tudo sólido."}</div>
          <Toggle on={vib} onClick={() => { setVib(!vib); ajustarVibrar(!vib); if (!vib) vibrar("ok"); }}>Vibrar nos toques</Toggle>
          <div className="hint">No iPhone a vibração é bem leve (o iPhone só deixa apps da web darem um toquinho).</div>
        </div>}

        {aba === "pessoal" && <div className="stack">
          <div className="note"><I.piggy /><span>O consultório tem agenda, pacientes e cobranças. A vida pessoal tem gastos, contas, transporte e caixinhas. Use os dois ou só um.</span></div>
          <Toggle on={consult} onClick={() => { if (consult && !pessoal) setPessoal(true); setConsult(!consult); }}>Usar o consultório</Toggle>
          <Toggle on={pessoal || !consult} onClick={() => { if (!consult) return; setPessoal(!pessoal); }}>Usar a vida pessoal</Toggle>
          {!consult && <div className="hint">Sem o consultório, o app abre direto nos seus gastos e some o seletor de modo. Seus pacientes ficam guardados se você voltar a usar.</div>}
          {pessoal && consult && <Toggle on={db.pessoal.incluirConsultorio} onClick={act.toggleIncluir}>Contar o líquido do consultório como entrada no Pessoal</Toggle>}
          {(pessoal || !consult) && <EntradaMes renda={db.pessoal.renda} onChange={act.salvarRenda} />}
        </div>}

        {aba === "conquistas" && <ConquistasPagina lista={conq} />}

        {aba === "link" && <LinkAgendamento db={db} conta={conta} act={act} />}

        {aba === "assinatura" && <AssinaturaPagina a={assin} setA={setAssin} tela={sub} setTela={setSub} act={act} conta={conta} />}

        {aba === "app" && <div className="stack">
          <Ilustra n="ipad" className="perfil-ilustra" />
          <div className="hint" style={{ textAlign: "center" }}>No celular, no tablet e no computador: instale em cada um e entre na mesma conta.</div>
          <InstalarApp />
          <a className="btn ghost" href={`${BASE}sobre/`} target="_blank" rel="noopener"><I.share /> Página do app, para indicar a colegas</a>
          <div className="hint">Atalhos: links do app terminados em <b>#gasto</b>, <b>#agora</b>, <b>#fechar</b> ou <b>#livres</b> abrem direto o gasto por voz, o Só o agora, o Fechar o dia e os horários livres. No Android, segure o ícone do app para ver os atalhos.</div>
        </div>}
      </div>
    </div>,
    document.body
  );
}

// Conquistas: nível, trilhas e o progresso de cada uma
// Entrada do mês (salário): valor, dia e se lança sozinho
function EntradaMes({ renda, onChange }) {
  const r0 = renda || {};
  const [valor, setValor] = useState(r0.valor ? fmtNum(r0.valor) : "");
  const [dia, setDia] = useState(String(r0.dia || 5));
  const [auto, setAuto] = useState(r0.auto !== false);
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    const t = setTimeout(() => onChange(num(valor) > 0 ? { ...r0, valor: num(valor), dia: Math.min(31, Math.max(1, Number(dia) || 5)), auto, nome: r0.nome || "Salário", lancados: r0.lancados || {} } : null), 450);
    return () => clearTimeout(t);
  }, [valor, dia, auto]);
  return <>
    <h3 className="section-title">Entrada do mês</h3>
    <div className="fields duas">
      <Field label="Quanto entra (R$)" icon={<I.money />} htmlFor="p-renda"><input id="p-renda" inputMode="decimal" value={valor} onChange={e => setValor(soNumero(e.target.value))} placeholder="Salário, pensão…" /></Field>
      <Field label="Dia que cai" htmlFor="p-rdia"><input id="p-rdia" inputMode="numeric" value={dia} onChange={e => setDia(e.target.value.replace(/D/g, "").slice(0, 2))} /></Field>
    </div>
    {num(valor) > 0 && <Toggle on={auto} onClick={() => setAuto(!auto)}>Lançar sozinho como entrada todo mês</Toggle>}
  </>;
}

function ConquistasPagina({ lista }) {
  const feitas = lista.filter(c => c.feito).length, nv = nivelDe(feitas);
  const grupos = Object.keys(TRILHAS).map(t => [t, lista.filter(c => c.trilha === t)]).filter(([, l]) => l.length);
  return (
    <div className="stack">
      <div className="conq-topo">
        <Ilustra n="trofeu" className="conq-topo-img" />
        <div className="conq-topo-tx">
          <small>Seu nível</small>
          <b>{nv.nome}</b>
          <span>{feitas} de {lista.length} conquistas</span>
          {nv.prox && <><span className="conq-bar" aria-hidden="true"><i style={{ width: `${Math.round(nv.pct * 100)}%` }} /></span><small>Faltam {nv.faltam} para “{nv.prox}”</small></>}
        </div>
      </div>
      <div className="hint">As conquistas celebram a rotina e o cuidado com o dinheiro, não a quantidade de atendimentos. Elas chegam sozinhas, conforme você usa o app.</div>
      {grupos.map(([t, l]) => (
        <div key={t} className="perfil-grupo">
          <h3>{TRILHAS[t].nome} · {l.filter(c => c.feito).length} de {l.length}</h3>
          <div className="conq-grade">
            {l.map(c => (
              <div key={c.id} className={"conq-card" + (c.feito ? " feito" : "")}>
                <Ilustra n={c.ilustra} />
                <b>{c.titulo}</b>
                <small>{c.feito ? (c.quando ? `Conquistada em ${dm(c.quando)}` : "Conquistada") : c.texto}</small>
                {!c.feito && <span className="conq-bar" aria-label={`${Math.round(c.pct * 100)}% feito`}><i style={{ width: `${Math.max(4, Math.round(c.pct * 100))}%` }} /></span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InstalarApp() {
  const [pode, setPode] = useState(!!pedidoInstalar);
  const instalado = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => { const f = () => setPode(true); window.addEventListener("pode-instalar", f); return () => window.removeEventListener("pode-instalar", f); }, []);
  if (instalado) return <div className="note mint"><I.check /><span>O app já está instalado neste aparelho.</span></div>;
  if (pode) return <button className="btn ghost" onClick={async () => { pedidoInstalar.prompt(); await pedidoInstalar.userChoice; limparPedidoInstalar(); setPode(false); }}><I.down /> Instalar na tela inicial</button>;
  if (ios) return <div className="note"><I.share /><span>Para instalar no iPhone: abra no Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Assim os avisos funcionam.</span></div>;
  return null;
}

const LIMITE_FUNDOS = 10;

function FundoPicker({ fundo, meus, onChange, onAdd, onUpdate, onDelete }) {
  const [erro, setErro] = useState("");
  const [recortar, setRecortar] = useState(null); // { src, alvo: "novo" | id do fundo }
  const [apagando, setApagando] = useState(null);
  const atual = fundo && fundo.id;
  const sel = id => atual === id || (!atual && !id);
  const carregar = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErro("Escolha um arquivo de imagem.");
    try { setRecortar({ src: await lerArquivo(f), alvo: "novo" }); setErro(""); } catch (x) { setErro("Não consegui abrir essa imagem."); }
  };
  const escolher = id => onChange(id ? { ...(fundo || {}), id } : null);
  const atualSrc = atual ? (atual.startsWith("u:") ? (meus.find(m => "u:" + m.id === atual) || {}).img : (FUNDOS.find(f => f.id === atual) || {}).img) : null;
  return (
    <>
      <div className="fundos" role="radiogroup" aria-label="Fundo do app">
        <button type="button" role="radio" aria-checked={sel(null)} className={"fundo" + (sel(null) ? " on" : "")} onClick={() => escolher(null)}><span className="fundo-img"><I.x /></span>Sem fundo</button>
        {FUNDOS.map(o => (
          <button type="button" key={o.id} role="radio" aria-checked={sel(o.id)} className={"fundo" + (sel(o.id) ? " on" : "")} onClick={() => escolher(o.id)}>
            <span className="fundo-img" style={{ backgroundImage: `url(${o.thumb})` }} />{o.nome}
          </button>
        ))}
        {meus.map((m, i) => (
          <div key={m.id} className={"fundo" + (sel("u:" + m.id) ? " on" : "")}>
            <button type="button" role="radio" aria-checked={sel("u:" + m.id)} className="fundo-img" style={{ backgroundImage: `url(${m.img})` }} onClick={() => escolher("u:" + m.id)} aria-label={`Sua foto ${i + 1}`} />
            <button type="button" className={"fundo-del" + (apagando === m.id ? " armado" : "")} aria-label={apagando === m.id ? "Toque de novo para excluir" : "Excluir este fundo"}
              onClick={() => { if (apagando === m.id) { onDelete(m.id); setApagando(null); } else { vibrar("aviso"); setApagando(m.id); setTimeout(() => setApagando(a => a === m.id ? null : a), 3500); } }}>
              {apagando === m.id ? "Excluir?" : <I.x />}
            </button>
            Sua foto {i + 1}
          </div>
        ))}
        {meus.length < LIMITE_FUNDOS && (
          <label className="fundo" htmlFor="fundo-in"><span className="fundo-img add"><I.plus /></span>Adicionar</label>
        )}
        <input id="fundo-in" className="sr" type="file" accept="image/*" onChange={carregar} />
      </div>
      <div className="hint">{meus.length}/{LIMITE_FUNDOS} fotos suas{meus.length >= LIMITE_FUNDOS ? ": exclua uma para adicionar outra" : ""}.</div>
      {erro && <div className="error">{erro}</div>}
      {fundo && atualSrc && <button className="btn ghost" onClick={() => setRecortar({ src: atualSrc, alvo: atual.startsWith("u:") ? atual.slice(2) : "novo" })}><I.pencil /> Ajustar enquadramento deste fundo</button>}
      {fundo && <Field label="Escurecer o fundo (deixa o texto mais fácil de ler)"><Seg value={fundo.veu || "medio"} onChange={v => onChange({ ...fundo, veu: v })} options={[{ v: "leve", l: "Leve" }, { v: "medio", l: "Médio" }, { v: "forte", l: "Forte" }]} /></Field>}
      {recortar && <Suspense fallback={null}><Cropper src={recortar.src} forma="tela" titulo="Ajustar fundo"
        onCancel={() => setRecortar(null)}
        onDone={async url => {
          const alvo = recortar.alvo; setRecortar(null);
          try {
            if (alvo === "novo") { if (meus.length >= LIMITE_FUNDOS) return setErro("Você chegou ao limite de 10 fotos. Exclua uma para adicionar outra."); await onAdd(url); }
            else await onUpdate(alvo, url);
          } catch (x) { setErro("Não consegui guardar essa imagem neste aparelho."); }
        }} /></Suspense>}
    </>
  );
}

export { PerfilPage };
