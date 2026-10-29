// Painel do dono: lista de contas e a ficha de cada uma (com as ações)
import React, { useEffect, useMemo, useState } from "react";
import {
  NOME_MODO, TEM_PRO, addDias, aparelho, baixarCsv, bloqueada, Confirmar, Copiar, dt, fData, fDataHora, fDiaMes, fNum, fReais, fRede, hojeBR,
  modosDe, nomeLista, ondeDe, planoDe, relativo, totalItens, ultimoUso, ultimoUsoIso,
} from "./util.jsx";

export const FILTROS = {
  todas: ["Todas", () => true],
  pro: ["Com Pro", (u, p) => TEM_PRO.includes(p.tipo)],
  pago: ["Pagando", (u, p) => p.tipo === "pago"],
  codigo: ["Por código", (u, p) => p.tipo === "codigo" || !!p.codigo],
  cortesia: ["Cortesia", (u, p) => p.tipo === "cortesia" || p.tipo === "antiga"],
  antiga: ["Conta antiga", (u, p) => p.tipo === "antiga"],
  aguardando: ["Aguardando pagamento", (u, p) => p.tipo === "aguardando"],
  cancelada: ["Cancelaram", (u, p) => p.tipo === "cancelada"],
  gratis: ["Grátis", (u, p) => p.tipo === "gratis"],
  ativas: ["Usaram em 7 dias", u => ultimoUso(u) > Date.now() - 7 * 864e5],
  paradas: ["Paradas há 30+ dias", u => ultimoUso(u) < Date.now() - 30 * 864e5],
  incompletas: ["Cadastro incompleto", u => !u.perfil_feito],
  bloqueadas: ["Bloqueadas", u => bloqueada(u)],
};
const ORDENS = {
  novas: ["Mais novas", (a, b) => String(b.criado_em).localeCompare(String(a.criado_em))],
  uso: ["Último uso", (a, b) => ultimoUso(b) - ultimoUso(a)],
  itens: ["Mais itens", (a, b) => totalItens(b) - totalItens(a)],
  nome: ["Nome", (a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR")],
};

export function Contas({ usuarios, kv, abrir, filtro, setFiltro, fontes, avisar }) {
  const [busca, setBusca] = useState(""), [ordem, setOrdem] = useState("novas"), [avisoTodos, setAvisoTodos] = useState(false);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return usuarios
      .filter(u => FILTROS[filtro][1](u, planoDe(u, kv)))
      .filter(u => !q || [u.nome, u.email, u.cidade, u.regiao, u.ip, u.rede, u.profissao, u.id, planoDe(u, kv).rotulo].some(v => String(v || "").toLowerCase().includes(q)))
      .sort(ORDENS[ordem][1]);
  }, [usuarios, kv, busca, filtro, ordem]);
  const csv = () => baixarCsv("avina-contas", ["id", "email", "nome", "cadastro", "ultimo_uso", "ip", "operadora", "cidade", "uf", "aparelho", "modos", "plano", "itens"],
    lista.map(u => [u.id, u.email, u.nome, u.criado_em, ultimoUsoIso(u), u.ip, fRede(u.rede), u.cidade, u.regiao, aparelho(u.aparelho),
      modosDe(u).map(m => NOME_MODO[m]).join("+"), planoDe(u, kv).rotulo, totalItens(u)]));
  return (
    <section className="contas">
      <div className="filtros">
        <input type="search" placeholder="Buscar por nome, e-mail, cidade, IP, operadora ou código" value={busca} onChange={e => setBusca(e.target.value)} />
        <select value={ordem} onChange={e => setOrdem(e.target.value)} aria-label="Ordenar">
          {Object.entries(ORDENS).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <button className="botao leve" onClick={csv}>Baixar planilha</button>
        {!kv.erro && <button className="botao leve" onClick={() => setAvisoTodos(true)}>Aviso para todos</button>}
      </div>
      <div className="chips">
        {Object.entries(FILTROS).map(([k, [n, f]]) => {
          const qtd = usuarios.filter(u => f(u, planoDe(u, kv))).length;
          return (k === "todas" || qtd > 0 || filtro === k) && <button key={k} className={"chip" + (filtro === k ? " sim" : "")} onClick={() => setFiltro(k)}>{n} <small>{qtd}</small></button>;
        })}
      </div>
      <p className="contador">{fNum(lista.length)} {lista.length === 1 ? "conta" : "contas"}</p>
      <div className="tabela-rola">
        <table className="tabela-contas">
          <thead><tr><th>Conta</th><th>Cadastro</th><th>Último uso</th><th>IP e operadora</th><th>Onde</th><th>Aparelho</th><th>Modos</th><th>Plano</th><th className="num">Itens</th></tr></thead>
          <tbody>
            {lista.map(u => {
              const p = planoDe(u, kv);
              return (
                <tr key={u.id} onClick={() => abrir(u)} tabIndex={0} onKeyDown={e => e.key === "Enter" && abrir(u)}>
                  <td><b>{u.nome || "(sem nome)"}</b>{u.admin && <span className="selo">admin</span>}{bloqueada(u) && <span className="selo ruim">bloqueada</span>}<small>{u.email}</small></td>
                  <td>{fData(u.criado_em)}</td>
                  <td title={fDataHora(ultimoUsoIso(u))}>{relativo(ultimoUsoIso(u))}</td>
                  <td><span className="mono">{u.ip || "—"}</span>{u.ips_30d > 1 && <span className="selo" title="IPs diferentes nos últimos 30 dias">{u.ips_30d} IPs</span>}<small>{fRede(u.rede)}</small></td>
                  <td>{ondeDe(u)}</td>
                  <td>{aparelho(u.aparelho)}</td>
                  <td>{modosDe(u).map(m => NOME_MODO[m]).join(", ") || <span className="fraco">incompleto</span>}</td>
                  <td><span className={"plano " + p.tipo}>{p.rotulo}</span>{p.teste && <span className="selo">teste</span>}</td>
                  <td className="num">{fNum(totalItens(u))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {avisoTodos && <Aviso todos fontes={fontes} fechar={() => setAvisoTodos(false)} avisar={avisar} total={kv.aparelhosComAviso} />}
    </section>
  );
}

// Escrever uma notificação para o celular (de uma conta ou de todos os aparelhos)
function Aviso({ u, todos, fontes, fechar, avisar, total }) {
  const [titulo, setTitulo] = useState(""), [corpo, setCorpo] = useState("");
  return (
    <Confirmar titulo={todos ? `Aviso para todos os aparelhos (${fNum(total)})` : `Aviso no celular de ${u.nome || u.email}`} botao="Enviar"
      texto={<div className="form">
        <label>Título<input value={titulo} maxLength={90} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Novidade no Avina" autoFocus /></label>
        <label>Texto<textarea value={corpo} maxLength={180} rows={3} onChange={e => setCorpo(e.target.value)} placeholder="Até 180 letras" /></label>
        <p className="nota">Chega como notificação em até 1 minuto, nos aparelhos que ligaram os avisos.</p>
      </div>}
      onNao={fechar}
      onSim={async () => {
        if (!titulo.trim()) throw new Error("Escreva o título.");
        const r = await fontes.aviso({ uid: u && u.id, todos: !!todos, titulo, corpo });
        avisar(`Aviso enviado para ${fNum(r.aparelhos)} ${r.aparelhos === 1 ? "aparelho" : "aparelhos"}.`); fechar();
      }} />
  );
}

/* ---------- ficha de uma conta ---------- */
export function Ficha({ u, kv, fontes, fechar, recarregar, avisar, eu }) {
  const [acessos, setAcessos] = useState(null), [asaas, setAsaas] = useState(null), [pergunta, setPergunta] = useState(null);
  const [dias, setDias] = useState(30), [ateData, setAteData] = useState("");
  useEffect(() => { setAcessos(null); setAsaas(null); fontes.acessos(u.id).then(setAcessos, e => setAcessos({ erro: e.message })); }, [u.id]);
  useEffect(() => { const k = e => e.key === "Escape" && !pergunta && fechar(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [pergunta]);
  const p = planoDe(u, kv), a = p.a || {}, hoje = hojeBR();
  const verAsaas = () => { setAsaas({ carregando: true }); fontes.asaas(u.id).then(setAsaas, e => setAsaas({ erro: e.message })); };
  const listas = Object.entries(u.contagem || {}).sort((x, y) => y[1] - x[1]);
  const protegida = u.admin || u.id === eu;
  // faz a ação, avisa e recarrega os dados do painel
  const feito = (msg, fecharFicha) => { setPergunta(null); avisar(msg); recarregar(); if (fecharFicha) fechar(); };
  const perguntar = (titulo, texto, botao, f, extra = {}) => setPergunta({ titulo, texto, botao, onSim: f, ...extra });
  const cortesiaBase = a.cortesiaAte && a.cortesiaAte > hoje ? a.cortesiaAte : hoje;
  const novaAte = ateData || addDias(cortesiaBase, Number(dias) || 30);
  const ipsDiferentes = acessos && !acessos.erro ? [...new Set(acessos.map(x => x.ip).filter(Boolean))] : [];
  return (
    <div className="ficha-fundo" onClick={fechar}>
      <aside className="ficha" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Conta de ${u.nome || u.email}`}>
        <header>
          <div><h2>{u.nome || "(sem nome)"}</h2><p>{u.email} <Copiar texto={u.email} /></p></div>
          <button className="fechar" onClick={fechar} aria-label="Fechar">×</button>
        </header>
        <div className="selos">
          {u.admin && <span className="selo">admin</span>}
          <span className={"selo " + (u.dois_passos ? "ok" : "")}>{u.dois_passos ? "2 etapas ligada" : "sem 2 etapas"}</span>
          <span className="selo">{u.email_ok ? "e-mail confirmado" : "e-mail não confirmado"}</span>
          {bloqueada(u) && <span className="selo ruim">bloqueada até {dt(u.bloqueado_ate).getFullYear() > 2100 ? "sempre" : fData(u.bloqueado_ate)}</span>}
          <span className={"plano " + p.tipo}>{p.rotulo}</span>
        </div>

        <h3>Conta</h3>
        <dl>
          <dt>Cadastro</dt><dd>{fDataHora(u.criado_em)} <small>({relativo(u.criado_em)})</small></dd>
          <dt>Último login</dt><dd>{fDataHora(u.ultimo_login)}</dd>
          <dt>Último acesso</dt><dd>{fDataHora(u.ultimo_acesso)} {u.ultimo_acesso && <small>({relativo(u.ultimo_acesso)})</small>}</dd>
          <dt>Última mudança</dt><dd>{fDataHora(u.ultima_mudanca)}</dd>
          <dt>Profissão</dt><dd>{u.profissao || "—"}</dd>
          <dt>Cidade (perfil)</dt><dd>{u.cidade_perfil || "—"}</dd>
          <dt>Modos</dt><dd>{modosDe(u).map(m => NOME_MODO[m]).join(", ") || "cadastro incompleto"}</dd>
          <dt>Entrou com</dt><dd>{u.provedor} · {fNum(u.sessoes)} {u.sessoes === 1 ? "sessão aberta" : "sessões abertas"}</dd>
          <dt>ID</dt><dd><code>{u.id}</code> <Copiar texto={u.id} /></dd>
        </dl>

        <h3>IP e aparelho</h3>
        <dl>
          <dt>Último IP</dt><dd>{u.ip ? <><span className="mono">{u.ip}</span> <Copiar texto={u.ip} /> · <a href={`https://ipinfo.io/${u.ip}`} target="_blank" rel="noreferrer noopener">detalhes ↗</a></> : "—"}</dd>
          <dt>Operadora</dt><dd>{u.rede || "—"}</dd>
          <dt>Onde</dt><dd>{ondeDe(u)}</dd>
          <dt>Aparelho</dt><dd title={u.aparelho || ""}>{aparelho(u.aparelho)}</dd>
          <dt>30 dias</dt><dd>{fNum(u.acessos_30d)} acessos de {fNum(u.ips_30d)} {u.ips_30d === 1 ? "IP" : "IPs"}</dd>
          <dt>Primeiro acesso</dt><dd>{fDataHora(u.primeiro_acesso)}</dd>
        </dl>

        <h3>Plano</h3>
        {kv.erro ? <p className="aviso">O servidor de avisos não respondeu: {kv.erro}</p> : (
          <dl>
            <dt>Agora</dt><dd><span className={"plano " + p.tipo}>{p.rotulo}</span>{p.teste && <span className="selo">teste (sandbox)</span>}</dd>
            <dt>Servidor vê</dt><dd>{a.nivel === "pro" ? "Pro" : a.nivel === "gratis" ? "Grátis" : "ainda não abriu a tela de assinatura"}</dd>
            {(a.codigos || []).map(c => <React.Fragment key={c.codigo}><dt>Código</dt><dd><b className="mono">{c.codigo}</b> usado em {fData(c.dia)}</dd></React.Fragment>)}
            {a.cortesiaAte && <><dt>Cortesia</dt><dd>até {fData(a.cortesiaAte)}{a.cortesiaAte < hoje ? " (venceu)" : ""}</dd></>}
            {p.antiga && <><dt>Conta antiga</dt><dd>Pro até {fData(p.antiga)}{p.antiga < hoje ? " (venceu)" : ""}</dd></>}
            {a.plano && <><dt>Assinatura</dt><dd>{a.nomePlano} · desde {fData(a.desde)} · {a.forma === "cartao" ? "cartão" : a.forma || "—"}</dd></>}
            {a.pagamentos > 0 && <><dt>Pagou</dt><dd>{fReais(a.totalPago)} em {a.pagamentos} {a.pagamentos === 1 ? "pagamento" : "pagamentos"}{a.devolvidos ? ` · ${a.devolvidos} devolvido(s)` : ""}</dd></>}
            {a.motivo && <><dt>Cancelou porque</dt><dd>{a.motivo}</dd></>}
          </dl>
        )}
        {!kv.erro && kv.asaasLigado && (a.plano || a.assinando) && (
          asaas == null ? <button className="botao leve" onClick={verAsaas}>Ver no Asaas agora</button>
            : asaas.carregando ? <p className="vazio">Perguntando ao Asaas…</p>
              : asaas.erro ? <p className="erro">{asaas.erro}</p>
                : <dl className="asaas">
                  <dt>Situação</dt><dd>{asaas.status}</dd>
                  {asaas.proxima && <><dt>Próxima cobrança</dt><dd>{fData(asaas.proxima)}</dd></>}
                  {asaas.pendente && <><dt>Em aberto</dt><dd>{fReais(asaas.pendente.valor)} · vence {fData(asaas.pendente.vencimento)}{asaas.pendente.atrasada ? " (atrasada)" : ""}</dd></>}
                  {asaas.garantia && <><dt>Garantia</dt><dd>até {fData(asaas.garantia.ate)}</dd></>}
                  {(asaas.historico || []).map(h => <React.Fragment key={h.id}><dt>{fData(h.data)}</dt><dd>{fReais(h.valor)} · {h.forma}{h.devolvido ? " · devolvido" : ""}</dd></React.Fragment>)}
                </dl>
        )}

        <h3>Uso <small>(só quantidades)</small></h3>
        <dl>
          {listas.map(([c, n]) => <React.Fragment key={c}><dt>{nomeLista(c)}</dt><dd>{fNum(n)}</dd></React.Fragment>)}
          {!listas.length && <><dt>Na nuvem</dt><dd className="fraco">nada guardado ainda</dd></>}
          {u.casa && <><dt>Casa</dt><dd>{u.casa}</dd></>}
          {u.loja && <><dt>Loja</dt><dd>{u.loja.nome} <small>({u.loja.papel})</small></dd></>}
          {!kv.erro && <>
            <dt>Link de agendamento</dt><dd>{a.link ? <><a href={`${location.origin}/agendar/?${a.link}`} target="_blank" rel="noreferrer">{a.link} ↗</a>{a.pedidosAbertos ? ` · ${a.pedidosAbertos} pedidos esperando` : ""}</> : "não publicou"}</dd>
            <dt>Avisos no celular</dt><dd>{a.aparelhos ? `${a.aparelhos} ${a.aparelhos === 1 ? "aparelho" : "aparelhos"}` : "nenhum aparelho"}</dd>
            <dt>IA hoje</dt><dd>{fNum(a.vozHoje || 0)} de voz · {fNum(a.iaHoje || 0)} da Bolinha e fotos</dd>
          </>}
        </dl>

        <h3>Ações</h3>
        <div className="acoes-ficha">
          {!kv.erro && <div className="acao">
            <b>Dar o Pro (cortesia)</b>
            <div className="linha">
              <select value={ateData ? "data" : dias} onChange={e => { if (e.target.value === "data") setAteData(addDias(hoje, 30)); else { setAteData(""); setDias(e.target.value); } }}>
                {[7, 15, 30, 60, 90, 180, 365].map(d => <option key={d} value={d}>+{d} dias</option>)}
                <option value="data">até um dia…</option>
              </select>
              {ateData && <input type="date" value={ateData} min={hoje} onChange={e => setAteData(e.target.value)} />}
              <button className="botao" onClick={() => perguntar("Dar o Pro", <p>{u.nome || u.email} fica com o Pro liberado até <b>{fData(novaAte)}</b>.</p>, "Dar o Pro",
                async () => { await fontes.cortesia(u.id, novaAte); feito(`Pro liberado até ${fDiaMes(novaAte)}.`); })}>Dar até {fDiaMes(novaAte)}</button>
            </div>
            {a.cortesiaAte && a.cortesiaAte >= hoje && <button className="link" onClick={() => perguntar("Tirar a cortesia", <p>A cortesia até {fData(a.cortesiaAte)} sai agora. Assinatura paga e cortesia de conta antiga continuam valendo.</p>, "Tirar",
              async () => { await fontes.cortesia(u.id, null); feito("Cortesia tirada."); })}>Tirar a cortesia</button>}
          </div>}
          <div className="botoes-acao">
            {!kv.erro && <button className="botao leve" disabled={!a.aparelhos} title={a.aparelhos ? "" : "Essa conta não ligou os avisos em nenhum aparelho"} onClick={() => setPergunta({ aviso: true })}>Mandar aviso no celular</button>}
            <button className="botao leve" onClick={() => perguntar("Mandar link para trocar a senha", <p>Vai um e-mail para <b>{u.email}</b> com o link para criar uma senha nova.</p>, "Mandar",
              async () => { await fontes.trocarSenha(u.email); feito("E-mail de trocar a senha enviado."); })}>Link para trocar a senha</button>
            <button className="botao leve" disabled={protegida} onClick={() => perguntar("Desconectar de todos os aparelhos", <p>{u.nome || u.email} vai precisar entrar de novo em todos os aparelhos (o que já está aberto vale por até 1 hora).</p>, "Desconectar",
              async () => { await fontes.desconectar(u.id); feito("Desconectada de todos os aparelhos."); })}>Desconectar de tudo</button>
            {bloqueada(u)
              ? <button className="botao leve" onClick={() => perguntar("Desbloquear", <p>{u.nome || u.email} volta a conseguir entrar.</p>, "Desbloquear", async () => { await fontes.bloquear(u.id, 0); feito("Conta desbloqueada."); })}>Desbloquear</button>
              : <button className="botao leve" disabled={protegida} onClick={() => setPergunta({ bloquear: true })}>Bloquear</button>}
            <button className="botao leve" disabled={u.id === eu} onClick={() => perguntar(u.admin ? "Tirar o admin" : "Dar admin",
              u.admin ? <p>{u.email} deixa de abrir o painel.</p> : <p><b>{u.email}</b> passa a ver e mexer em tudo neste painel (com a verificação em 2 etapas). Só para quem você confia de verdade.</p>,
              u.admin ? "Tirar" : "Dar admin", async () => { await fontes.definirAdmin(u.id, !u.admin); feito(u.admin ? "Admin tirado." : "Agora é admin."); }, { perigo: !u.admin })}>{u.admin ? "Tirar admin" : "Dar admin"}</button>
            <button className="botao perigo" disabled={protegida} title={protegida ? "Não dá para excluir a sua conta nem a de outro admin" : ""} onClick={() => perguntar("Excluir a conta",
              <><p>Apaga <b>para sempre</b> a conta de {u.nome || u.email} e tudo o que ela guardou na nuvem{a.assinando ? ", e cancela a assinatura no Asaas" : ""}.</p><p>Não tem como desfazer. Os registros de acesso ficam os 6 meses que a lei pede.</p></>,
              "Excluir para sempre", async () => { const r = await fontes.excluir(u.id); feito(r.avisos && r.avisos.length ? "Conta excluída. " + r.avisos.join(" ") : "Conta excluída.", true); }, { perigo: true, digitar: u.email })}>Excluir conta</button>
          </div>
          {protegida && <p className="nota">{u.id === eu ? "Esta é a sua conta." : "Conta de admin: tire o admin antes de bloquear ou excluir."}</p>}
        </div>

        <h3>Acessos <small>(guardados 6 meses)</small></h3>
        {ipsDiferentes.length > 1 && <p className="nota">{ipsDiferentes.length} IPs diferentes: {ipsDiferentes.slice(0, 8).join(", ")}{ipsDiferentes.length > 8 ? "…" : ""}</p>}
        {acessos == null ? <p className="vazio">Carregando…</p>
          : acessos.erro ? <p className="erro">{acessos.erro}</p>
            : !acessos.length ? <p className="vazio">Nenhum acesso registrado ainda.</p>
              : <div className="tabela-rola"><table className="acessos">
                <thead><tr><th>Quando</th><th>IP</th><th>Operadora</th><th>Cidade</th><th>Aparelho</th></tr></thead>
                <tbody>{acessos.map((x, i) => (
                  <tr key={i}>
                    <td>{fDataHora(x.quando)}{x.ultimo !== x.quando && <small>até {fDataHora(x.ultimo).slice(-5)}</small>}</td>
                    <td className="mono">{x.ip || "—"}</td>
                    <td>{fRede(x.rede) || "—"}</td>
                    <td>{ondeDe(x)}</td>
                    <td title={x.aparelho || ""}>{aparelho(x.aparelho)}</td>
                  </tr>
                ))}</tbody>
              </table></div>}

        {pergunta && pergunta.aviso && <Aviso u={u} fontes={fontes} fechar={() => setPergunta(null)} avisar={avisar} />}
        {pergunta && pergunta.bloquear && <Bloquear u={u} fontes={fontes} fechar={() => setPergunta(null)} feito={feito} />}
        {pergunta && pergunta.titulo && <Confirmar {...pergunta} onNao={() => setPergunta(null)} />}
      </aside>
    </div>
  );
}

function Bloquear({ u, fontes, fechar, feito }) {
  const [dias, setDias] = useState(7);
  return (
    <Confirmar titulo={`Bloquear ${u.nome || u.email}`} botao="Bloquear" perigo onNao={fechar}
      texto={<div className="form">
        <label>Por quanto tempo
          <select value={dias} onChange={e => setDias(Number(e.target.value))}>
            <option value={1}>1 dia</option><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={36500}>Para sempre</option>
          </select>
        </label>
        <p className="nota">Sai de todos os aparelhos e não consegue entrar até lá. Os dados continuam guardados.</p>
      </div>}
      onSim={async () => { await fontes.bloquear(u.id, dias); feito(dias > 3650 ? "Conta bloqueada para sempre." : `Conta bloqueada por ${dias} ${dias === 1 ? "dia" : "dias"}.`); }} />
  );
}
