// Parte do app carregada sob demanda (só quando é aberta): as perguntas iniciais.
// Primeiro a pessoa diz como vai usar (consultório, vida pessoal ou os dois) e só vê as perguntas que importam.
// As respostas do lado pessoal já montam o app: contas fixas, veículo, caixinha e a entrada do mês.
import React, { useState } from "react";
import { PROFISSOES, fmtNum, idadeDe, PhotoPicker, Field, I, todayISO, DURACOES, num, soNumero, Seg, AVISOS_PADRAO, vibrar, Ilustra, uid, brl } from "../App.jsx";
import { fotoDoVeiculo } from "../transporte.js";
import { noApp } from "../app-nativo.js";

// As três áreas do app: a pessoa marca uma ou mais (as mesmas do seletor de modo, do Perfil e dos planos)
const AREAS_OB = [
  ["consultorio", "Consultório", "Atendo pacientes: agenda, cobranças e recibos", "ipad"],
  ["loja", "Minha loja", "Vendo doces, lanches, roupas…: caixa, gastos e o que falta", "carrinho"],
  ["pessoal", "Meu dinheiro", "Gastos, contas, carro e caixinhas da casa", "dinheiro"],
];
// Tipos de loja e o que costuma sair mais (o preço é a pessoa que coloca; estes são só exemplos)
const TIPOS_LOJA = [
  ["doces", "Doces e bolos", "🍫", [["Brigadeiro", "3,00"], ["Bolo (fatia)", "10,00"], ["Brownie", "8,00"], ["Bolo de pote", "12,00"], ["Trufa", "4,00"], ["Cento de docinhos", "120,00"]]],
  ["sorvete", "Sorvete e açaí", "🍦", [["Sorvete 1 bola", "8,00"], ["Sorvete 2 bolas", "13,00"], ["Picolé", "5,00"], ["Açaí 300 ml", "15,00"], ["Açaí 500 ml", "22,00"], ["Milkshake", "18,00"]]],
  ["salgados", "Salgados e lanches", "🥟", [["Coxinha", "7,00"], ["Pastel", "9,00"], ["Esfiha", "6,00"], ["Lanche", "18,00"], ["Cento de salgados", "90,00"], ["Refrigerante lata", "6,00"]]],
  ["cafe", "Café e padaria", "☕", [["Café", "5,00"], ["Cappuccino", "9,00"], ["Pão de queijo", "5,00"], ["Misto quente", "10,00"], ["Suco", "8,00"], ["Bolo (fatia)", "9,00"]]],
  ["roupas", "Roupas e acessórios", "👗", [["Camiseta", "50,00"], ["Calça", "90,00"], ["Vestido", "110,00"], ["Acessório", "25,00"]]],
  ["outra", "Outra coisa", "🛍️", []],
];
const PAGS_LOJA = [["dinheiro", "Dinheiro", "💵"], ["pix", "Pix", "⚡"], ["cartao", "Cartão", "💳"]];
// [nome, categoria, dia comum de vencimento]
const CONTAS_COMUNS = [["Aluguel", "casa", 5], ["Condomínio", "casa", 10], ["Luz", "casa", 15], ["Água", "casa", 15], ["Internet", "casa", 10], ["Celular", "casa", 10], ["Streaming", "lazer", 5], ["Academia", "saude", 5], ["Plano de saúde", "saude", 10], ["Escola", "outros", 10], ["Financiamento", "casa", 10], ["Cartão de crédito", "compras", 10]];
const LOCOMOCAO = [["carro", "Carro", "🚗"], ["moto", "Moto", "🏍️"], ["bike", "Bike", "🚲"], ["nenhum", "App e ônibus", "🚌"], ["", "Não preciso", "🚶"]];
const OBJETIVOS = [["🛟", "Reserva de emergência"], ["✈️", "Viagem"], ["🚗", "Carro"], ["🏠", "Casa"], ["🎓", "Estudos"], ["🎁", "Outro objetivo"]];

function Onboarding({ conta, onDone, onSair }) {
  const p0 = conta.perfil || {};
  const [i, setI] = useState(0);
  const [nome, setNome] = useState(conta.nome || "");
  const [foto, setFoto] = useState(conta.foto || null);
  const [nasc, setNasc] = useState(p0.nascimento || "");
  // veio por um convite para a casa? A casa fica no lado pessoal, então ele já vem escolhido
  const [convidado] = useState(() => { try { return !!localStorage.getItem("agenda-convite-casa"); } catch (e) { return false; } });
  // ...ou para ajudar numa loja: o modo Loja já vem escolhido
  const [convidadoLoja] = useState(() => { try { return !!localStorage.getItem("agenda-convite-loja"); } catch (e) { return false; } });
  // áreas escolhidas: as do perfil (quem refaz o cadastro), ou a do convite (casa = dinheiro pessoal, loja = loja)
  const [areas, setAreas] = useState(() => p0.consultorio !== undefined || p0.pessoal !== undefined || p0.loja
    ? { consultorio: p0.consultorio !== false, loja: p0.loja === true, pessoal: p0.pessoal !== false }
    : convidadoLoja ? { loja: true } : convidado ? { pessoal: true } : {});
  // lado da loja (quem vem por convite entra na loja de alguém: não monta uma loja nova)
  const [lojaNome, setLojaNome] = useState(""), [lojaTipo, setLojaTipo] = useState("");
  const [prods, setProds] = useState({}); // nome -> preço digitado
  const [extra, setExtra] = useState("");
  const [pags, setPags] = useState({ dinheiro: true, pix: true });
  const [chavePix, setChavePix] = useState(""), [troco, setTroco] = useState("");
  const [equipe, setEquipe] = useState(p0.lojaEquipe === true ? "ajuda" : "");
  const [prof, setProf] = useState(p0.profissao ? (PROFISSOES.some(x => x.id === p0.profissao) ? p0.profissao : "Outra") : "");
  const [outra, setOutra] = useState(p0.profissao && !PROFISSOES.some(x => x.id === p0.profissao) ? p0.profissao : "");
  const [termo, setTermo] = useState(p0.termo || "");
  const [dur, setDur] = useState(p0.duracao || 0);
  const [valor, setValor] = useState(p0.valorPadrao ? fmtNum(p0.valorPadrao) : "");
  const [temSub, setTemSub] = useState(p0.subPadrao ? "sim" : p0.valorPadrao ? "nao" : "");
  const [sub, setSub] = useState(p0.subPadrao ? String(p0.subPadrao).replace(".", ",") : "");
  const [subTipo, setSubTipo] = useState(p0.subTipo || "fixed");
  const [meta, setMeta] = useState(p0.meta ? fmtNum(p0.meta) : "");
  const [cidade, setCidade] = useState(p0.cidade || "");
  // lado pessoal
  const [renda, setRenda] = useState(""), [diaRenda, setDiaRenda] = useState("5"), [rendaAuto, setRendaAuto] = useState(true), [somarConsult, setSomarConsult] = useState(true);
  const [contas, setContas] = useState({}); // nome -> { valor, dia }
  const [locom, setLocom] = useState(null), [modelo, setModelo] = useState("");
  const [obj, setObj] = useState(null), [metaObj, setMetaObj] = useState("");
  const [erro, setErro] = useState("");

  const idade = idadeDe(nasc);
  const profissao = prof === "Outra" ? outra.trim() : prof;
  const consult = !!areas.consultorio, pessoal = !!areas.pessoal, lojaUso = !!areas.loja, montaLoja = lojaUso && !convidadoLoja;
  const tipoL = TIPOS_LOJA.find(t => t[0] === lojaTipo);
  const sugestoes = [...(tipoL ? tipoL[3] : []), ...Object.keys(prods).filter(n => !(tipoL && tipoL[3].some(x => x[0] === n))).map(n => [n, ""])];
  const marcarProd = n => setProds(p => { const x = { ...p }; if (n in x) delete x[n]; else x[n] = ""; return x; });
  const addExtra = () => { const n = extra.trim(); if (!n) return; setProds(p => ({ ...p, [n]: p[n] || "" })); setExtra(""); };
  const escolherProf = id => { setProf(id); setTermo((PROFISSOES.find(x => x.id === id) || { termo: "Cliente" }).termo); };
  const Choice = ({ on, onClick, children, sub, wide }) => <button type="button" className={"choice" + (on ? " on" : "") + (wide ? " wide" : "")} aria-pressed={on} onClick={onClick}>{children}{sub && <small>{sub}</small>}</button>;
  const marcarConta = ([n, , dia]) => setContas(c => { const x = { ...c }; if (x[n]) delete x[n]; else x[n] = { valor: "", dia: String(dia) }; return x; });
  const upConta = (n, k, v) => setContas(c => ({ ...c, [n]: { ...c[n], [k]: v } }));

  const passos = [
    { id: "nome", q: "Como você quer ser chamado(a)?", why: "É assim que eu vou falar com você todo dia.",
      valida: () => !nome.trim() ? "Escreva como quer ser chamado(a)." : nasc && (idade < 16 || idade > 100) ? "Confere o ano de nascimento, por favor." : "",
      body: <><PhotoPicker nome={nome} foto={foto} onChange={setFoto} />
        <div className="fields">
          <Field label="Seu nome" icon={<I.user />} htmlFor="o-nome"><input id="o-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Camila" autoComplete="given-name" /></Field>
          <Field label="Aniversário (opcional)" icon={<I.cal />} htmlFor="o-nasc"><input id="o-nasc" type="date" value={nasc} max={todayISO()} onChange={e => setNasc(e.target.value)} /></Field>
        </div>
        <div className="hint">No dia do seu aniversário o app fica mais leve com você.</div></> },
    { id: "uso", q: "O que você quer organizar no Avina?", why: "Marque uma ou mais. Cada uma vira um modo do app, e dá pra mudar depois no Perfil.",
      valida: () => consult || pessoal || lojaUso ? "" : "Marque pelo menos uma.",
      body: <><div className="ob-usos">{AREAS_OB.map(([k, t, d, ilu]) => (
        <button key={k} type="button" className={"ob-uso" + (areas[k] ? " on" : "")} aria-pressed={!!areas[k]} onClick={() => { setAreas(a => ({ ...a, [k]: !a[k] })); vibrar("toque"); }}>
          <Ilustra n={ilu} /><span><b>{t}</b><small>{d}</small></span>{areas[k] && <i><I.check /></i>}
        </button>
      ))}</div>
        {convidadoLoja && <div className="hint">Você veio por um convite para ajudar numa <b>loja</b>: para quem ajuda, é grátis.</div>}
        {convidado && !convidadoLoja && <div className="hint">Você veio por um convite: a casa fica em <b>Meu dinheiro</b>, e entrar nela é grátis.</div>}</> },
    ...(consult ? [
      { id: "area", q: "Qual é a sua área?", why: "Assim eu uso as palavras certas da sua profissão.",
        valida: () => !profissao ? (prof === "Outra" ? "Escreva sua área." : "Escolha uma opção.") : !termo ? "Diga como chama quem você atende." : "",
        body: <><div className="choices">{PROFISSOES.map(x => <Choice key={x.id} on={prof === x.id} onClick={() => escolherProf(x.id)}>{x.id}</Choice>)}<Choice wide on={prof === "Outra"} onClick={() => escolherProf("Outra")}>Outra área</Choice></div>
          {prof === "Outra" && <div className="fields"><Field label="Qual?" htmlFor="o-outra"><input id="o-outra" value={outra} onChange={e => setOutra(e.target.value)} placeholder="Ex.: Arteterapia" /></Field></div>}
          {prof && <><div className="hint">Quem você atende, você chama de:</div><Seg value={termo} onChange={setTermo} options={["Paciente", "Cliente", "Analisando"].map(v => ({ v, l: v }))} /></>}</> },
      { id: "sessao", q: "Como são as suas sessões?", why: "Já deixo a duração e o valor prontos quando você cadastrar alguém. Dá pra mudar a qualquer hora.",
        valida: () => !dur ? "Escolha a duração." : !(num(valor) > 0) ? "Digite o valor da sessão." : !temSub ? "Diga se paga sublocação." : temSub === "sim" && !(num(sub) > 0) ? "Digite o valor da sublocação." : "",
        body: <><div className="hint">Duração</div>
          <Seg value={dur} onChange={setDur} options={DURACOES.map(d => ({ v: d, l: `${d} min` }))} />
          <div className="hint">Valor normal da sessão</div>
          <label className="big-amt" htmlFor="o-valor"><span>R$</span><input id="o-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(soNumero(e.target.value))} aria-label="Valor da sessão" /></label>
          <div className="hint">Você paga sublocação de sala?</div>
          <div className="choices"><Choice on={temSub === "sim"} onClick={() => setTemSub("sim")}>Sim</Choice><Choice on={temSub === "nao"} onClick={() => setTemSub("nao")}>Não</Choice></div>
          {temSub === "sim" && <div className="fields"><Field label={subTipo === "percent" ? "Sublocação (% da sessão)" : "Sublocação por sessão (R$)"} icon={<I.door />} htmlFor="o-sub"><input id="o-sub" inputMode="decimal" value={sub} onChange={e => setSub(soNumero(e.target.value))} placeholder={subTipo === "percent" ? "20" : "25,00"} /><Seg value={subTipo} onChange={setSubTipo} options={[{ v: "fixed", l: "Valor fixo" }, { v: "percent", l: "Porcentagem" }]} /></Field></div>}</> },
      { id: "meta", q: "Quanto você quer ganhar por mês?", why: "Com uma meta, eu mostro se o mês está no ritmo e quantas sessões faltam.", opcional: () => setMeta(""),
        valida: () => "",
        body: <><label className="big-amt in" htmlFor="o-meta"><span>R$</span><input id="o-meta" inputMode="decimal" placeholder="0,00" value={meta} onChange={e => setMeta(soNumero(e.target.value))} aria-label="Meta mensal" /></label><div className="hint" style={{ textAlign: "center" }}>Valor líquido, já sem a sublocação.</div></> },
    ] : []),
    ...(montaLoja ? [
      { id: "loja", q: "Como se chama a sua loja?", why: "É o nome que aparece no caixa e nos resumos que você manda pelo WhatsApp.",
        valida: () => !lojaNome.trim() ? "Escreva o nome da loja." : !lojaTipo ? "Diga o que a loja vende." : "",
        body: <><div className="fields"><Field label="Nome da loja" icon={<I.home />} htmlFor="o-loja"><input id="o-loja" value={lojaNome} onChange={e => setLojaNome(e.target.value)} placeholder="Ex.: Doces da Ana" maxLength={60} autoComplete="organization" /></Field></div>
          <div className="hint">O que ela vende?</div>
          <div className="choices">{TIPOS_LOJA.map(([k, n, e]) => <Choice key={k} on={lojaTipo === k} onClick={() => setLojaTipo(k)}><span className="ob-emoji" aria-hidden="true">{e}</span>{n}</Choice>)}</div></> },
      { id: "loja-prod", q: "O que você mais vende?", why: "Cada produto vira um botão no caixa: um toque e a venda está anotada. Toque nos que você tem e coloque o preço.", opcional: () => setProds({}),
        valida: () => { const f = Object.entries(prods).find(([, v]) => !(num(v) > 0)); return f ? `Falta o preço de ${f[0]} (ou toque nele de novo para tirar).` : ""; },
        body: <>{sugestoes.length > 0 && <div className="ob-chips">{sugestoes.map(([n]) => <button key={n} type="button" className={"ob-chip" + (n in prods ? " on" : "")} aria-pressed={n in prods} onClick={() => marcarProd(n)}>{n in prods && <I.check />}{n}</button>)}</div>}
          <div className="ob-add"><input value={extra} onChange={e => setExtra(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }} placeholder="Outro produto (ex.: Bolo de cenoura)" aria-label="Outro produto" maxLength={40} /><button type="button" className="icon-btn" onClick={addExtra} disabled={!extra.trim()} aria-label="Adicionar produto"><I.plus /></button></div>
          {Object.keys(prods).length > 0 && <div className="ob-contas">
            {Object.entries(prods).map(([n, v]) => { const ex = (sugestoes.find(x => x[0] === n) || [])[1]; return (
              <div key={n} className="ob-conta ob-prod">
                <b>{n}</b>
                <label className="ob-conta-v"><span>R$</span><input inputMode="decimal" value={v} onChange={e => setProds(p => ({ ...p, [n]: soNumero(e.target.value) }))} placeholder={ex || "0,00"} aria-label={`Preço de ${n}`} /></label>
              </div>
            ); })}
            <div className="hint">Outros produtos você coloca depois, direto no caixa.</div>
          </div>}</> },
      { id: "loja-pag", q: "Como seus clientes pagam?", why: "Com a chave Pix, o caixa mostra um QR code com o valor certo da venda. Com o troco, eu já sei quanto deveria ter na gaveta.", opcional: () => { setChavePix(""); setTroco(""); },
        valida: () => "",
        body: <><div className="choices">{PAGS_LOJA.map(([k, n, e]) => <Choice key={k} on={!!pags[k]} onClick={() => setPags(p => ({ ...p, [k]: !p[k] }))}><span className="ob-emoji" aria-hidden="true">{e}</span>{n}</Choice>)}</div>
          {pags.pix && <div className="fields"><Field label="Chave Pix da loja (opcional)" icon={<I.key />} htmlFor="o-pix"><input id="o-pix" value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="Celular, e-mail, CPF/CNPJ ou aleatória" autoComplete="off" /></Field></div>}
          {pags.dinheiro && <div className="fields"><Field label="Quanto deixa de troco na gaveta? (opcional)" icon={<I.wallet />} htmlFor="o-troco"><input id="o-troco" inputMode="decimal" value={troco} onChange={e => setTroco(soNumero(e.target.value))} placeholder="Ex.: 50,00" /></Field></div>}</> },
      { id: "loja-equipe", q: "Alguém te ajuda na loja?", why: "Quem ajuda pode anotar as vendas no próprio celular, e você vê tudo na hora.",
        valida: () => equipe ? "" : "Escolha uma opção.",
        body: <><div className="choices"><Choice on={equipe === "so"} onClick={() => setEquipe("so")}>Só eu</Choice><Choice on={equipe === "ajuda"} onClick={() => setEquipe("ajuda")}>Tenho ajuda</Choice></div>
          {equipe === "ajuda" && <div className="hint">Depois é só mandar o convite em <b>Ajustes da loja</b>. {noApp ? "Quem ajuda não paga nada." : "A equipe faz parte do Pro Loja, e quem ajuda não paga nada."}</div>}</> },
    ] : []),
    ...(pessoal ? [
      { id: "renda", q: consult ? "Fora o consultório, entra algum dinheiro por mês?" : "Quanto entra por mês, mais ou menos?", why: "Com isso eu mostro quanto sobra no mês e aviso se o ritmo de gastos está alto.", opcional: () => setRenda(""),
        valida: () => num(renda) > 0 && !(Number(diaRenda) >= 1 && Number(diaRenda) <= 31) ? "Escolha o dia em que o dinheiro cai (1 a 31)." : "",
        body: <><label className="big-amt in" htmlFor="o-renda"><span>R$</span><input id="o-renda" inputMode="decimal" placeholder="0,00" value={renda} onChange={e => setRenda(soNumero(e.target.value))} aria-label="Quanto entra por mês" /></label>
          <div className="hint" style={{ textAlign: "center" }}>Salário, pensão, aluguel que recebe… o total do mês.</div>
          {num(renda) > 0 && <>
            <div className="fields"><Field label="Em que dia cai?" icon={<I.cal />} htmlFor="o-dia"><input id="o-dia" inputMode="numeric" value={diaRenda} onChange={e => setDiaRenda(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="5" /></Field></div>
            <button type="button" className={"ob-toggle" + (rendaAuto ? " on" : "")} aria-pressed={rendaAuto} onClick={() => setRendaAuto(!rendaAuto)}><span className="box">{rendaAuto && <I.check />}</span>Lançar sozinho como entrada todo mês, nesse dia</button>
          </>}
          {consult && <button type="button" className={"ob-toggle" + (somarConsult ? " on" : "")} aria-pressed={somarConsult} onClick={() => setSomarConsult(!somarConsult)}><span className="box">{somarConsult && <I.check />}</span>Somar também o que sobra do consultório</button>}</> },
      { id: "contas", q: "Quais contas fixas você paga?", why: "Eu aviso um dia antes de vencer e no dia. Toque nas que você tem e coloque o valor.", opcional: () => setContas({}),
        valida: () => { const f = Object.entries(contas).find(([, c]) => !(num(c.valor) > 0)); return f ? `Falta o valor de ${f[0]} (ou toque nela de novo para tirar).` : Object.entries(contas).find(([, c]) => !(Number(c.dia) >= 1 && Number(c.dia) <= 31)) ? "Confira o dia de vencimento (1 a 31)." : ""; },
        body: <><div className="ob-chips">{CONTAS_COMUNS.map(c => <button key={c[0]} type="button" className={"ob-chip" + (contas[c[0]] ? " on" : "")} aria-pressed={!!contas[c[0]]} onClick={() => marcarConta(c)}>{contas[c[0]] && <I.check />}{c[0]}</button>)}</div>
          {Object.keys(contas).length > 0 && <div className="ob-contas">
            {Object.entries(contas).map(([n, c]) => (
              <div key={n} className="ob-conta">
                <b>{n}</b>
                <label className="ob-conta-v"><span>R$</span><input inputMode="decimal" value={c.valor} onChange={e => upConta(n, "valor", soNumero(e.target.value))} placeholder="0,00" aria-label={`Valor de ${n}`} /></label>
                <label className="ob-conta-d"><span>dia</span><input inputMode="numeric" value={c.dia} onChange={e => upConta(n, "dia", e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label={`Dia de vencimento de ${n}`} /></label>
              </div>
            ))}
            <div className="hint">Outras contas você coloca depois, em Contas.</div>
          </div>}</> },
      { id: "locom", q: "Como você se locomove no dia a dia?", why: "Com carro ou moto, eu mostro o preço do combustível na sua cidade, o consumo e lembro da troca de óleo e do IPVA.", opcional: () => setLocom(null),
        valida: () => locom === null ? "Escolha uma opção (ou pule)." : "",
        body: <><div className="choices">{LOCOMOCAO.map(([k, n, e]) => <Choice key={n} on={locom === k} onClick={() => setLocom(k)}><span className="ob-emoji" aria-hidden="true">{e}</span>{n}</Choice>)}</div>
          {(locom === "carro" || locom === "moto") && <>
            <div className="fields"><Field label={`Qual ${locom === "moto" ? "moto" : "carro"}? (opcional)`} htmlFor="o-mod"><input id="o-mod" value={modelo} onChange={e => setModelo(e.target.value)} placeholder={locom === "moto" ? "Ex.: CG 160" : "Ex.: Onix, Tracker, Corolla"} autoComplete="off" /></Field></div>
            {locom === "carro" && modelo.trim().length > 2 && (() => { const f = fotoDoVeiculo({ tipo: "carro", foto: "auto", nome: modelo }); return f && <div className="ob-carro"><Ilustra n={f[2]} /><small>{f[1]}</small></div>; })()}
          </>}</> },
      { id: "objetivo", q: "Quer juntar dinheiro pra alguma coisa?", why: "Eu crio uma caixinha e mostro quanto falta. Guardar fica mais fácil com um objetivo.", opcional: () => { setObj(null); setMetaObj(""); },
        valida: () => "",
        body: <><div className="ob-chips">{OBJETIVOS.map(([e, n]) => <button key={n} type="button" className={"ob-chip" + (obj && obj[1] === n ? " on" : "")} aria-pressed={!!(obj && obj[1] === n)} onClick={() => setObj(obj && obj[1] === n ? null : [e, n])}><span aria-hidden="true">{e}</span>{n}</button>)}</div>
          {obj && <label className="big-amt in" htmlFor="o-metaobj"><span>R$</span><input id="o-metaobj" inputMode="decimal" placeholder="Quanto? (opcional)" value={metaObj} onChange={e => setMetaObj(soNumero(e.target.value))} aria-label="Meta da caixinha" /></label>}</> },
    ] : []),
    { id: "cidade", q: consult ? "Em que cidade você atende?" : lojaUso && !pessoal ? "Em que cidade fica a sua loja?" : "Em que cidade você mora?", opcional: () => setCidade(""),
      why: lojaUso && !consult && !pessoal ? "Pra mostrar o clima do dia e completar o Pix da loja." : consult && !pessoal ? "Pra eu avisar quando for chover perto do horário das suas sessões." : "Pra mostrar o clima, avisar da chuva e buscar o preço do combustível da semana na sua cidade.",
      valida: () => "",
      body: <div className="fields"><Field label="Cidade" icon={<I.cloud />} htmlFor="o-cidade"><input id="o-cidade" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex.: Curitiba" autoComplete="address-level2" /></Field></div> },
  ];
  const n = passos.length, P = passos[Math.min(i, n - 1)];

  const terminar = () => {
    const c0 = PROFISSOES.find(x => x.id === profissao);
    const perfil = { ...p0, refazer: undefined, nascimento: nasc, consultorio: consult, pessoal, loja: lojaUso, lojaEquipe: montaLoja ? equipe === "ajuda" : p0.lojaEquipe, cidade: cidade.trim(), estilo: p0.estilo || "detalhado", avisos: p0.avisos || AVISOS_PADRAO,
      ...(consult ? { profissao, termo, duracao: dur, valorPadrao: num(valor), subPadrao: temSub === "sim" ? num(sub) : 0, subTipo, meta: num(meta) || 0 } : { termo: p0.termo || (c0 ? c0.termo : "Paciente") }) };
    // o que já vai pronto para o lado pessoal
    const inicial = pessoal ? {
      incluirConsultorio: consult ? somarConsult : false,
      renda: num(renda) > 0 ? { valor: num(renda), dia: Number(diaRenda) || 5, auto: rendaAuto, nome: "Salário", lancados: {} } : null,
      contas: Object.entries(contas).map(([nm, c]) => ({ id: uid(), nome: nm, valor: num(c.valor), dia: Number(c.dia), cat: (CONTAS_COMUNS.find(x => x[0] === nm) || [, "casa"])[1], assinatura: nm === "Streaming" || nm === "Academia", pagas: {} })),
      veiculos: locom ? [{ id: uid(), tipo: locom, foto: "auto", nome: locom === "nenhum" ? "" : modelo.trim(), combustivel: locom === "carro" || locom === "moto" ? "flex" : "", oleoKm: 10000, oleoMeses: 12 }] : [],
      caixinhas: obj ? [{ id: uid(), nome: obj[1], emoji: obj[0], meta: num(metaObj), prazo: null, movs: [] }] : [],
    } : null;
    // a loja já sai montada: nome, botões do caixa, chave Pix e o troco de hoje
    const lojaIni = montaLoja ? { nome: lojaNome.trim(), tipo: lojaTipo, produtos: Object.entries(prods).filter(([, v]) => num(v) > 0).map(([n, v]) => ({ nome: n, preco: num(v) })),
      pix: pags.pix ? chavePix.trim() : "", troco: pags.dinheiro && num(troco) > 0 ? num(troco) : null, cidade: cidade.trim() } : null;
    onDone({ nome: nome.trim(), foto, perfil, inicial: inicial || lojaIni ? { ...(inicial || {}), ...(lojaIni ? { loja: lojaIni } : {}) } : null });
  };
  const ir = k => { setErro(""); if (k >= n) terminar(); else { setI(k); window.scrollTo(0, 0); } };
  const avancar = () => { const e = P.valida(); if (e) { vibrar("erro"); return setErro(e); } vibrar("toque"); ir(i + 1); };
  const resumo = () => {
    if (P.id !== "cidade" || !(pessoal || montaLoja)) return null;
    const np = Object.keys(prods).length;
    const itens = [montaLoja && `a loja ${lojaNome.trim()}${np ? ` com ${np} ${np === 1 ? "produto" : "produtos"} no caixa` : ""}`, montaLoja && pags.pix && chavePix.trim() && "o Pix da loja",Object.keys(contas).length && `${Object.keys(contas).length} ${Object.keys(contas).length === 1 ? "conta fixa" : "contas fixas"}`, locom && locom !== "nenhum" && (modelo.trim() || LOCOMOCAO.find(x => x[0] === locom)[1]), obj && `caixinha ${obj[1]}`, num(renda) > 0 && `entrada de ${brl(num(renda))}`].filter(Boolean);
    return itens.length ? <div className="ob-resumo"><I.check /><span>Vou deixar pronto: {itens.join(", ")}.</span></div> : null;
  };
  return (
    <main className="ob">
      <div className="ob-top">
        {i > 0 ? <button className="icon-btn" onClick={() => { setI(i - 1); setErro(""); }} aria-label="Voltar"><I.chevL /></button> : <button className="icon-btn" onClick={onSair} aria-label="Sair"><I.x /></button>}
        <div className="ob-prog" style={{ gridTemplateColumns: `repeat(${n},1fr)` }} aria-hidden="true">{passos.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
        <span className="ob-step">{Math.min(i, n - 1) + 1} de {n}</span>
      </div>
      <div>
        <h1 className="ob-q">{P.q}</h1>
        <div className="ob-why"><I.chat /><span>{P.why}</span></div>
      </div>
      {/* Enter no teclado avança */}
      <form className="ob-body" key={P.id} onSubmit={e => { e.preventDefault(); avancar(); }} noValidate>{P.body}{resumo()}<button type="submit" hidden aria-hidden="true" tabIndex={-1} /></form>
      {erro && <div className="error" role="alert">{erro}</div>}
      <div className="ob-foot">
        <button className="btn" onClick={avancar}>{i >= n - 1 ? "Tudo certo, começar" : "Continuar"}</button>
        {P.opcional && <button className="btn text" onClick={() => { P.opcional(); ir(i + 1); }}>Pular por agora</button>}
      </div>
    </main>
  );
}

export { Onboarding };
