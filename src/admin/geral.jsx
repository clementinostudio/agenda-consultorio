// Painel do dono: visão geral (números, gráficos, funil, planos, uso)
import React from "react";
import { Barras, Numero, NOME_MODO, TEM_PRO, fNum, fPct, fReais, fData, relativo, nomeLista, planoDe, ultimoUsoIso } from "./util.jsx";

export default function Geral({ resumo: r, usuarios, kv, funil, abrir, irPara }) {
  const planos = usuarios.map(u => ({ u, p: planoDe(u, kv) }));
  const conta = t => planos.filter(x => x.p.tipo === t && !x.p.teste).length;
  const comPro = planos.filter(x => TEM_PRO.includes(x.p.tipo) && !x.p.teste).length;
  const mrr = planos.reduce((s, x) => s + (x.p.tipo === "pago" ? x.p.mensal || 0 : 0), 0);
  const semKv = !!kv.erro;
  // cadastros acumulados: o total de hoje menos o que entrou depois de cada dia
  let acum = r.contas.total;
  const total = r.cadastros_dia.slice().reverse().map(d => { const n = acum; acum -= d.n; return { dia: d.dia, n }; }).reverse();
  const novas = usuarios.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 8);
  return (
    <>
      <section className="numeros">
        <Numero rotulo="Contas" valor={fNum(r.contas.total)} sub={`+${fNum(r.contas.hoje)} hoje · +${fNum(r.contas.d7)} em 7 dias · +${fNum(r.contas.d30)} em 30`} onClick={() => irPara("contas", "todas")} />
        <Numero rotulo="Usaram hoje" valor={fNum(r.ativos.d1)} sub={`${fNum(r.ativos.d7)} em 7 dias · ${fNum(r.ativos.d30)} em 30`} onClick={() => irPara("contas", "ativas")} />
        <Numero rotulo="Com o Pro liberado" valor={semKv ? "?" : fNum(comPro)}
          sub={semKv ? "o servidor de avisos não respondeu" : `${fNum(conta("pago"))} pagando · ${fNum(conta("codigo"))} por código · ${fNum(conta("cortesia") + conta("antiga"))} em cortesia`} onClick={() => irPara("contas", "pro")} />
        <Numero rotulo="Receita por mês" valor={semKv ? "?" : fReais(mrr)} sub={semKv ? "—" : `${fNum(conta("pago"))} assinaturas · anuais ÷ 12`} onClick={() => irPara("contas", "pago")} />
      </section>

      <section className="graficos">
        <Barras titulo="Cadastros por dia" dados={r.cadastros_dia} unidade={["cadastro", "cadastros"]} />
        <Barras titulo="Contas que usaram o app, por dia" dados={r.ativos_dia} unidade={["conta", "contas"]} />
        <Barras titulo="Total de contas" dados={total} unidade={["conta", "contas"]} total={false} />
      </section>

      <section className="blocos">
        {funil && (
          <div className="bloco">
            <h3>Funil</h3>
            <div className="funil">
              {[["Criaram a conta", funil.contas, funil.contas], ["Terminaram o cadastro", funil.perfil, funil.contas],
                ["Voltaram outro dia", funil.voltaram, funil.podiam_voltar], ["Usaram nos últimos 7 dias", funil.ativos7, funil.contas],
                ...(semKv ? [] : [["Com o Pro liberado", comPro, funil.contas], ["Pagando", conta("pago"), funil.contas]])].map(([t, n, de]) => (
                <div key={t} className="funil-linha">
                  <span>{t}</span>
                  <div className="funil-barra"><div style={{ width: `${de ? Math.max(1.5, (100 * n) / de) : 0}%` }} /></div>
                  <b>{fNum(n)}</b><small>{fPct(n, de)}</small>
                </div>
              ))}
            </div>
            <p className="nota-bloco">"Voltaram outro dia" conta só quem tem mais de 1 dia de conta.</p>
          </div>
        )}
        <div className="bloco">
          <h3>Planos</h3>
          {semKv ? <p className="vazio">Sem resposta do servidor de avisos.</p> : (
            <table><tbody>
              {[["pago", "Pagando (Asaas)"], ["codigo", "Pro por código"], ["cortesia", "Cortesia dada no painel"], ["antiga", "Cortesia de conta antiga"],
                ["aguardando", "Aguardando o 1º pagamento"], ["cancelada", "Cancelaram (ainda com Pro)"], ["gratis", "Grátis"]].map(([t, n]) => (
                <tr key={t} className="clica" onClick={() => irPara("contas", t)}><td>{n}</td><td className="num">{fNum(conta(t))}</td></tr>
              ))}
              {planos.some(x => x.p.teste) && <tr><td>Assinaturas de teste (sandbox)</td><td className="num">{fNum(planos.filter(x => x.p.teste).length)}</td></tr>}
            </tbody></table>
          )}
        </div>
        <div className="bloco">
          <h3>Últimos cadastros</h3>
          <table><tbody>
            {novas.map(u => (
              <tr key={u.id} className="clica" onClick={() => abrir(u)}>
                <td><b>{u.nome || "(sem nome)"}</b><small className="bloco-sub">{u.email}</small></td>
                <td className="num"><small>{fData(u.criado_em)}</small><small className="bloco-sub">usou {relativo(ultimoUsoIso(u))}</small></td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div className="bloco">
          <h3>Como usam</h3>
          <table><tbody>
            {Object.entries(NOME_MODO).map(([k, n]) => <tr key={k}><td>{n}</td><td className="num">{fNum(r.modos[k])}</td></tr>)}
            <tr className="clica" onClick={() => irPara("contas", "incompletas")}><td>Não terminaram o cadastro</td><td className="num">{fNum(r.contas.sem_perfil)}</td></tr>
            <tr><td>Casas (dinheiro a dois)</td><td className="num">{fNum(r.casas.casas)} <small>· {fNum(r.casas.pessoas)} pessoas</small></td></tr>
            <tr><td>Lojas</td><td className="num">{fNum(r.lojas.lojas)} <small>· {fNum(r.lojas.ajudantes)} ajudantes</small></td></tr>
            {!semKv && <tr><td>Links de agendamento no ar</td><td className="num">{fNum(Object.values(kv.contas).filter(a => a.link).length)}</td></tr>}
          </tbody></table>
        </div>
        <div className="bloco">
          <h3>O que guardam <small>(só quantidades)</small></h3>
          <table><thead><tr><th>Lista</th><th className="num">Itens</th><th className="num">Contas</th></tr></thead><tbody>
            {r.colecoes.map(c => <tr key={c.colecao}><td>{nomeLista(c.colecao)}</td><td className="num">{fNum(c.itens)}</td><td className="num">{fNum(c.contas)}</td></tr>)}
            {r.lojas.itens > 0 && <tr><td>Itens das lojas</td><td className="num">{fNum(r.lojas.itens)}</td><td className="num">{fNum(r.lojas.lojas)}</td></tr>}
          </tbody></table>
        </div>
        <div className="bloco">
          <h3>De onde acessam <small>(30 dias)</small></h3>
          {r.acessos.cidades.length ? (
            <table><thead><tr><th>Cidade</th><th className="num">Contas</th></tr></thead><tbody>
              {r.acessos.cidades.map(c => <tr key={c.cidade + c.regiao}><td>{c.cidade}{c.regiao ? <small> · {c.regiao}</small> : null}</td><td className="num">{fNum(c.contas)}</td></tr>)}
            </tbody></table>
          ) : <p className="vazio">Ainda sem registros. Aparecem quando as pessoas abrirem a versão nova do app.</p>}
        </div>
        <div className="bloco">
          <h3>Hoje no servidor</h3>
          <table><tbody>
            <tr className="clica" onClick={() => irPara("acessos")}><td>Acessos nas últimas 24 h</td><td className="num">{fNum(r.acessos.d1)}</td></tr>
            <tr><td>Registros de acesso guardados</td><td className="num">{fNum(r.acessos.registros)}</td></tr>
            {!semKv && <>
              <tr><td>Aparelhos recebendo avisos</td><td className="num">{fNum(kv.aparelhosComAviso)}</td></tr>
              <tr><td>IA hoje: voz</td><td className="num">{fNum(kv.ia.voz.usos)} <small>· {fNum(kv.ia.voz.pessoas)} pessoas</small></td></tr>
              <tr><td>IA hoje: Bolinha e fotos</td><td className="num">{fNum(kv.ia.ia.usos)} <small>· {fNum(kv.ia.ia.pessoas)} pessoas</small></td></tr>
              <tr><td>Cobrança</td><td className="num">{kv.asaasLigado ? `ligada desde ${fData(kv.cobrancaInicio)}` : "desligada"}</td></tr>
            </>}
          </tbody></table>
        </div>
      </section>
    </>
  );
}
