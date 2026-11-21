import { useEffect, useRef, useState } from "react";

/* =========================================================
   Avisos do sistema (aparecem por cima de qualquer tela)
   - Nova versão: quando você publica uma atualização, o app mostra "Atualizar" em vez de trocar sozinho no meio do uso.
   - Sem internet: uma pílula discreta avisando que está offline (e que tudo continua salvo no aparelho).
   ========================================================= */

// O main.jsx chama isto quando o service worker encontra uma versão nova esperando
let atualizarAgora = null;
export function avisarNovaVersao(fn) {
  atualizarAgora = fn;
  window.dispatchEvent(new Event("alvena-nova-versao"));
}

const Ic = {
  semRede: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.6a10 10 0 0 1 3.3-2.2M16.2 10.6A10 10 0 0 1 19 12.6M8.6 16.3a5 5 0 0 1 6.8 0M12 20h.01M3 3l18 18" /></svg>,
  ok: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  novo: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V8M8.5 11.5 12 8l3.5 3.5" /><path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6" /><path d="M18 3v3.5h-3.5M6 21v-3.5h3.5" /></svg>,
};

export default function AvisosSistema() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [voltou, setVoltou] = useState(false);
  const [versao, setVersao] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const tVoltou = useRef(null);

  useEffect(() => {
    const off = () => { clearTimeout(tVoltou.current); setVoltou(false); setOnline(false); };
    const on = () => { setOnline(true); setVoltou(true); clearTimeout(tVoltou.current); tVoltou.current = setTimeout(() => setVoltou(false), 2600); };
    const nova = () => setVersao(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    window.addEventListener("alvena-nova-versao", nova);
    if (atualizarAgora) setVersao(true);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); window.removeEventListener("alvena-nova-versao", nova); clearTimeout(tVoltou.current); };
  }, []);

  const atualizar = () => {
    setAtualizando(true);
    try { if (atualizarAgora) atualizarAgora(true); else location.reload(); } catch (e) { location.reload(); }
    setTimeout(() => location.reload(), 4000); // garantia, caso o navegador não recarregue sozinho
  };

  return (
    <>
    <div className="avisos-sis" aria-live="polite">
      {!online && (
        <div className="aviso-pilula offline" role="status">
          <i><Ic.semRede /></i><span><b>Sem internet</b> · tudo continua salvo no aparelho</span>
        </div>
      )}
      {online && voltou && (
        <div className="aviso-pilula online" role="status">
          <i><Ic.ok /></i><span>Conectado de novo</span>
        </div>
      )}
    </div>
    {/* versão nova: um cartão que sobe de baixo (acima da barra de baixo), no visual do app, sem travar a tela */}
    {versao && (
      <div className="nova-cartao" role="alert">
        <div className="nova-topo">
          <span className="nova-ic" aria-hidden="true"><Ic.novo /></span>
          <span className="nova-t"><b>Tem versão nova do Avina</b><small>Leva um segundo e nada do que você anotou se perde.</small></span>
        </div>
        <div className="nova-botoes">
          <button className="nova-depois" onClick={() => setVersao(false)}>Agora não</button>
          <button className="nova-atualizar" onClick={atualizar} disabled={atualizando}>{atualizando ? <><i className="nova-gira" aria-hidden="true" />Atualizando…</> : "Atualizar agora"}</button>
        </div>
      </div>
    )}
    </>
  );
}
