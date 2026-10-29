// Assinatura do Avina: planos, pagamento, garantia de 7 dias, pausar e cancelar.
// Sem teste grátis: a versão grátis tem limites, e quem assina tem 7 dias para desistir com o dinheiro de volta.
// Os botões chamam o servidor (servidor-avisos/src/asaas.js), que fala com o Asaas. Precisa da conta com login.
import React, { useState, useEffect } from "react";
import { I, Marca, Seg, Field, Ilustra, Sheet, BASE, todayISO, fromISO, pad, brlReal, MES_LONGO, vibrar, copiarTexto, lerJSON, servidorAvisos } from "../App.jsx";
import { cliente } from "../nuvem.js";
import { PLANOS, LIMITE_GRATIS, planoDe, idPlano, produtoDoUso, linkSuporte, LANCAMENTO_ATE, emLancamento, AREAS, produtoDasAreas, areasDoProduto, areasDoPerfil, separadoMensal } from "../plano.js";

// O que o plano inclui: as linhas de cada área marcada, mais o que só existe quando as áreas andam juntas
const INCLUI_AREA = {
  consultorio: ["Pacientes sem limite: agenda, cobranças, recibos e imposto", "Link de agendamento para o paciente marcar sozinho"],
  loja: ["Loja com equipe: até 5 ajudantes, cada um no seu celular", "Resumo e gastos da loja de todos os meses"],
  pessoal: ["Lançamentos pessoais sem limite: gastos, contas, caixinhas e a casa"],
};
const incluiDe = produto => {
  const a = areasDoProduto(produto);
  return [...AREAS.filter(x => a[x.id]).flatMap(x => INCLUI_AREA[x.id]),
    ...(a.consultorio && a.pessoal ? ["O líquido do consultório entrando no seu dinheiro pessoal"] : []),
    ...(a.loja && a.pessoal ? ["A retirada da loja entrando no seu dinheiro pessoal"] : []),
    "Avisos no celular, voz e cópia na nuvem"];
};
// o que a versão grátis permite, só nas áreas que a pessoa usa
const gratisTxt = perfil => { const a = areasDoPerfil(perfil); const t = [a.consultorio && `até ${LIMITE_GRATIS.pacientes} pacientes`, a.pessoal && `${LIMITE_GRATIS.lancMes} lançamentos pessoais por mês`, a.loja && `a loja sem equipe, com o resumo dos últimos ${LIMITE_GRATIS.lojaDias} dias`].filter(Boolean); return `Grátis: ${t.length > 1 ? t.slice(0, -1).join(", ") + " e " + t[t.length - 1] : t[0]}.`; };
const nomeCompleto = p => p ? `${p.nome} ${p.meses > 1 ? "anual" : "mensal"}` : "Avina Pro";
const MOTIVOS = ["Ficou caro", "Não estou usando", "Faltou alguma coisa", "Vou usar outro app", "Outro motivo"];
const TITULO_ASSIN = { planos: "Escolha seu plano", pagar: "Pagamento", pronto: "Assinatura", forma: "Forma de pagamento", historico: "Pagamentos", pausar: "Pausar assinatura", cancelar: "Cancelar assinatura" };
// voltar de qualquer tela leva para a tela da assinatura (no pagamento, "Trocar" leva aos planos)
const voltaAssin = () => null;

const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addMeses = (iso, n) => { const d = fromISO(iso); d.setMonth(d.getMonth() + n); return isoDe(d); };
const dataLonga = iso => { const d = fromISO(iso); return `${d.getDate()} de ${MES_LONGO[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ""}`; };
const porMes = p => brlReal(Math.round(p.preco / p.meses * 100) / 100);
const semPlano = () => ({ status: "sem", historico: [] });
// Garantia: cancelar até 7 dias depois do primeiro pagamento devolve tudo
// (o servidor já manda a garantia calculada: só o primeiro pagamento da assinatura atual)
const garantiaDe = a => a.garantia || null;
const naGarantia = a => !!garantiaDe(a);


function useAssinatura(conta, aoMudar) {
  // a assinatura de mentirinha das versões antigas ficava guardada aqui: não serve mais
  useEffect(() => { try { localStorage.removeItem(`agenda-assinatura:${conta.email}`); } catch (e) {} }, []);
  // Conta com login + servidor com a chave do Asaas. No computador (npm run dev), dá para testar sem login
  // com localStorage "avina-asaas-teste" = 1 (o servidor de teste aceita o e-mail da conta no lugar do login).
  const teste = import.meta.env.DEV && !conta.uid && !!lerJSON("avina-asaas-teste", false);
  const podeReal = !!(conta.uid || teste) && !!servidorAvisos();
  const [real, setReal] = useState(null);
  const [falha, setFalha] = useState(null); // null | "rede" | "erro" | "desligado"
  const [erroMsg, setErroMsg] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [cortesiaAte, setCortesiaAte] = useState(null);
  // o app inteiro precisa saber do plano (limites da versão grátis e o selo PRO)
  useEffect(() => { if (aoMudar && real) aoMudar({ estado: real, cortesiaAte }); }, [real, cortesiaAte]);
  const chamar = async (rota, corpo = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (conta.uid) {
      const { data } = await (await cliente()).auth.getSession();
      if (!data.session) throw new Error("Entre de novo na sua conta para continuar");
      headers.Authorization = `Bearer ${data.session.access_token}`;
    } else headers["X-Teste-Uid"] = conta.email;
    let r;
    try { r = await fetch(`${servidorAvisos()}/assinatura/${rota}`, { method: "POST", headers, body: JSON.stringify(corpo) }); }
    catch (e) { throw new Error("Sem internet agora. Tente de novo em instantes."); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.erro) throw new Error(j.erro || "O servidor não respondeu. Tente de novo.");
    if (j.estado) setReal(j.estado);
    if (j.cortesiaAte !== undefined) setCortesiaAte(j.cortesiaAte || null);
    return j;
  };
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!podeReal) return;
    setFalha(null);
    chamar("ver").then(j => { if (j.configurado === false) { setReal(null); setFalha("desligado"); } setSandbox(!!j.sandbox); setCortesiaAte(j.cortesiaAte || null); }).catch(e => { const semRede = /internet/i.test(e.message); setFalha(semRede ? "rede" : "erro"); setErroMsg(semRede ? "" : e.message); });
  }, [podeReal, tentativa]);
  // situacao: "ok" (veio do servidor) | "carregando" | "rede" (sem internet) | "erro" (o servidor recusou: erroMsg diz o quê) | "desligado" (sem login ou servidor sem Asaas)
  const situacao = real ? "ok" : !podeReal ? "desligado" : falha || "carregando";
  return { a: real || semPlano(), situacao, erroMsg, sandbox, cortesiaAte, chamar, tentarDeNovo: () => setTentativa(t => t + 1) };
}

// Situação de hoje: a pausa e o cancelamento terminam sozinhos na data
function situacaoDe(a) {
  const hoje = todayISO();
  if (a.status === "sem") return { s: "sem" };
  if (a.status === "aguardando" || a.status === "acabou") return { s: a.status };
  if (a.status === "pausada" && hoje < a.ate) return { s: "pausada" };
  if (a.status === "cancelada") return hoje < a.ate ? { s: "cancelada" } : { s: "acabou" };
  return { s: "ativa" };
}

function resumoAssinatura(a) {
  const sit = situacaoDe(a), P = planoDe(a.plano);
  if (sit.s === "sem") return { texto: "Escolha um plano · garantia de 7 dias" };
  if (sit.s === "acabou") return { texto: "Escolha um plano para continuar", selo: "Acabou" };
  if (sit.s === "aguardando") return { texto: "Falta pagar para começar", selo: "Pagar" };
  if (sit.s === "ativa" && a.pendente && a.pendente.atrasada) return { texto: `Cobrança de ${dataLonga(a.pendente.vencimento)} em aberto`, selo: "Pagar" };
  if (sit.s === "ativa" && !(a.historico || []).length) return { texto: `${P.nome} · grátis até ${dataLonga(a.proxima)}` };
  if (sit.s === "pausada") return { texto: `Pausada até ${dataLonga(a.ate)}` };
  if (sit.s === "cancelada") return { texto: `Cancelada · você usa até ${dataLonga(a.ate)}` };
  return { texto: `${P.nome} · renova em ${dataLonga(a.proxima)}` };
}

const formaTxt = a => a.forma === "cartao" ? (a.final ? `Cartão final ${a.final}` : "Cartão de crédito") : "Pix";
const soNumeros = s => String(s || "").replace(/\D/g, "");
const fmtCpf = s => soNumeros(s).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
function cpfValido(c) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

// Pagamento de verdade: assina (CPF e nome vão para o Asaas) e mostra o Pix aqui, ou o link da página segura do Asaas
// para o cartão. Enquanto espera, confere a cada 5 segundos se o pagamento caiu.
function PagarReal({ s, plano, forma, setForma, act, setTela, voltar }) {
  const a = s.a, P = planoDe(plano);
  const cobranca = a.pendente && (a.status === "aguardando" || a.status === "ativa") ? a.pendente : null;
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [pix, setPix] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const esperando = !!cobranca;
  const formaVale = cobranca ? cobranca.forma : forma;
  useEffect(() => {
    if (!esperando) return;
    const t = setInterval(() => { s.chamar("ver").then(j => { if (j.estado && j.estado.status === "ativa" && !(j.estado.pendente && j.estado.pendente.id === cobranca.id)) { clearInterval(t); vibrar("ok"); setTela("pronto"); } }).catch(() => {}); }, 5000);
    return () => clearInterval(t);
  }, [esperando, cobranca && cobranca.id]);
  // já existe cobrança em aberto com Pix: busca o QR
  useEffect(() => { if (cobranca && formaVale === "pix" && !pix) s.chamar("pix").then(j => setPix(j.pix)).catch(e => act.toast(e.message)); }, [cobranca && cobranca.id]);
  const assinar = async () => {
    setOcupado(true);
    try { const j = await s.chamar("assinar", { plano, forma, cpf, nome }); if (j.pix) setPix(j.pix); vibrar("ok"); }
    catch (e) { act.toast(e.message); }
    finally { setOcupado(false); }
  };
  const desistir = async () => { setOcupado(true); try { await s.chamar("cancelar", {}); act.toast("Pronto: nada foi cobrado"); voltar(); } catch (e) { act.toast(e.message); } finally { setOcupado(false); } };

  if (cobranca) return (
    <div className="stack">
      <div className="assin-resumo"><span><small>{nomeCompleto(planoDe(a.plano) || P)}</small><b>{brlReal(cobranca.valor)}</b></span><em>{cobranca.atrasada ? "Venceu" : "A pagar"}</em></div>
      {formaVale === "pix" ? (
        <div className="assin-pix">
          {pix ? <img className="assin-qr" src={`data:image/png;base64,${pix.imagem}`} alt="QR Code do Pix" /> : <div className="assin-qr assin-qr-vazio"><span className="assin-gira" /></div>}
          <small>Abra o app do seu banco, escolha <b>Pix</b> e leia o código. Ou copie e cole.</small>
          <button className="btn ghost" disabled={!pix} onClick={() => copiarTexto(pix.copiaecola, act, "Código Pix copiado")}><I.copy /> Copiar código Pix</button>
        </div>
      ) : (
        <div className="assin-pix">
          <I.lock />
          <small>O cartão é digitado na página segura do Asaas, que cuida das cobranças. O número do cartão não passa pelo Avina.</small>
          <a className="btn mode" href={cobranca.link} target="_blank" rel="noopener"><I.lock /> Pagar com cartão</a>
        </div>
      )}
      <div className="assin-espera"><span className="assin-gira" /> Esperando o pagamento… a tela muda sozinha quando cair.</div>
      {formaVale === "pix" && <a className="btn text" href={cobranca.link} target="_blank" rel="noopener">Prefiro pagar na página do Asaas</a>}
      {a.status === "aguardando" && <button className="btn text" disabled={ocupado} onClick={desistir}>Desistir de assinar</button>}
    </div>
  );

  const okCpf = cpfValido(soNumeros(cpf)), okNome = nome.trim().split(/\s+/).length >= 2;
  return (
    <div className="stack">
      <button className="assin-resumo" onClick={() => setTela("planos")}>
        <span><small>{nomeCompleto(P)}</small><b>{brlReal(P.preco)} <small>por {P.ciclo}</small></b></span><em>Trocar</em>
      </button>
      <div className="fields">
        <Field label="Nome completo" icon={<I.user />} htmlFor="a-nome"><input id="a-nome" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} placeholder="Como no documento" /></Field>
        <Field label="CPF" icon={<I.key />} htmlFor="a-cpf"><input id="a-cpf" inputMode="numeric" value={fmtCpf(cpf)} onChange={e => setCpf(soNumeros(e.target.value).slice(0, 11))} placeholder="000.000.000-00" /></Field>
      </div>
      {soNumeros(cpf).length === 11 && !okCpf && <div className="error">Confira o CPF: ele não parece certo.</div>}
      <div className="hint">O CPF é pedido pelo Asaas, que emite as cobranças. Fica só com eles.</div>
      <Field label="Como quer pagar"><Seg value={forma} onChange={setForma} options={[{ v: "pix", l: "Pix" }, { v: "cartao", l: "Cartão" }]} /></Field>
      <button className="btn mode" disabled={ocupado || !okCpf || !okNome} onClick={assinar}>
        {ocupado ? <><span className="assin-gira" /> Só um instante…</> : forma === "pix" ? <><I.check /> Gerar o Pix de {brlReal(P.preco)}</> : <><I.lock /> Continuar para o cartão</>}
      </button>
      <div className="hint assin-centro">{forma === "pix" ? `Depois, a cada ${P.ciclo}, chega um aviso com o Pix pronto para pagar.` : `O cartão é cobrado sozinho a cada ${P.ciclo}.`} Garantia de 7 dias: não gostou, devolvemos tudo.</div>
    </div>
  );
}

function AssinaturaPagina({ s, tela, setTela, act, conta }) {
  const { a } = s;
  const sit = situacaoDe(a), hoje = todayISO();
  const [ocupado, setOcupado] = useState(false);
  const [comAcesso, setComAcesso] = useState(false);
  const [acesso, setAcesso] = useState("");
  // De verdade: chama o servidor; se der certo, mostra o aviso e volta (o estado novo já veio na resposta)
  const fazer = async (rota, corpo, ok, depois = null) => {
    setOcupado(true);
    try { const j = await s.chamar(rota, corpo); vibrar("ok"); act.toast(typeof ok === "function" ? ok(j) : ok); setTela(depois); }
    catch (e) { act.toast(e.message); }
    finally { setOcupado(false); }
  };
  // plano escolhido: o atual, ou o pacote que combina com o uso do app (só pessoal ou consultório) no anual
  const [plano, setPlano] = useState(() => a.plano ? idPlano(a.plano) : `${produtoDoUso(conta.perfil)}_anual`);
  const [forma, setForma] = useState(a.forma || "pix");
  const [meses, setMeses] = useState(1);
  const [motivo, setMotivo] = useState(null);
  const P = planoDe(plano), atual = planoDe(a.plano) || P, produto = P.produto;
  // o plano é montado pelas áreas: marcar ou desmarcar uma área troca o plano (pelo menos uma fica marcada)
  const areas = areasDoProduto(produto), uso = areasDoPerfil(conta.perfil), ciclo = plano.endsWith("_mensal") ? "mensal" : "anual";
  const marcarArea = id => { const n = { ...areas, [id]: !areas[id] }; if (!AREAS.some(x => n[x.id])) return; vibrar("toque"); setPlano(`${produtoDasAreas(n)}_${ciclo}`); };
  const separado = separadoMensal(produto), mensal = PLANOS[`${produto}_mensal`].preco;
  const produtoPadrao = produtoDoUso(conta.perfil);
  // Quem já assina só troca o plano para a próxima renovação (sem cobrar a diferença)
  const trocando = sit.s === "ativa";

  useEffect(() => { if (tela === "forma") setForma(a.forma || "pix"); }, [tela]);

  // sem resposta do servidor ainda (ou sem internet): nada de planos nem de botões que cobram
  if (s.situacao !== "ok") return (
    <div className="stack">
      <div className="assin-card">
        <small>Assinatura</small>
        {s.situacao === "carregando" ? <><b>Um instante…</b><p className="assin-espera"><span className="assin-gira" /> Conferindo a sua assinatura</p></>
          : s.situacao === "erro" ? <><b>Não deu para abrir a assinatura</b><p>{s.erroMsg || "O servidor não respondeu."} Se continuar, fale com a gente.</p><button className="btn mode" onClick={s.tentarDeNovo}>Tentar de novo</button></>
          : s.situacao === "rede" ? <><b>Sem conexão agora</b><p>Para ver ou mudar a assinatura, o app precisa de internet. Seus dados continuam aqui.</p><button className="btn mode" onClick={s.tentarDeNovo}>Tentar de novo</button></>
          : <><b>Entre na sua conta</b><p>A assinatura fica ligada à sua conta com e-mail e senha.</p></>}
      </div>
      <a className="btn text" href={linkSuporte("Oi! Tenho uma dúvida sobre a assinatura do Avina.")} target="_blank" rel="noopener"><I.chat /> Dúvidas sobre a assinatura? Fale com a gente</a>
    </div>
  );

  if (tela === "planos") return (
    <div className="stack assin-pay">
      <i className="assin-logo"><Marca /></i>
      <h2>{sit.s === "sem" ? "Assine o Avina Pro" : "Continue com o Avina Pro"}</h2>
      {!trocando && emLancamento(hoje) && <div className="lanc-faixa"><b>Preço de lançamento</b><span>Assinando até {dataLonga(LANCAMENTO_ATE)}, você mantém este valor enquanto a assinatura estiver ativa.</span></div>}
      <div className="assin-areas-t"><b>O que entra no seu plano</b><small>Já marquei o que você usa no app. Pague só pelo que usar.</small></div>
      <div className="assin-areas" role="group" aria-label="Áreas do plano">
        {AREAS.map(x => (
          <button key={x.id} type="button" className={"assin-area" + (areas[x.id] ? " on" : "")} aria-pressed={!!areas[x.id]} onClick={() => marcarArea(x.id)}>
            <i className="assin-check">{areas[x.id] && <I.check />}</i>
            <span><b>{x.nome}{uso[x.id] && <em>você usa</em>}</b><small>{x.texto}</small></span>
          </button>
        ))}
      </div>
      <div className="assin-nome"><b>{P.nome}</b>{separado > mensal && <small>Separadas, estas áreas sairiam {brlReal(separado)} por mês. Juntas: {brlReal(mensal)}.</small>}</div>
      <ul className="assin-inclui">{incluiDe(produto).map(t => <li key={t}><I.check />{t}</li>)}</ul>
      <div className="assin-planos" role="radiogroup" aria-label="Plano">
        {["anual", "mensal"].map(c => {
          const id = `${produto}_${c}`, p = PLANOS[id];
          return (
            <button key={id} type="button" role="radio" aria-checked={plano === id} className={"assin-plano" + (plano === id ? " on" : "")} onClick={() => setPlano(id)}>
              {p.selo && <em>{p.selo}</em>}
              <span><b>{c === "anual" ? "Anual" : "Mensal"} · {c === "anual" && <s className="assin-riscado">{brlReal(PLANOS[`${produto}_mensal`].preco * 12)}</s>}{brlReal(p.preco)}</b><small>{p.meses > 1 ? `Só ${porMes(p)} por mês` : "Cobrado todo mês"}</small></span>
              <i className="assin-radio">{plano === id && <I.check />}</i>
            </button>
          );
        })}
      </div>
      {trocando
        ? <>
          <div className="note"><I.repeat /><span>{plano === idPlano(a.plano) ? "Esse já é o seu plano." : `O ${nomeCompleto(P)} começa em ${dataLonga(a.proxima)}, quando o atual terminar. Nada é cobrado agora.`}</span></div>
          <button className="btn mode" disabled={plano === idPlano(a.plano) || ocupado} onClick={() => {
            fazer("trocar", { plano }, `Combinado: ${nomeCompleto(P)} a partir de ${dataLonga(a.proxima)}`);
          }}>Trocar para o {nomeCompleto(P)}</button>
        </>
        : <button className="btn mode" onClick={() => setTela("pagar")}>Continuar</button>}
      <div className="hint assin-centro">Garantia de 7 dias: não gostou, devolvemos tudo. Depois, cancele quando quiser, sem multa e sem fidelidade. A assinatura se renova sozinha até você cancelar. Ao assinar, você concorda com os <a href={`${BASE}termos/#planos`} target="_blank" rel="noopener">Termos de uso</a>.</div>
    </div>
  );

  if (tela === "pagar") return <PagarReal s={s} plano={plano} forma={forma} setForma={setForma} act={act} setTela={setTela} voltar={() => setTela(null)} />;

  if (tela === "pronto") return (
    <div className="stack assin-pronto">
      <Ilustra n="trofeu" className="perfil-ilustra" />
      <h2>Tudo certo!</h2>
      <p>Seu <b>{nomeCompleto(atual)}</b> está ativo.<br />{(a.historico || []).length ? "A próxima" : "A primeira"} cobrança é em {dataLonga(a.proxima)}, e a gente avisa 3 dias antes.</p>
      {naGarantia(a) && <div className="note mint"><I.check /><span>Garantia de 7 dias: se não gostar, cancele até {dataLonga(garantiaDe(a).ate)} e devolvemos tudo.</span></div>}
      <button className="btn mode" onClick={() => setTela(null)}>Pronto</button>
    </div>
  );

  if (tela === "forma") return (
    <div className="stack">
      <Field label="Forma de pagamento"><Seg value={forma} onChange={setForma} options={[{ v: "pix", l: "Pix" }, { v: "cartao", l: "Cartão" }]} /></Field>
      <div className="hint">{forma === "pix" ? `Três dias antes de vencer, chega um aviso com o Pix pronto para pagar.` : `Na próxima cobrança, você digita o cartão na página segura do Asaas. Depois, ele é cobrado sozinho a cada ${atual.ciclo}.`}</div>
      <button className="btn mode" disabled={ocupado || forma === a.forma} onClick={() => fazer("forma", { forma }, "Forma de pagamento trocada")}>Salvar</button>
    </div>
  );

  if (tela === "historico") return (
    <div className="stack">
      {(a.historico || []).length ? (
        <div className="perfil-lista">
          {a.historico.map((h, i) => (
            <div key={i} className="perfil-row assin-hist">
              <i><I.receipt /></i><span><b>{dataLonga(h.data)}</b><small>{nomeCompleto(planoDe(h.plano))} · {h.forma === "cartao" ? "Cartão" : "Pix"}</small></span>
              <span className="assin-hist-v"><b className="num">{brlReal(h.valor)}</b><small className={h.devolvido ? "devolvido" : ""}>{h.devolvido ? "Devolvido" : "Pago"}</small></span>
            </div>
          ))}
        </div>
      ) : <div className="hint assin-centro">Nenhum pagamento ainda.</div>}
    </div>
  );

  if (tela === "pausar") {
    const volta = addMeses(hoje, meses);
    return (
      <div className="stack">
        <div className="note"><I.clock /><span>Precisa de um tempo? Pause em vez de cancelar. Nada é cobrado, e seus dados ficam guardados do jeitinho que estão.</span></div>
        <Field label="Pausar por"><Seg value={meses} onChange={setMeses} options={[1, 2, 3].map(m => ({ v: m, l: m === 1 ? "1 mês" : `${m} meses` }))} /></Field>
        <div className="hint">Volta sozinha em <b>{dataLonga(volta)}</b>. Se quiser voltar antes, é só tocar em “Voltar agora”.</div>
        <button className="btn mode" disabled={ocupado} onClick={() => fazer("pausar", { meses }, `Assinatura pausada até ${dataLonga(volta)}`)}>Pausar por {meses === 1 ? "1 mês" : `${meses} meses`}</button>
      </div>
    );
  }

  if (tela === "cancelar") return (
    <div className="stack">
      <h3 className="section-title">Antes de ir…</h3>
      <div className="perfil-lista">
        <button className="perfil-row" onClick={() => setTela("pausar")}><i><I.clock /></i><span><b>Pausar em vez de cancelar</b><small>Até 3 meses sem pagar nada</small></span><I.chev /></button>
        {idPlano(a.plano || "").endsWith("_mensal") && <button className="perfil-row" onClick={() => { setPlano(`${atual.produto}_anual`); setTela("planos"); }}><i><I.star /></i><span><b>Mudar para o anual</b><small>Sai por {porMes(PLANOS[`${atual.produto}_anual`])} por mês</small></span><I.chev /></button>}
      </div>
      <h3 className="section-title">Conta pra gente o motivo <small>opcional</small></h3>
      <div className="chips-wrap">{MOTIVOS.map(m => <button type="button" key={m} className={"chip-op" + (motivo === m ? " on" : "")} aria-pressed={motivo === m} onClick={() => setMotivo(motivo === m ? null : m)}>{m}</button>)}</div>
      {naGarantia(a)
        ? <div className="note mint"><I.check /><span>Você está nos 7 dias de garantia: devolvemos os <b>{brlReal(garantiaDe(a).valor)}</b> do mesmo jeito que você pagou. Seus dados ficam guardados se quiser voltar.</span></div>
        : <div className="hint">Você continua usando tudo até <b>{dataLonga(a.proxima)}</b>. Depois disso, seus dados ficam guardados se quiser voltar.</div>}
      <button className="btn danger" disabled={ocupado} onClick={() => fazer("cancelar", { motivo }, j => j.devolvido ? `Assinatura cancelada. Devolvemos ${brlReal(j.devolvido)}` : "Assinatura cancelada")}>{naGarantia(a) ? "Cancelar e receber de volta" : "Cancelar assinatura"}</button>
    </div>
  );

  // código de acesso (criado pelo dono do app com criar-codigo.sh): libera o Pro por alguns dias.
  // Aparece para quem ainda não tem o Pro pago (sem plano, assinatura acabada ou esperando o primeiro pagamento)
  const codigoAcesso = comAcesso
    ? <div className="assin-acesso">
      <Field label="Código de acesso" htmlFor="a-acesso"><input id="a-acesso" autoCapitalize="characters" autoComplete="off" value={acesso} onChange={e => setAcesso(e.target.value.toUpperCase())} placeholder="Ex.: AVNK7M2QX" /></Field>
      <button className="btn ghost" disabled={acesso.trim().length < 4 || ocupado} onClick={() => fazer("codigo", { codigo: acesso }, j => `Pronto! O Pro está liberado até ${dataLonga(j.cortesiaAte)}.`)}>{ocupado ? "Só um instante…" : "Usar o código"}</button>
    </div>
    : <button className="btn text" onClick={() => setComAcesso(true)}><I.key /> Tenho um código de acesso</button>;

  // Tela principal
  return (
    <div className="stack">
      {sit.s === "sem" || sit.s === "acabou" ? (
        <div className={"assin-card" + (sit.s === "acabou" ? " acabou" : "")}>
          <small>Assinatura</small>
          <b>{sit.s === "acabou" ? "Sua assinatura terminou" : "Escolha seu plano"}</b>
          <p>{sit.s === "acabou" ? "Seus dados continuam guardados. Escolha um plano para continuar anotando." : `A partir de ${porMes(PLANOS.pessoal_anual)} por mês. Garantia de 7 dias: não gostou, devolvemos tudo.`}</p>
          {sit.s === "sem" && <p className="assin-gratis">{gratisTxt(conta.perfil)}</p>}
          {s.cortesiaAte && hoje < s.cortesiaAte && <div className="note mint"><I.star /><span>O Pro completo está liberado de presente até {dataLonga(s.cortesiaAte)}. Depois, você escolhe se quer assinar.</span></div>}
          <button className="btn mode" onClick={() => setTela("planos")}>Escolher meu plano</button>
          {codigoAcesso}
        </div>
      ) : sit.s === "aguardando" ? (
        <div className="assin-card acabou">
          <small>{nomeCompleto(atual)}</small>
          <b>Falta pagar</b>
          <p>{brlReal(a.pendente ? a.pendente.valor : atual.preco)} para começar. Assim que o pagamento cair, a assinatura fica ativa sozinha.</p>
          <button className="btn mode" onClick={() => setTela("pagar")}>{a.forma === "cartao" ? "Pagar com cartão" : "Pagar com Pix"}</button>
          {codigoAcesso}
        </div>
      ) : (
        <div className="assin-card">
          <small>Seu plano · <span className="pro-selo">PRO</span></small>
          <div className="assin-card-topo">
            <b>{atual.nome}</b>
            <em className={sit.s}>{{ ativa: "Ativa", pausada: "Pausada", cancelada: "Cancelada" }[sit.s]}</em>
          </div>
          <p className="num">{atual.meses > 1 ? "Anual" : "Mensal"} · {brlReal(atual.preco)} por {atual.ciclo}</p>
          <p>{sit.s === "ativa" ? ((a.historico || []).length ? `Renova em ${dataLonga(a.proxima)}` : `Grátis até ${dataLonga(a.proxima)}. A primeira cobrança é nesse dia.`) : sit.s === "pausada" ? `Volta sozinha em ${dataLonga(a.ate)}. Nada é cobrado até lá.` : `Você usa tudo até ${dataLonga(a.ate)}. Depois, seus dados ficam guardados.`}</p>
          {sit.s === "ativa" && a.pendente && a.pendente.atrasada && <>
            <div className="note amber"><I.alert /><span>A cobrança de {dataLonga(a.pendente.vencimento)} ainda não foi paga.</span></div>
            <button className="btn mode" onClick={() => setTela("pagar")}>Pagar agora</button>
          </>}
          {sit.s === "pausada" && <button className="btn mode" disabled={ocupado} onClick={() => fazer("voltar", {}, "Que bom ter você de volta")}>Voltar agora</button>}
          {sit.s === "cancelada" && <button className="btn mode" disabled={ocupado} onClick={() => fazer("voltar", {}, "Assinatura reativada")}>Continuar assinando</button>}
        </div>
      )}

      {(sit.s === "sem" || sit.s === "acabou") && (
        <div className="perfil-grupo">
          <h3>O que vem no Avina Pro</h3>
          <ul className="assin-inclui">{incluiDe(produtoPadrao).map(t => <li key={t}><I.check />{t}</li>)}</ul>
        </div>
      )}

      {((a.plano && sit.s !== "acabou" && sit.s !== "sem") || (a.historico || []).length > 0) && (
        <div className="perfil-lista">
          {a.plano && sit.s !== "acabou" && sit.s !== "sem" && <button className="perfil-row" onClick={() => setTela("forma")}><i><I.wallet /></i><span><b>Forma de pagamento</b><small>{formaTxt(a)}</small></span><I.chev /></button>}
          {(a.historico || []).length > 0 && <button className="perfil-row" onClick={() => setTela("historico")}><i><I.receipt /></i><span><b>Pagamentos</b><small>{a.historico.length} {a.historico.length === 1 ? "pagamento" : "pagamentos"}</small></span><I.chev /></button>}
          {sit.s === "ativa" && <button className="perfil-row" onClick={() => { setPlano(idPlano(a.plano)); setTela("planos"); }}><i><I.repeat /></i><span><b>Trocar de plano</b><small>Anual ou mensal, um pacote ou os dois</small></span><I.chev /></button>}
        </div>
      )}

      {sit.s === "ativa" && <>
        <button className="assin-pausar" onClick={() => setTela("pausar")}><I.clock /> Pausar assinatura</button>
        <button className="btn text" onClick={() => setTela("cancelar")}>Cancelar assinatura</button>
      </>}

      <a className="btn text" href={linkSuporte("Oi! Tenho uma dúvida sobre a assinatura do Avina.")} target="_blank" rel="noopener"><I.chat /> Dúvidas sobre a assinatura? Fale com a gente</a>

      {s.sandbox && <div className="assin-demo"><b>Asaas em modo de teste</b><small>As cobranças são de teste (sandbox): nenhum dinheiro de verdade passa por aqui.</small></div>}
    </div>
  );
}

// Passou do limite da versão grátis: mostra o que o Pro libera (nada do que já está anotado se perde)
function ProSheet({ motivo, sugerido, onClose, act }) {
  const pac = motivo === "pac", lj = String(motivo || "").startsWith("loja");
  // o plano das áreas que a pessoa usa (o que travou sempre está entre elas)
  const produto = PLANOS[`${sugerido}_anual`] ? sugerido : lj ? "loja" : pac ? "consultorio" : "pessoal", P = PLANOS[`${produto}_anual`];
  return (
    <Sheet title={lj ? (motivo === "loja-equipe" ? "Sua equipe no caixa" : "Todo o histórico da loja") : pac ? `Você chegou a ${LIMITE_GRATIS.pacientes} pacientes` : `Você chegou a ${LIMITE_GRATIS.lancMes} lançamentos este mês`}
      sub={lj ? (motivo === "loja-equipe" ? "Na versão grátis, a loja é só sua. No Pro Loja, quem ajuda anota junto, cada um no seu celular." : `Na versão grátis, o resumo e os gastos mostram os últimos ${LIMITE_GRATIS.lojaDias} dias. Nada do que foi anotado se perde.`) : pac ? `Na versão grátis, dá para acompanhar até ${LIMITE_GRATIS.pacientes} pacientes ativos.` : `Na versão grátis, dá para anotar até ${LIMITE_GRATIS.lancMes} lançamentos por mês. No mês que vem, o contador zera.`} onClose={onClose}>
      <div className="pro-topo"><i className="assin-logo"><Marca /></i><b>Avina Pro</b><span className="pro-selo">PRO</span></div>
      <ul className="assin-inclui">{incluiDe(produto).map(t => <li key={t}><I.check />{t}</li>)}</ul>
      <div className="note mint"><I.star /><span>{P.nome}: {porMes(P)} por mês no plano anual.{emLancamento(todayISO()) ? ` Preço de lançamento até ${dataLonga(LANCAMENTO_ATE)}: quem assina agora mantém o valor.` : ""} Garantia de 7 dias: não gostou, devolvemos tudo.</span></div>
      <button className="btn mode" onClick={() => { onClose(); setTimeout(() => act.openSettings("assinatura"), 250); }}>Conhecer o Avina Pro</button>
      <button className="btn text" onClick={onClose}>Agora não</button>
    </Sheet>
  );
}

export { AssinaturaPagina, ProSheet, useAssinatura, resumoAssinatura, TITULO_ASSIN, voltaAssin };
