// Painel "No banco agora": saldos das contas, cartões (fatura e limite) e investimentos, pelo Open Finance (src/banco.js).
// Só aparece para quem tem a opção liberada e algum banco conectado.
import React, { useEffect, useState } from "react";
import { I, brl, dm, todayISO, diffDias, uid, MarcaLogo, relativo } from "../App.jsx";
import { acharMarca } from "../marcas.js";
import { resumoBanco, resumoGuardado } from "../banco.js";

// "MeuPluggy" é o nome da ponte, não do banco: nesse caso vale o nome da conta
const nomeBanco = b => (/meu\s*pluggy/i.test(b || "") ? "" : b || "");
const marcaDe = (...nomes) => { for (const n of nomes) { const m = n && acharMarca(n); if (m) return m.id; } return null; };
const hojeLocal = iso => new Date(new Date(iso) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

export function BancosPainel({ caixinhas, act }) {
  const [r, setR] = useState(() => { const g = resumoGuardado(); return g && g.dados && g.dados.ligado ? g.dados : null; });
  const [carregando, setCarregando] = useState(false);
  const carregar = async forcar => { setCarregando(true); const d = await resumoBanco(forcar); setR(d); setCarregando(false); };
  useEffect(() => { carregar(false); }, []);

  // caixinhas ligadas a um investimento: o valor do banco substitui a estimativa
  useEffect(() => {
    if (!r || !r.investimentos || r.erro) return;
    const mud = {};
    (caixinhas || []).forEach(cx => {
      const inv = cx.banco && r.investimentos.find(i => i.id === cx.banco.inv);
      if (inv && (inv.saldo !== cx.banco.valor || inv.aplicado !== cx.banco.aplicado)) mud[cx.id] = { ...cx.banco, valor: inv.saldo, aplicado: inv.aplicado, em: r.em };
    });
    if (Object.keys(mud).length) act.bancoNasCaixinhas(mud);
  }, [r]);

  if (!r || !r.ligado || !(r.bancos || []).length) return null;
  const contas = r.contas.filter(c => c.tipo === "conta"), cartoes = r.contas.filter(c => c.tipo === "cartao"), inv = r.investimentos || [];
  const emConta = contas.reduce((s, c) => s + c.saldo, 0), investido = inv.reduce((s, i) => s + i.saldo, 0);
  const hoje = todayISO();
  const ligada = id => (caixinhas || []).find(cx => cx.banco && cx.banco.inv === id);
  const virarCaixinha = (i, alvo) => {
    const banco = { inv: i.id, nome: i.nome, valor: i.saldo, aplicado: i.aplicado, em: r.em };
    if (alvo === "nova") act.salvarCaixinha({ id: uid(), nome: i.nome.slice(0, 40), emoji: "🏦", movs: [], banco });
    else { const cx = caixinhas.find(x => x.id === alvo); if (cx) act.salvarCaixinha({ ...cx, banco }); }
  };
  const pede = (r.bancos || []).filter(b => b.status === "LOGIN_ERROR" || b.status === "OUTDATED");

  return (
    <div className="panel bancos">
      <div className="panel-head">
        <h3>No banco agora</h3>
        <button className="link" onClick={() => carregar(true)} disabled={carregando}>{carregando ? "Atualizando…" : `Atualizado ${relativo(hojeLocal(r.em)).toLowerCase()}`}</button>
      </div>
      <div className="bk-totais">
        <div><span>Em conta</span><b className={emConta < 0 ? "neg" : ""}>{brl(emConta)}</b></div>
        {inv.length > 0 && <div><span>Investido</span><b>{brl(investido)}</b></div>}
      </div>
      {pede.length > 0 && <button className="note bk-aviso" onClick={act.importarDoBanco}><I.alert /><span>{pede.map(b => b.nome).join(", ")} pediu para autorizar de novo. Toque para abrir.</span></button>}
      {r.erro && <div className="note"><I.alert /><span>Não consegui atualizar agora ({r.erro}). Mostrando os últimos valores.</span></div>}

      {contas.map(c => (
        <div key={c.id} className="bk-row">
          <MarcaLogo marca={marcaDe(c.banco, c.nome)} nome={nomeBanco(c.banco) || c.nome} className="txn-av" />
          <span className="bk-mid">
            <span className="bk-nm">{nomeBanco(c.banco) || c.nome}{c.final ? ` ·${c.final}` : ""}</span>
            <span className="bk-sb">{nomeBanco(c.banco) ? c.nome : "Conta"}{c.especialUsado > 0 ? ` · usando ${brl(c.especialUsado)} do cheque especial` : c.especial > 0 ? ` · cheque especial de ${brl(c.especial)}` : ""}</span>
          </span>
          <b className={"bk-v" + (c.saldo < 0 ? " neg" : "")}>{brl(c.saldo)}</b>
        </div>
      ))}

      {cartoes.map(c => {
        const d = c.vence ? diffDias(hoje, c.vence) : null;
        const usado = c.limite > 0 && c.livre != null ? Math.min(100, Math.max(0, (1 - c.livre / c.limite) * 100)) : null;
        return (
          <div key={c.id} className="bk-row">
            <MarcaLogo marca={marcaDe(c.banco, c.nome)} nome={nomeBanco(c.banco) || c.nome} className="txn-av" />
            <span className="bk-mid">
              <span className="bk-nm">Cartão {nomeBanco(c.banco) || c.nome}{c.final ? ` ·${c.final}` : ""}</span>
              <span className={"bk-sb" + (d != null && d >= 0 && d <= 5 && c.saldo > 0 ? " bk-perto" : "")}>
                Fatura{c.vence ? ` vence ${d === 0 ? "hoje" : d === 1 ? "amanhã" : d > 1 && d <= 7 ? `em ${d} dias` : dm(c.vence)}` : ""}{c.livre != null ? ` · livre ${brl(c.livre)}` : ""}
              </span>
              {usado != null && <span className="cx-bar bk-limite"><i style={{ width: `${usado}%` }} /></span>}
            </span>
            <b className="bk-v">{brl(c.saldo)}</b>
          </div>
        );
      })}

      {inv.map(i => {
        const cx = ligada(i.id), livres = (caixinhas || []).filter(x => !x.banco);
        return (
          <div key={i.id} className="bk-row">
            <span className="cx-emoji" aria-hidden="true">{cx ? cx.emoji || "🛟" : "📈"}</span>
            <span className="bk-mid">
              <span className="bk-nm">{i.nome}</span>
              <span className="bk-sb">
                {nomeBanco(i.banco) || "Investimento"}{i.rendeu ? ` · ${i.rendeu > 0 ? "rendeu" : "variou"} ${i.rendeu > 0 ? "+" : ""}${brl(i.rendeu)}` : ""}
                {cx ? <> · na caixinha <b>{cx.nome}</b></> : null}
              </span>
              {!cx && (
                <select className="bk-ligar" value="" onChange={e => e.target.value && virarCaixinha(i, e.target.value)} aria-label="Usar numa caixinha">
                  <option value="">Usar numa caixinha…</option>
                  <option value="nova">Criar uma caixinha com ele</option>
                  {livres.map(x => <option key={x.id} value={x.id}>Ligar à {x.nome}</option>)}
                </select>
              )}
            </span>
            <b className="bk-v">{brl(i.saldo)}</b>
          </div>
        );
      })}

      <button className="btn ghost bk-trazer" onClick={act.importarDoBanco}><I.down /> Trazer lançamentos novos</button>
      <p className="din-rodape">Pelo Open Finance. O banco manda os dados uma vez por dia, mais ou menos. Desligar: Importar → Direto do banco.</p>
    </div>
  );
}
