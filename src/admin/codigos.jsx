// Painel do dono: códigos de acesso (quem digita no app ganha o Pro por alguns dias) e quem usou cada um
import React, { useEffect, useMemo, useState } from "react";
import { Confirmar, Copiar, addDias, fData, fNum, hojeBR } from "./util.jsx";

export default function Codigos({ fontes, usuarios, abrir, avisar }) {
  const [lista, setLista] = useState(null), [erro, setErro] = useState(""), [novos, setNovos] = useState(null), [apagar, setApagar] = useState(null);
  const [modo, setModo] = useState("unicos"), [f, setF] = useState({ codigo: "", dias: 30, max: 20, gerar: 10, validoAte: "" }), [busy, setBusy] = useState(false);
  const carregar = () => fontes.codigos().then(r => setLista(r.codigos), e => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const porId = useMemo(() => Object.fromEntries(usuarios.map(u => [u.id, u])), [usuarios]);
  const hoje = hojeBR();
  const situacao = c => c.apagado ? ["apagado", "fraco"] : c.validoAte && hoje > c.validoAte ? ["venceu", "fraco"] : (c.usados || 0) >= (c.max || 0) ? ["esgotado", "fraco"] : ["valendo", "ok"];
  const ordenados = (lista || []).slice().sort((a, b) => (b.usos.length - a.usos.length) || a.codigo.localeCompare(b.codigo));
  const valendo = ordenados.filter(c => situacao(c)[0] === "valendo");
  const criar = async e => {
    e.preventDefault(); setBusy(true); setErro("");
    try {
      const r = await fontes.criarCodigo(modo === "unicos" ? { gerar: f.gerar, dias: f.dias, validoAte: f.validoAte || null } : { codigo: f.codigo, dias: f.dias, max: f.max, validoAte: f.validoAte || null });
      setNovos(r.codigos); avisar(r.codigos.length === 1 ? `Código ${r.codigos[0]} pronto.` : `${r.codigos.length} códigos prontos.`); carregar();
    } catch (e) { setErro(e.message); }
    setBusy(false);
  };
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <section>
      <div className="blocos">
        <div className="bloco">
          <h3>Criar códigos</h3>
          <div className="abas mini">
            <button className={modo === "unicos" ? "sim" : ""} onClick={() => setModo("unicos")}>De uso único</button>
            <button className={modo === "nome" ? "sim" : ""} onClick={() => setModo("nome")}>Um código para várias pessoas</button>
          </div>
          <form className="form" onSubmit={criar}>
            {modo === "unicos"
              ? <label>Quantos códigos<input type="number" min={1} max={50} value={f.gerar} onChange={muda("gerar")} /></label>
              : <>
                <label>Código<input value={f.codigo} maxLength={20} placeholder="Ex.: BETA30" onChange={e => setF({ ...f, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} /></label>
                <label>Quantas pessoas podem usar<input type="number" min={1} value={f.max} onChange={muda("max")} /></label>
              </>}
            <label>Dias de Pro que libera<input type="number" min={1} max={365} value={f.dias} onChange={muda("dias")} /></label>
            <label>Pode ser usado até (opcional)<input type="date" min={hoje} value={f.validoAte} onChange={muda("validoAte")} /></label>
            {erro && <p className="erro">{erro}</p>}
            <button className="botao" disabled={busy}>{busy ? "Criando…" : modo === "unicos" ? `Gerar ${f.gerar || ""} códigos` : "Criar código"}</button>
            <p className="nota">{modo === "unicos" ? "Cada código vale para uma pessoa só: se alguém repassar, não serve para mais ninguém." : "Criar de novo um código que já existe muda os dias e o limite, e mantém quem já usou."}</p>
          </form>
          {novos && (
            <div className="novos">
              <div className="bloco-topo"><b>Prontos para mandar</b><Copiar texto={novos.join("\n")} rotulo="copiar todos" /></div>
              <pre>{novos.join("\n")}</pre>
              <p className="nota">A pessoa entra no app e vai em Perfil → Assinatura → Tenho um código de acesso.</p>
            </div>
          )}
        </div>
        <div className="bloco">
          <h3>Resumo</h3>
          <table><tbody>
            <tr><td>Códigos valendo</td><td className="num">{fNum(valendo.length)}</td></tr>
            <tr><td>Ainda dá para usar</td><td className="num">{fNum(valendo.reduce((s, c) => s + Math.max(0, (c.max || 0) - (c.usados || 0)), 0))} usos</td></tr>
            <tr><td>Pessoas que já usaram código</td><td className="num">{fNum(new Set(ordenados.flatMap(c => c.usos.map(x => x.uid))).size)}</td></tr>
            <tr><td>Usados nos últimos 7 dias</td><td className="num">{fNum(ordenados.flatMap(c => c.usos).filter(x => x.dia && x.dia >= addDias(hoje, -7)).length)}</td></tr>
          </tbody></table>
        </div>
      </div>

      <h3 className="titulo-secao">Todos os códigos</h3>
      {lista == null ? <p className="vazio">Carregando…</p> : !ordenados.length ? <p className="vazio">Nenhum código ainda.</p> : (
        <div className="tabela-rola">
          <table>
            <thead><tr><th>Código</th><th>Situação</th><th className="num">Dias</th><th className="num">Usos</th><th>Pode usar até</th><th>Quem usou</th><th></th></tr></thead>
            <tbody>{ordenados.map(c => {
              const [s, cls] = situacao(c);
              return (
                <tr key={c.codigo}>
                  <td><b className="mono">{c.codigo}</b> <Copiar texto={c.codigo} /></td>
                  <td><span className={"selo " + cls}>{s}</span></td>
                  <td className="num">{c.dias ? fNum(c.dias) : "—"}</td>
                  <td className="num">{fNum(c.usados || c.usos.length)}{c.max ? ` de ${fNum(c.max)}` : ""}</td>
                  <td>{c.validoAte ? fData(c.validoAte) : "sem prazo"}</td>
                  <td>{c.usos.length ? c.usos.map(x => porId[x.uid]
                    ? <button key={x.uid} className="link pessoa" onClick={() => abrir(porId[x.uid])} title={`usou em ${fData(x.dia)}`}>{porId[x.uid].nome || porId[x.uid].email}</button>
                    : <span key={x.uid} className="fraco pessoa">(conta excluída)</span>) : <span className="fraco">ninguém ainda</span>}</td>
                  <td>{!c.apagado && <button className="link" onClick={() => setApagar(c)}>apagar</button>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {apagar && <Confirmar titulo={`Apagar o código ${apagar.codigo}`} botao="Apagar" perigo
        texto={<p>Ninguém mais consegue usar. Quem já usou continua com os dias que ganhou.</p>}
        onNao={() => setApagar(null)}
        onSim={async () => { await fontes.apagarCodigo(apagar.codigo); setApagar(null); avisar(`Código ${apagar.codigo} apagado.`); carregar(); }} />}
    </section>
  );
}
