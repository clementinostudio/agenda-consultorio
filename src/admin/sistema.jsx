// Painel do dono: Supabase (banco) e Cloudflare (servidor, KV, IA, site), cada um com o limite do plano grátis
import React, { useEffect, useState } from "react";
import { Barras, Medidor, fBytes, fDataHora, fNum, relativo } from "./util.jsx";

// Limites dos planos grátis (conferir de vez em quando: as empresas mudam)
const LIMITE = {
  banco: 500 * 1024 ** 2, storage: 1024 ** 3, mau: 50000,      // Supabase Free
  pedidos: 100000, kvLeitura: 100000, kvEscrita: 1000, kvApaga: 1000, kvLista: 1000, kvTamanho: 1024 ** 3, neuronios: 10000, // Cloudflare Free (por dia)
};

export default function Sistema({ fontes, resumo }) {
  const [sb, setSb] = useState(null), [cf, setCf] = useState(null), [busy, setBusy] = useState(false);
  const carregarCf = atualizar => { setBusy(true); fontes.cloudflare(atualizar).then(setCf, e => setCf({ erro: e.message })).finally(() => setBusy(false)); };
  useEffect(() => { fontes.sistema().then(setSb, e => setSb({ erro: e.message })); carregarCf(false); }, []);
  return (
    <section>
      <h3 className="titulo-secao">Supabase <small>(banco e logins · plano grátis)</small></h3>
      {!sb ? <p className="vazio">Carregando…</p> : sb.erro ? <p className="erro">{sb.erro}</p> : (
        <>
          <div className="medidores">
            <Medidor rotulo="Tamanho do banco" usado={sb.banco_bytes} limite={LIMITE.banco} formato={fBytes} />
            <Medidor rotulo="Contas ativas no mês" usado={resumo.ativos.d30} limite={LIMITE.mau} nota="o Supabase conta quem entra" />
            {sb.storage && <Medidor rotulo="Arquivos (storage)" usado={sb.storage.bytes} limite={LIMITE.storage} formato={fBytes} nota={`${fNum(sb.storage.arquivos)} arquivos`} />}
          </div>
          <div className="blocos">
            <div className="bloco">
              <h3>Agora</h3>
              <table><tbody>
                <tr><td>Sessões abertas (aparelhos logados)</td><td className="num">{fNum(sb.sessoes_abertas)}</td></tr>
                <tr><td>Conexões com o banco</td><td className="num">{fNum(sb.conexoes)}</td></tr>
                <tr><td>Leituras da memória (cache)</td><td className="num">{sb.cache == null ? "—" : `${sb.cache.toLocaleString("pt-BR")}%`}</td></tr>
                <tr><td>Contas bloqueadas</td><td className="num">{fNum(sb.bloqueadas)}</td></tr>
                {Object.entries(sb.contas_por_entrada || {}).map(([k, n]) => <tr key={k}><td>Entram com {k === "email" ? "e-mail e senha" : k}</td><td className="num">{fNum(n)}</td></tr>)}
                <tr><td>Postgres</td><td className="num">{sb.versao}</td></tr>
              </tbody></table>
              <p className="nota-bloco">O plano grátis pausa o projeto depois de 7 dias sem nenhum uso, e a Supabase guarda as cópias de segurança só no plano pago.</p>
            </div>
            <div className="bloco">
              <h3>Tabelas</h3>
              <table><thead><tr><th>Tabela</th><th className="num">Linhas</th><th className="num">Tamanho</th></tr></thead><tbody>
                {sb.tabelas.map(t => <tr key={t.tabela}><td className="mono">{t.tabela}</td><td className="num">{fNum(t.linhas)}</td><td className="num">{fBytes(t.bytes)}</td></tr>)}
              </tbody></table>
              <p className="nota-bloco">Linhas aproximadas (o Postgres conta de tempos em tempos).</p>
            </div>
          </div>
        </>
      )}

      <div className="bloco-topo titulo-secao">
        <h3>Cloudflare <small>(servidor de avisos, site, KV e IA · por dia, em UTC)</small></h3>
        {cf && cf.configurado && <span>{cf.gerado && <small>{relativo(cf.gerado)} · </small>}<button className="link" onClick={() => carregarCf(true)} disabled={busy}>{busy ? "atualizando…" : "atualizar"}</button></span>}
      </div>
      {!cf ? <p className="vazio">Carregando…</p> : cf.erro ? <p className="erro">{cf.erro}</p> : !cf.configurado ? <ComoLigar /> : <Cloudflare cf={cf} />}
    </section>
  );
}

function ComoLigar() {
  return (
    <div className="bloco como-ligar">
      <p>Para ver aqui os pedidos do servidor, o uso do KV e da IA e as visitas do site, o servidor precisa de um token da Cloudflare <b>só de leitura</b> (é de graça):</p>
      <ol>
        <li>Abra <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer">dash.cloudflare.com/profile/api-tokens</a> → <b>Create Token</b> → <b>Create Custom Token</b>.</li>
        <li>Nome: <code>Avina painel</code>. Em <b>Permissions</b>, adicione três linhas:
          <ul><li>Account → <b>Account Analytics</b> → Read</li><li>Zone → <b>Analytics</b> → Read</li><li>Zone → <b>Zone</b> → Read</li></ul></li>
        <li>Em <b>Zone Resources</b>: Include → Specific zone → <code>avina.com.br</code>. Continue → <b>Create Token</b> e copie o token.</li>
        <li>No computador, cole o token sozinho no arquivo <code>servidor-avisos\cloudflare-token.txt</code> e rode no PowerShell, na pasta do projeto:
          <pre>{`& "C:\\Program Files\\Git\\bin\\bash.exe" ligar-cloudflare-painel.sh`}</pre></li>
      </ol>
      <p className="nota">O token só lê números. O script guarda como segredo no servidor e apaga o arquivo.</p>
    </div>
  );
}

function Cloudflare({ cf }) {
  const hoje = cf.dias[cf.dias.length - 1];
  const w = cf.workers || [], kv = cf.kv, ia = cf.ia, zona = cf.zona;
  const totalDia = d => Object.values(d.scripts || {}).reduce((s, x) => s + (x.requests || 0), 0);
  const wHoje = w.find(d => d.dia === hoje) || { scripts: {} };
  const kvHoje = kv && kv.dias.find(d => d.dia === hoje);
  const iaHoje = ia && ia.find(d => d.dia === hoje);
  const scripts = [...new Set(w.flatMap(d => Object.keys(d.scripts || {})))];
  const nomeScript = s => s === "agenda-avisos" ? "Servidor de avisos" : s === "avina-site" ? "Site (avina.com.br)" : s;
  return (
    <>
      {Object.keys(cf.erros || {}).length > 0 && <div className="aviso">{Object.entries(cf.erros).map(([k, v]) => <div key={k}><b>{{ workers: "Pedidos", kv: "KV", ia: "IA", zona: "Site" }[k] || k}:</b> {v}</div>)}</div>}
      <div className="medidores">
        {cf.workers && <Medidor rotulo="Pedidos aos Workers hoje" usado={totalDia(wHoje)} limite={LIMITE.pedidos} nota="soma do servidor e do site" />}
        {kvHoje && <Medidor rotulo="KV: leituras hoje" usado={kvHoje.read} limite={LIMITE.kvLeitura} />}
        {kvHoje && <Medidor rotulo="KV: gravações hoje" usado={kvHoje.write} limite={LIMITE.kvEscrita} nota="o limite mais apertado" />}
        {kvHoje && <Medidor rotulo="KV: listagens hoje" usado={kvHoje.list} limite={LIMITE.kvLista} nota="o painel usa algumas" />}
        {kvHoje && <Medidor rotulo="KV: exclusões hoje" usado={kvHoje.delete} limite={LIMITE.kvApaga} />}
        {kv && kv.bytes != null && <Medidor rotulo="KV: espaço guardado" usado={kv.bytes} limite={LIMITE.kvTamanho} formato={fBytes} nota={`${fNum(kv.chaves)} chaves`} />}
        {iaHoje && <Medidor rotulo="IA: neurônios hoje" usado={Math.round(iaHoje.neuronios)} limite={LIMITE.neuronios} nota={`${fNum(iaHoje.pedidos)} pedidos · ao acabar, a IA para até amanhã (não cobra)`} />}
      </div>
      <div className="graficos">
        {cf.workers && <Barras titulo="Pedidos aos Workers" dados={w.map(d => ({ dia: d.dia, n: totalDia(d) }))} unidade={["pedido", "pedidos"]} />}
        {zona && <Barras titulo={`Visitantes de ${zona.nome}`} dados={zona.dias.map(d => ({ dia: d.dia, n: d.visitantes }))} unidade={["visitante", "visitantes"]} />}
        {ia && <Barras titulo="Neurônios de IA" dados={ia.map(d => ({ dia: d.dia, n: Math.round(d.neuronios) }))} unidade={["neurônio", "neurônios"]} />}
        {kv && <Barras titulo="Gravações no KV" dados={kv.dias.map(d => ({ dia: d.dia, n: d.write }))} unidade={["gravação", "gravações"]} />}
      </div>
      <div className="blocos">
        {cf.workers && <div className="bloco">
          <h3>Workers hoje</h3>
          <table><thead><tr><th>Worker</th><th className="num">Pedidos</th><th className="num">Erros</th><th className="num">Chamadas para fora</th></tr></thead><tbody>
            {scripts.map(s => { const x = wHoje.scripts[s] || {}; return <tr key={s}><td>{nomeScript(s)}</td><td className="num">{fNum(x.requests || 0)}</td><td className="num">{fNum(x.errors || 0)}</td><td className="num">{fNum(x.subrequests || 0)}</td></tr>; })}
          </tbody></table>
        </div>}
        {zona && <div className="bloco">
          <h3>Site nos últimos 7 dias</h3>
          <table><tbody>
            <tr><td>Visitantes (soma dos dias)</td><td className="num">{fNum(zona.dias.reduce((s, d) => s + d.visitantes, 0))}</td></tr>
            <tr><td>Páginas vistas</td><td className="num">{fNum(zona.dias.reduce((s, d) => s + d.pageViews, 0))}</td></tr>
            <tr><td>Pedidos</td><td className="num">{fNum(zona.dias.reduce((s, d) => s + d.requests, 0))}</td></tr>
            <tr><td>Servidos pelo cache</td><td className="num">{fNum(zona.dias.reduce((s, d) => s + d.cachedRequests, 0))}</td></tr>
            <tr><td>Dados enviados</td><td className="num">{fBytes(zona.dias.reduce((s, d) => s + d.bytes, 0))}</td></tr>
            <tr><td>Ameaças bloqueadas</td><td className="num">{fNum(zona.dias.reduce((s, d) => s + d.threats, 0))}</td></tr>
          </tbody></table>
          <p className="nota-bloco">Conta o que passa pela Cloudflare no domínio. O app (app.avina.com.br) é servido pelo GitHub Pages.</p>
        </div>}
      </div>
    </>
  );
}

export function Registro({ fontes, usuarios, abrir }) {
  const [log, setLog] = useState(null);
  useEffect(() => { fontes.log().then(setLog, e => setLog({ erro: e.message })); }, []);
  const porId = Object.fromEntries(usuarios.map(u => [u.id, u]));
  const detalhe = d => !d ? "" : Object.entries(d).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
  if (!log) return <p className="vazio">Carregando…</p>;
  if (log.erro) return <p className="erro">{log.erro}</p>;
  return (
    <section>
      <p className="contador">Tudo o que foi feito pelo painel, do mais novo para o mais antigo.</p>
      {!log.length ? <p className="vazio">Nada ainda.</p> : (
        <div className="tabela-rola"><table>
          <thead><tr><th>Quando</th><th>Quem fez</th><th>O quê</th><th>Conta</th><th>Detalhes</th></tr></thead>
          <tbody>{log.map((l, i) => (
            <tr key={i}>
              <td>{fDataHora(l.quando)}</td><td>{l.admin_email}</td><td><b>{l.acao}</b></td>
              <td>{l.alvo ? porId[l.alvo] ? <button className="link" onClick={() => abrir(porId[l.alvo])}>{l.alvo_email}</button> : <span className="fraco">{l.alvo_email || "(excluída)"}</span> : "—"}</td>
              <td><small>{detalhe(l.detalhe)}</small></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
