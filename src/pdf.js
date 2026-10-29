// PDF que chegou pelo "Compartilhar" (boleto, comprovante do banco, fatura): o texto, para achar o código
// do boleto, e a 1ª página como foto, para a IA ler o comprovante. Usa o pdf.js (Mozilla, grátis e livre).
// Só carrega quando chega um PDF: quem nunca compartilha um PDF não baixa nada disto.
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = worker;

export async function lerPdf(blob) {
  const tarefa = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false });
  const doc = await tarefa.promise;
  try {
    // texto das primeiras páginas (o código do boleto costuma estar na 1ª; em carnê, numa das seguintes)
    let texto = "";
    for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
      const c = await (await doc.getPage(i)).getTextContent();
      texto += c.items.map(x => x.str || "").join(" ") + "\n";
    }
    // 1ª página como foto (do mesmo tamanho das fotos que vão para a IA)
    const pg = await doc.getPage(1);
    const v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(3, 1400 / Math.max(v1.width, v1.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    await pg.render({ canvas, viewport: vp, background: "#fff" }).promise;
    const b = await new Promise(ok => canvas.toBlob(ok, "image/jpeg", 0.85));
    return { texto, imagem: b ? new File([b], "comprovante.jpg", { type: "image/jpeg" }) : null };
  } finally { tarefa.destroy(); }
}
