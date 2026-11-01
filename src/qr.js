// QR code (zxing, o mesmo do leitor de boleto): só carrega quando alguém pede um QR. Usado pelo Pix com valor da loja
// (telas/loja.jsx) e pelo pedido "lojaPix" do app de celular (src/app-nativo-trabalho.js)
import wasmEscritor from "zxing-wasm/writer/zxing_writer.wasm?url";

let ESCRITOR = null;
export const escritorQR = () => ESCRITOR || (ESCRITOR = import("zxing-wasm/writer").then(m => { m.prepareZXingModule({ overrides: { locateFile: (p, prefix) => (p.endsWith(".wasm") ? wasmEscritor : prefix + p) } }); return m; }));
// o QR de um texto, em SVG (null se não deu)
export const qrSvg = texto => escritorQR().then(m => m.writeBarcode(texto, { format: "QRCode", ecLevel: "M", withQuietZones: true })).then(r => (r && r.svg) || null);
