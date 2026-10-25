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
  novo: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>,
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
      {versao && (
        <div className="aviso-versao" role="alert">
          <i><Ic.novo /></i>
          <div><b>Nova versão disponível</b><span>Leva um segundo, sem perder nada.</span></div>
          <button className="av-depois" onClick={() => setVersao(false)}>Depois</button>
          <button className="av-atualizar" onClick={atualizar} disabled={atualizando}>{atualizando ? "Atualizando…" : "Atualizar"}</button>
        </div>
      )}
    </div>
  );
}
