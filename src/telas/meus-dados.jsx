// "Baixar meus dados": um .zip com tudo o que a pessoa tem no app (planilhas, o JSON completo e, se ela quiser e
// o cofre estiver aberto, os prontuários legíveis). Montado aqui no aparelho; nada é enviado para lugar nenhum.
import React, { useState, useEffect } from "react";
import { I, Sheet, Field, Toggle, TERMO, catDe, vibrar } from "../App.jsx";
import { aberto, destrancar } from "../cofre.js";
import { montarPacote, notasLegiveis } from "../exportar.js";

/* ---------- arquivo: compartilhar no celular ou baixar (como os PDFs em telas/consultorio.jsx) ---------- */
function baixar(blob, nome) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const ehCelular = () => { try { return matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } };
async function entregar(blob, nome) {
  // no celular, a folha de compartilhar deixa salvar em Arquivos, no Drive ou mandar por e-mail;
  // onde o navegador não aceita compartilhar .zip (ou no computador), vai para os downloads
  if (ehCelular()) {
    const f = new File([blob], nome, { type: "application/zip" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: nome }); return "ok"; } catch (e) { if (e.name === "AbortError") return "cancelou"; }
    }
  }
  baixar(blob, nome); return "baixou";
}
const qtd = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export function MeusDadosSheet({ db, conta, onClose, act }) {
  const [, setVer] = useState(0);
  useEffect(() => { const f = () => setVer(v => v + 1); addEventListener("cofre", f); return () => removeEventListener("cofre", f); }, []);
  const temNotas = (db.notas || []).length > 0;
  const [incluir, setIncluir] = useState(() => temNotas && aberto());
  const [senha, setSenha] = useState(""), [erro, setErro] = useState(""), [abrindo, setAbrindo] = useState(false);
  const [gerando, setGerando] = useState(false), [pronto, setPronto] = useState(null);
  const cofreAberto = aberto();

  const P = db.pessoal || {};
  const n = { pac: (db.patients || []).length, ses: (db.sessions || []).length, lanc: (P.lanc || []).length, contas: (P.contas || []).length };
  const partes = [n.pac && qtd(n.pac, TERMO.s, TERMO.p), n.ses && qtd(n.ses, "sessão", "sessões"), n.lanc && qtd(n.lanc, "lançamento", "lançamentos"), n.contas && qtd(n.contas, "conta fixa", "contas fixas")].filter(Boolean);

  const abrirCofre = async e => {
    e.preventDefault(); if (!senha || !db.cofre) return;
    setAbrindo(true); const ok = await destrancar(db.cofre, senha); setAbrindo(false);
    if (!ok) { setErro("Senha errada."); vibrar("erro"); return; }
    setSenha(""); setErro(""); vibrar("ok");
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const notasAbertas = incluir && aberto() ? await notasLegiveis(db) : null;
      const r = await montarPacote({ db, conta, notasAbertas, nomeCat: id => catDe(id).nome });
      const como = await entregar(r.blob, r.nome);
      if (como !== "cancelou") { setPronto({ ...r, como }); vibrar("ok"); }
    } catch (e) { act.toast("Não consegui montar o arquivo. Tente de novo."); }
    setGerando(false);
  };

  if (pronto) return (
    <Sheet title="Seus dados estão prontos" sub={pronto.nome} onClose={onClose}>
      <div className="stack">
        <div className="note"><I.check /><span><b>{pronto.como === "baixou" ? "Arquivo salvo nos downloads" : "Arquivo enviado"}</b><br />{pronto.nome}{pronto.resumo.prontuarios ? ` · com ${qtd(pronto.resumo.prontuarios, "prontuário", "prontuários")}` : ""}</span></div>
        {pronto.resumo.prontuarios > 0 && <div className="note amber"><I.alert /><span>O arquivo tem os prontuários legíveis. Guarde em lugar seguro e não deixe em computador de outra pessoa.</span></div>}
        <div className="hint">Dentro do .zip, o LEIA-ME explica o que é cada arquivo. As planilhas abrem no Excel ou no Google Planilhas.</div>
        <button className="btn ghost" onClick={() => entregar(pronto.blob, pronto.nome)}><I.down /> Baixar de novo</button>
        <button className="btn" onClick={onClose}><I.check /> Pronto</button>
      </div>
    </Sheet>
  );

  return (
    <Sheet title="Baixar meus dados" sub="Tudo o que você tem no app, num arquivo só" onClose={onClose}>
      <div className="stack">
        <div className="hint">Os seus dados são seus. Aqui sai um arquivo .zip com planilhas de {TERMO.p}, sessões, cobranças e gastos, e uma cópia completa de tudo. Dá para guardar, abrir no Excel ou levar para outro sistema quando quiser.</div>
        <div className="note"><I.lock /><span>O arquivo é montado aqui no seu aparelho. Nada é enviado para lugar nenhum.</span></div>
        {partes.length > 0 ? <div className="note"><I.receipt /><span><b>No arquivo:</b> {partes.join(", ")}{temNotas ? ` e ${qtd(db.notas.length, "anotação de prontuário", "anotações de prontuário")}` : ""}.</span></div>
          : !temNotas && <div className="hint">Ainda não há quase nada guardado, mas o arquivo já sai com o que existe.</div>}

        {temNotas && <>
          <Toggle on={incluir} onClick={() => { setIncluir(!incluir); setErro(""); }}>Incluir os prontuários abertos</Toggle>
          {incluir && !cofreAberto && db.cofre && <form className="stack" onSubmit={abrirCofre} noValidate>
            <div className="fields"><Field label="Senha do prontuário" icon={<I.key />} htmlFor="md-senha"><input id="md-senha" type="password" autoComplete="current-password" value={senha} onChange={e => { setSenha(e.target.value); setErro(""); }} /></Field></div>
            {erro && <div className="error" role="alert">{erro}</div>}
            <button className="btn ghost" type="submit" disabled={abrindo || !senha}><I.key /> {abrindo ? "Abrindo…" : "Abrir o prontuário"}</button>
          </form>}
          <div className="hint">{incluir && cofreAberto ? "Os prontuários vão legíveis, um arquivo de texto por pessoa. Guarde o arquivo em lugar seguro."
            : incluir ? "Para ir legível, o prontuário precisa estar aberto. Sem a senha, ele vai trancado, do jeito que está guardado."
              : "Sem isso, os prontuários vão trancados com a sua senha, do jeito que estão guardados."}</div>
        </>}

        <button className="btn" disabled={gerando} onClick={gerar}><I.down /> {gerando ? "Montando o arquivo…" : "Baixar meus dados"}</button>
      </div>
    </Sheet>
  );
}
