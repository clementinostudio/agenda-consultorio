// Parte do app carregada sob demanda (só quando é aberta). Gerado a partir do App.jsx.
import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import PORQUINHO from "../assets/porquinho.webp";
import { createPortal, flushSync } from "react-dom";
import { vibrar, I } from "../App.jsx";

function Cropper({ src, forma = "circulo", titulo, onDone, onCancel }) {
  const imgRef = useRef(null), frameRef = useRef(null);
  const ptrs = useRef(new Map()), pinca = useRef(null);
  const [nat, setNat] = useState(null);
  const [z, setZ] = useState(1);
  const [o, setO] = useState({ x: 0, y: 0 });
  const [erro, setErro] = useState("");
  const vw = window.innerWidth, vh = window.innerHeight;
  let W, H;
  if (forma === "circulo") { W = H = Math.min(300, vw - 64); }
  else { const r = vh / vw; H = Math.min(vh * 0.56, 480); W = H / r; if (W > vw - 48) { W = vw - 48; H = W * r; } }
  useEffect(() => { const im = new Image(); im.onload = () => { imgRef.current = im; setNat({ w: im.naturalWidth, h: im.naturalHeight }); }; im.onerror = () => setErro("Não consegui abrir essa imagem."); im.src = src; }, [src]);
  const cover = nat ? Math.max(W / nat.w, H / nat.h) : 1;
  const prender = (x, y, zz) => { if (!nat) return { x, y }; const s = cover * zz, mx = (nat.w * s - W) / 2, my = (nat.h * s - H) / 2; return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }; };
  const mudarZoom = nz => { nz = Math.max(1, Math.min(5, nz)); setZ(nz); setO(c => prender(c.x, c.y, nz)); };
  // rodinha do mouse (no computador)
  useEffect(() => {
    const el = frameRef.current; if (!el) return;
    const f = e => { e.preventDefault(); setZ(zz => { const nz = Math.max(1, Math.min(5, zz * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); setO(c => prender(c.x, c.y, nz)); return nz; }); };
    el.addEventListener("wheel", f, { passive: false });
    return () => el.removeEventListener("wheel", f);
  });
  const dist = () => { const [a, b] = [...ptrs.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const down = e => { e.currentTarget.setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.current.size === 2) pinca.current = { d: dist(), z }; };
  const move = e => {
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) setO(c => prender(c.x + e.clientX - prev.x, c.y + e.clientY - prev.y, z));
    else if (ptrs.current.size === 2 && pinca.current) mudarZoom(pinca.current.z * dist() / pinca.current.d);
  };
  const up = e => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinca.current = null; };
  const s = cover * z, dw = nat ? nat.w * s : 0, dh = nat ? nat.h * s : 0;
  const left = (W - dw) / 2 + o.x, top = (H - dh) / 2 + o.y;
  const usar = () => {
    const im = imgRef.current; if (!im) return;
    const outW = forma === "circulo" ? 400 : 1080, outH = Math.round(outW * H / W);
    const c = document.createElement("canvas"); c.width = outW; c.height = outH;
    c.getContext("2d").drawImage(im, -left / s, -top / s, W / s, H / s, 0, 0, outW, outH);
    vibrar("ok");
    onDone(c.toDataURL("image/jpeg", forma === "circulo" ? .86 : .82));
  };
  // Vai direto para o <body>: assim aparece por cima de tudo, mesmo aberto de dentro de um painel
  return createPortal(
    <div className="crop" role="dialog" aria-modal="true" aria-label={titulo || "Ajustar imagem"}>
      <div className="crop-top"><button className="icon-btn" onClick={onCancel} aria-label="Cancelar"><I.x /></button><b>{titulo || "Ajustar imagem"}</b><span style={{ width: 42 }} /></div>
      <div className="crop-mid">
        <div ref={frameRef} className={"crop-frame" + (forma === "circulo" ? " circ" : "")} style={{ width: W, height: H }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {nat && <img src={src} alt="" draggable="false" style={{ width: dw, height: dh, left, top }} />}
          <span className="crop-grid" aria-hidden="true" />
        </div>
        <p className="crop-dica">{erro || "Arraste para posicionar. Use dois dedos ou a barra para dar zoom."}</p>
      </div>
      <div className="crop-bot">
        <div className="crop-zoom">
          <button type="button" aria-label="Diminuir zoom" onClick={() => mudarZoom(z / 1.2)}><I.minus /></button>
          <input type="range" min="1" max="5" step="0.01" value={z} onChange={e => mudarZoom(Number(e.target.value))} aria-label="Zoom" />
          <button type="button" aria-label="Aumentar zoom" onClick={() => mudarZoom(z * 1.2)}><I.plus /></button>
        </div>
        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={usar} disabled={!nat}><I.check /> Usar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export { Cropper };
