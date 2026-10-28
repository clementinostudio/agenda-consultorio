// Parte do app carregada sob demanda (só quando é aberta): ler boleto e importar extrato do banco.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { I, Sheet, Field, brlReal, dm, todayISO, diffDias, uid, catDe, CATEGORIAS, CAT_ENTRADA, interpretarFala, MarcaLogo, vibrar, copiarTexto, relativo, Ilustra } from "../App.jsx";
import { normalizar, marcaPorId } from "../marcas.js";
import { lerBoleto } from "../boleto.js";
import { lerExtrato, ehInterno } from "../extrato.js";
// O leitor de código de barras (zxing) vem junto com o app: funciona sem internet e não depende de CDN
import wasmLeitor from "zxing-wasm/reader/zxing_reader.wasm?url";

/* =========================================================
   LER BOLETO: câmera, foto ou código colado
   ========================================================= */
let ZX = null;
async function leitorZxing() {
  if (!ZX) ZX = import("zxing-wasm/reader").then(m => { m.prepareZXingModule({ overrides: { locateFile: (p, prefix) => (p.endsWith(".wasm") ? wasmLeitor : prefix + p) } }); return m; });
  return ZX;
}
// Leitor nativo do Android (Chrome) quando ele sabe ler o código dos boletos (ITF); senão, o zxing
let NATIVO;
async function leitorNativo() {
  if (NATIVO !== undefined) return NATIVO;
  try { NATIVO = "BarcodeDetector" in window && (await window.BarcodeDetector.getSupportedFormats()).includes("itf") ? new window.BarcodeDetector({ formats: ["itf"] }) : null; }
  catch (e) { NATIVO = null; }
  return NATIVO;
}
async function lerCodigos(fonte) {
  const nat = await leitorNativo();
  if (nat) { try { const r = await nat.detect(fonte); if (r.length) return r.map(x => x.rawValue); } catch (e) {} }
  const zx = await leitorZxing();
  const img = fonte instanceof HTMLCanvasElement ? fonte.getContext("2d").getImageData(0, 0, fonte.width, fonte.height) : fonte;
  const r = await zx.readBarcodes(img, { formats: ["ITF"], tryHarder: true, maxNumberOfSymbols: 1 });
  return r.filter(x => x.isValid !== false).map(x => x.text);
}

// QR code (o da nota fiscal do mercado): leitor nativo quando ele lê QR; senão, o zxing
let NATIVO_QR;
async function leitorNativoQR() {
  if (NATIVO_QR !== undefined) return NATIVO_QR;
  try { NATIVO_QR = "BarcodeDetector" in window && (await window.BarcodeDetector.getSupportedFormats()).includes("qr_code") ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null; }
  catch (e) { NATIVO_QR = null; }
  return NATIVO_QR;
}
// fonte: canvas (quadro da câmera) ou arquivo de foto. Devolve todos os QR codes achados
// (o cupom às vezes tem outro QR além do da nota: Pix, promoção, Instagram da loja).
export async function lerQRs(fonte) {
  const nat = await leitorNativoQR();
  if (nat) { try { const r = await nat.detect(fonte instanceof Blob ? await createImageBitmap(fonte) : fonte); if (r.length) return r.map(x => x.rawValue); } catch (e) {} }
  const zx = await leitorZxing();
  const img = fonte instanceof HTMLCanvasElement ? fonte.getContext("2d").getImageData(0, 0, fonte.width, fonte.height) : fonte;
  const r = await zx.readBarcodes(img, { formats: ["QRCode"], tryHarder: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 4 });
  return r.filter(x => x.isValid !== false).map(x => x.text);
}

export function BoletoSheet({ texto, act, onClose }) {
  const [res, setRes] = useState(() => (texto ? lerBoleto(texto) : null));
  const [cod, setCod] = useState(texto || "");
  const [cam, setCam] = useState(""); // "" | abrindo | lendo
  const [erro, setErro] = useState("");
  const [luz, setLuz] = useState(null); // null = aparelho sem lanterna
  const video = useRef(null), stream = useRef(null), vivo = useRef(true), fotoRef = useRef(null);
  const parar = () => { if (stream.current) stream.current.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); stream.current = null; setCam(""); setLuz(null); };
  useEffect(() => () => { vivo.current = false; parar(); }, []);
  const achou = b => { parar(); setRes(b); setErro(""); setCod(b.linha); vibrar("ok"); };
  const abrirCamera = async () => {
    setErro(""); setRes(null); setCam("abrindo");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (!vivo.current) { s.getTracks().forEach(t => t.stop()); return; }
      stream.current = s;
      const v = video.current; v.srcObject = s; v.setAttribute("playsinline", ""); await v.play().catch(() => {});
      try { const cap = s.getVideoTracks()[0].getCapabilities(); if (cap && cap.torch) setLuz(false); } catch (e) {}
      setCam("lendo");
      const tela = document.createElement("canvas");
      const passo = async () => {
        if (!vivo.current || !stream.current) return;
        try {
          const w = v.videoWidth, h = v.videoHeight;
          if (w && h) {
            // só a faixa do meio (onde fica a moldura): mais rápido e com menos coisa para confundir
            const fh = Math.round(h * .42), y = Math.round((h - fh) / 2);
            tela.width = w; tela.height = fh;
            tela.getContext("2d", { willReadFrequently: true }).drawImage(v, 0, y, w, fh, 0, 0, w, fh);
            for (const t of await lerCodigos(tela)) { const b = lerBoleto(t); if (b) return achou(b); }
          }
        } catch (e) {}
        setTimeout(passo, 180);
      };
      passo();
    } catch (e) {
      setCam("");
      setErro(e && e.name === "NotAllowedError" ? "A câmera não foi liberada. Libere nas configurações do aparelho, ou cole o código abaixo." : "Não consegui abrir a câmera. Tente pela foto ou cole o código abaixo.");
    }
  };
  const lanterna = async () => { try { const t = stream.current.getVideoTracks()[0]; await t.applyConstraints({ advanced: [{ torch: !luz }] }); setLuz(!luz); } catch (e) {} };
  const daFoto = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    setErro(""); setCam("abrindo");
    try {
      const nat = await leitorNativo();
      let textos = [];
      if (nat) { try { textos = (await nat.detect(await createImageBitmap(f))).map(x => x.rawValue); } catch (e2) {} }
      if (!textos.length) { const zx = await leitorZxing(); textos = (await zx.readBarcodes(f, { formats: ["ITF"], tryHarder: true })).map(x => x.text); }
      const b = textos.map(lerBoleto).find(Boolean);
      setCam("");
      if (b) achou(b); else setErro("Não achei o código de barras nessa foto. Tire de perto, com o código inteiro e reto, ou cole a linha digitável.");
    } catch (e2) { setCam(""); setErro("Não consegui ler a foto. Cole a linha digitável abaixo."); }
  };
  const digitou = t => { setCod(t); const b = lerBoleto(t); setRes(b); setErro(b || t.replace(/\D/g, "").length < 44 ? "" : "Esse código não confere. Confira se copiou inteiro."); };
  const colar = async () => { try { digitou(await navigator.clipboard.readText()); } catch (e) { setErro("Não consegui colar sozinho. Toque no campo e cole."); } };
  const venc = res && res.vencimento;
  return (
    <Sheet title="Ler boleto" sub="Valor e vencimento saem do próprio código. Funciona sem internet." onClose={onClose}>
      {!res && (
        <div className={"boleto-cam" + (cam ? " on" : "")}>
          <video ref={video} muted playsInline aria-label="Câmera" />
          {cam === "lendo" && <><i className="boleto-guia" aria-hidden="true" /><span className="boleto-dica">Encaixe o código de barras na faixa</span></>}
          {!cam && <button type="button" className="boleto-abrir" onClick={abrirCamera}><I.camera /><b>Apontar a câmera</b><small>para o código de barras</small></button>}
          {cam === "abrindo" && <span className="boleto-dica">Abrindo…</span>}
          {cam === "lendo" && luz !== null && <button type="button" className="pill-btn boleto-luz" onClick={lanterna}>{luz ? "Apagar luz" : "Acender luz"}</button>}
        </div>
      )}
      {!res && <div className="acts-linha">
        <button type="button" className="pill-btn" onClick={() => fotoRef.current && fotoRef.current.click()}><I.upload /> Foto ou print</button>
        {cam && <button type="button" className="pill-btn" onClick={parar}>Parar câmera</button>}
        <input ref={fotoRef} type="file" accept="image/*" hidden onChange={daFoto} />
      </div>}
      <div className="fields">
        <Field label="Ou cole a linha digitável" icon={<I.scan />} htmlFor="b-cod">
          <input id="b-cod" inputMode="numeric" value={cod} onChange={e => digitou(e.target.value)} placeholder="00190.00009 01234.567890…" autoComplete="off" />
        </Field>
      </div>
      {!res && navigator.clipboard && navigator.clipboard.readText && <button type="button" className="btn text" onClick={colar}>Colar o código copiado</button>}
      {erro && <div className="error">{erro}</div>}
      {res && (
        <div className="boleto-res">
          <div className="boleto-res-top"><span>{res.emissor}</span><b>{res.valor > 0 ? brlReal(res.valor) : "Valor não informado"}</b></div>
          <div className="hint" style={{ padding: 0 }}>{venc ? <>Vence {relativo(venc).toLowerCase()} ({dm(venc)}){res.vencimentoIncerto ? " · confira, esta conta não traz o vencimento no padrão" : ""}</> : "O vencimento não vem no código desta conta."}</div>
          <div className="boleto-cod"><span><small>Linha digitável</small><b>{res.linha}</b></span><button type="button" className="pill-btn" onClick={() => copiarTexto(res.linha.replace(/\D/g, ""), act, "Código copiado. É só colar no app do banco.")}><I.copy /> Copiar</button></div>
          <button className="btn mode" onClick={() => act.contaDoBoleto(res)}><I.bill /> Virar conta fixa (todo mês)</button>
          <button className="btn ghost" onClick={() => act.gastoDoBoleto(res)}><I.check /> Já paguei: anotar gasto</button>
          <button className="btn text" onClick={() => { setRes(null); setCod(""); }}>Ler outro</button>
        </div>
      )}
    </Sheet>
  );
}

/* =========================================================
   IMPORTAR EXTRATO: OFX ou CSV do app do banco
   ========================================================= */
const COMO = [
  ["Nubank", "Conta: Extrato > ícone de compartilhar > Exportar extrato (OFX ou CSV). Cartão: Fatura > Exportar fatura (CSV)."],
  ["Inter", "Extrato > Exportar > OFX ou CSV."],
  ["Itaú, Bradesco, BB, Caixa, Santander", "No site ou app: Extrato > Salvar/Exportar > OFX (Money) ou CSV/Excel."],
];

export function ImportarSheet({ db, act, onClose }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const arq = useRef(null);
  // o que você já corrigiu antes vale para as próximas importações (mesma loja -> mesma categoria)
  const aprendido = useMemo(() => {
    const m = {}; [...db.pessoal.lanc].sort((a, b) => a.data.localeCompare(b.data)).forEach(l => { if (l.desc) m[normalizar(l.desc)] = { cat: l.cat, marca: l.marca || null }; });
    return m;
  }, [db.pessoal.lanc]);
  const preparar = lista => {
    const ids = new Set(db.pessoal.lanc.map(l => l.importId).filter(Boolean));
    return lista.map((x, i) => {
      const importId = `ext:${x.fid || `${x.data}|${x.valor}|${x.bruto}`}`;
      const r = interpretarFala(`${x.tipo === "entrada" ? "recebi" : "gastei"} 1 ${x.bruto}`);
      const ap = aprendido[normalizar(x.desc)];
      const lista0 = x.tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
      let cat = ap && lista0.some(c => c.id === ap.cat) ? ap.cat : r.cat && lista0.some(c => c.id === r.cat) ? r.cat : x.tipo === "entrada" ? "outros-e" : "outros";
      const marca = (ap && ap.marca) || r.marca || null;
      const desc = marca && marcaPorId(marca) ? marcaPorId(marca).nome : x.desc;
      const ja = ids.has(importId);
      // já anotado à mão: mesmo valor, até 2 dias de diferença e a mesma categoria (ou nome parecido)
      const nx = normalizar(desc);
      const parecido = !ja && db.pessoal.lanc.some(l => l.tipo === x.tipo && Math.abs(l.valor - x.valor) < .01 && Math.abs(diffDias(l.data, x.data)) <= 2
        && (l.cat === cat || (l.marca && l.marca === marca) || (nx && normalizar(l.desc || "").split(" ").some(w => w.length > 3 && nx.includes(w)))));
      const interno = ehInterno(x.bruto);
      return { k: i, ...x, desc, cat, marca, importId, ja, parecido, interno, on: !ja && !parecido && !interno };
    }).sort((a, b) => b.data.localeCompare(a.data));
  };
  const escolher = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    setErro(""); setLendo(true);
    try {
      const lista = await lerExtrato(f);
      if (!lista.length) setErro("Não achei lançamentos nesse arquivo. Use o OFX ou o CSV exportado pelo app do banco.");
      else setItens(preparar(lista));
    } catch (e2) { setErro("Não consegui ler esse arquivo. Use o OFX ou o CSV exportado pelo app do banco."); }
    setLendo(false);
  };
  const mudar = (k, patch) => setItens(l => l.map(x => (x.k === k ? { ...x, ...patch } : x)));
  const inverter = () => setItens(l => l.map(x => { const tipo = x.tipo === "saida" ? "entrada" : "saida"; return { ...x, tipo, cat: tipo === "entrada" ? "outros-e" : "outros" }; }));
  const marcados = (itens || []).filter(x => x.on && !x.ja);
  const importar = () => act.importarLanc(marcados.map(x => ({ id: uid(), tipo: x.tipo, valor: x.valor, cat: x.cat, desc: x.desc, data: x.data, marca: x.marca, importId: x.importId })));
  if (!itens) return (
    <Sheet title="Importar extrato" sub="Traz os lançamentos do banco de uma vez. O arquivo é lido aqui no aparelho e não vai para lugar nenhum." onClose={onClose}>
      <Ilustra n="arquivo" className="sheet-ilustra" />
      <button className="btn mode" onClick={() => arq.current && arq.current.click()} disabled={lendo}><I.upload /> {lendo ? "Lendo…" : "Escolher o arquivo do extrato"}</button>
      <input ref={arq} type="file" accept=".ofx,.qfx,.csv,.txt,text/csv,application/x-ofx,application/vnd.intu.qfx" hidden onChange={escolher} />
      {erro && <div className="error">{erro}</div>}
      <div className="imp-como">
        <b>Como baixar o arquivo</b>
        {COMO.map(([b, t]) => <p key={b}><span>{b}:</span> {t}</p>)}
        <p>O que já estiver no app (mesmo valor, perto da mesma data) vem desmarcado. Pagamento de fatura, aplicação e resgate também.</p>
      </div>
    </Sheet>
  );
  const nJa = itens.filter(x => x.ja).length, nPar = itens.filter(x => x.parecido).length, nInt = itens.filter(x => x.interno && !x.ja).length;
  return (
    <Sheet title="Conferir antes de importar" sub={`${itens.length} lançamentos no arquivo${nJa ? ` · ${nJa} já importados` : ""}${nPar ? ` · ${nPar} parecem já estar no app` : ""}${nInt ? ` · ${nInt} entre contas` : ""}`} onClose={onClose}>
      <div className="acts-linha">
        <button type="button" className="pill-btn" onClick={() => setItens(l => l.map(x => ({ ...x, on: !x.ja })))}>Marcar todos</button>
        <button type="button" className="pill-btn" onClick={() => setItens(l => l.map(x => ({ ...x, on: false })))}>Desmarcar</button>
        <button type="button" className="pill-btn" onClick={inverter}>Sinais trocados?</button>
      </div>
      <div className="imp-lista">
        {itens.map(x => {
          const lista = x.tipo === "entrada" ? CAT_ENTRADA : CATEGORIAS;
          return (
            <div key={x.k} className={"imp-row" + (x.on ? " on" : "") + (x.ja ? " ja" : "")}>
              <button type="button" className={"box" + (x.on ? " done" : " up")} disabled={x.ja} onClick={() => mudar(x.k, { on: !x.on })} aria-label={x.on ? "Não importar" : "Importar"}>{x.on && <I.check />}</button>
              <MarcaLogo marca={x.marca} nome={x.desc} cat={catDe(x.cat)} className="txn-av" />
              <span className="mid">
                <span className="nm">{x.desc || catDe(x.cat).nome}</span>
                <span className="sb">
                  {dm(x.data)} · <select value={x.cat} onChange={e => mudar(x.k, { cat: e.target.value, on: !x.ja })} aria-label="Categoria">{lista.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                  {x.ja ? " · já importado" : x.parecido ? " · parece já estar no app" : x.interno ? " · entre contas" : ""}
                </span>
              </span>
              <span className={"amt" + (x.tipo === "entrada" ? " pos" : "")}>{x.tipo === "entrada" ? "+" : "−"}{brlReal(x.valor)}</span>
            </div>
          );
        })}
      </div>
      <button className="btn mode" disabled={!marcados.length} onClick={importar}><I.check /> Importar {marcados.length} {marcados.length === 1 ? "lançamento" : "lançamentos"}</button>
      <button className="btn text" onClick={() => setItens(null)}>Escolher outro arquivo</button>
    </Sheet>
  );
}
