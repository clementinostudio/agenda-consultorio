// Painel do dono: acessos de todo mundo (IP, operadora, cidade, aparelho) e IPs usados por mais de uma conta
import React, { useEffect, useMemo, useState } from "react";
import { aparelho, baixarCsv, fDataHora, fNum, fRede, ondeDe, relativo } from "./util.jsx";

export default function Acessos({ fontes, usuarios, abrir }) {
  const [dados, setDados] = useState(null), [busca, setBusca] = useState(""), [dias, setDias] = useState(30);
  useEffect(() => {
    setDados(null);
    Promise.all([fontes.recentes(), fontes.ips(dias)]).then(([recentes, ips]) => setDados({ recentes, ips }), e => setDados({ erro: e.message }));
  }, [dias]);
  const porId = useMemo(() => Object.fromEntries(usuarios.map(u => [u.id, u])), [usuarios]);
  const abrirId = id => porId[id] && abrir(porId[id]);
  const lista = useMemo(() => {
    if (!dados || dados.erro) return [];
    const q = busca.trim().toLowerCase();
    return dados.recentes.filter(x => !q || [x.ip, x.email, x.nome, x.cidade, x.regiao, x.rede, aparelho(x.aparelho)].some(v => String(v || "").toLowerCase().includes(q)));
  }, [dados, busca]);
  if (!dados) return <p className="vazio">Carregando…</p>;
  if (dados.erro) return <p className="erro">{dados.erro}</p>;
  const csv = () => baixarCsv("avina-acessos", ["quando", "ate", "email", "ip", "operadora", "cidade", "uf", "pais", "aparelho"],
    lista.map(x => [x.quando, x.ultimo, x.email || "(conta excluída)", x.ip, x.rede, x.cidade, x.regiao, x.pais, x.aparelho]));
  return (
    <section>
      <div className="bloco">
        <div className="bloco-topo">
          <h3>IPs usados por mais de uma conta</h3>
          <select value={dias} onChange={e => setDias(Number(e.target.value))} aria-label="Período">
            <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={190}>6 meses</option>
          </select>
        </div>
        <p className="nota-bloco">Pode ser a mesma casa, o mesmo Wi-Fi do trabalho ou a mesma operadora de celular (que divide um IP entre muita gente). Também pode ser alguém criando várias contas para usar código.</p>
        {dados.ips.length ? (
          <div className="tabela-rola"><table>
            <thead><tr><th>IP</th><th>Operadora</th><th>Cidade</th><th className="num">Contas</th><th>Quem</th><th>Última vez</th></tr></thead>
            <tbody>{dados.ips.map(x => (
              <tr key={x.ip}>
                <td className="mono"><button className="link" onClick={() => setBusca(x.ip)}>{x.ip}</button></td>
                <td>{fRede(x.rede) || "—"}</td>
                <td>{x.cidade || "—"}</td>
                <td className="num">{fNum(x.n)}</td>
                <td>{x.contas.map(c => c.email ? <button key={c.id} className="link pessoa" onClick={() => abrirId(c.id)}>{c.email}</button> : <span key={c.id} className="fraco pessoa">(conta excluída)</span>)}</td>
                <td>{relativo(x.ultimo)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="vazio">Nenhum IP repetido no período.</p>}
      </div>

      <div className="filtros" style={{ marginTop: 14 }}>
        <input type="search" placeholder="Buscar por IP, e-mail, cidade, operadora ou aparelho" value={busca} onChange={e => setBusca(e.target.value)} />
        <button className="botao leve" onClick={csv}>Baixar planilha</button>
      </div>
      <p className="contador">{fNum(lista.length)} acessos (os mais recentes primeiro{dados.recentes.length >= 400 ? ", até 400" : ""})</p>
      <div className="tabela-rola">
        <table className="tabela-acessos">
          <thead><tr><th>Quando</th><th>Conta</th><th>IP</th><th>Operadora</th><th>Onde</th><th>Aparelho</th></tr></thead>
          <tbody>{lista.map((x, i) => (
            <tr key={i} onClick={() => abrirId(x.user_id)} className={porId[x.user_id] ? "clica" : ""}>
              <td>{fDataHora(x.quando)}{x.ultimo !== x.quando && <small>até {fDataHora(x.ultimo).slice(-5)}</small>}</td>
              <td>{x.email ? <><b>{x.nome || "(sem nome)"}</b><small>{x.email}</small></> : <span className="fraco">(conta excluída)</span>}</td>
              <td className="mono">{x.ip || "—"}</td>
              <td>{fRede(x.rede) || "—"}</td>
              <td>{ondeDe(x)}</td>
              <td title={x.aparelho || ""}>{aparelho(x.aparelho)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
