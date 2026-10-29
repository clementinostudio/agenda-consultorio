// PDF que chegou pelo "Compartilhar" ou foi escolhido no app (boleto, comprovante, fatura do cartão):
// as linhas de texto (para achar o código do boleto ou os lançamentos da fatura) e a 1ª página como foto
// (para a IA ler o comprovante). Usa o pdf.js (Mozilla, grátis e livre); só carrega quando chega um PDF.
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = worker;

// Fatura e extrato costumam vir com senha (os primeiros números do CPF): erro.codigo diz se falta ou se errou
async function abrir(blob, senha) {
  const tarefa = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false, ...(senha ? { password: senha } : {}) });
  try { return { tarefa, doc: await tarefa.promise }; }
  catch (e) {
    tarefa.destroy();
    if (e && e.name === "PasswordException") { const x = new Error("senha"); x.codigo = e.code === 2 ? "senha-errada" : "senha"; throw x; }
    throw e;
  }
}

// O pdf.js entrega pedaços de texto soltos, cada um com a posição. Aqui eles voltam a ser linhas:
// mesma altura = mesma linha, da esquerda para a direita; um vão grande vira 3 espaços (separa colunas).
async function linhasDoDoc(doc, maxPaginas) {
  const out = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPaginas); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    const its = c.items.filter(x => x.str && x.str.trim()).map(x => ({ s: x.str, x: x.transform[4], y: x.transform[5], w: x.width || 0, h: Math.abs(x.transform[3]) || 8 }));
    its.sort((a, b) => b.y - a.y || a.x - b.x);
    const linhas = [];
    its.forEach(it => {
      const l = linhas.find(l => Math.abs(l.y - it.y) <= Math.max(2, it.h * 0.35));
      if (l) l.its.push(it); else linhas.push({ y: it.y, its: [it] });
    });
    linhas.sort((a, b) => b.y - a.y).forEach(l => {
      l.its.sort((a, b) => a.x - b.x);
      let s = "", fim = null;
      l.its.forEach(it => { if (fim != null) { const vao = it.x - fim; s += vao > it.h * 1.8 ? "   " : vao > it.h * 0.15 ? " " : ""; } s += it.s; fim = it.x + it.w; });
      out.push(s.replace(/\s+$/, ""));
    });
  }
  return out;
}

// Só as linhas (para a fatura): até 15 páginas
export async function linhasPdf(blob, senha) {
  const { tarefa, doc } = await abrir(blob, senha);
  try { return await linhasDoDoc(doc, 15); } finally { tarefa.destroy(); }
}

// Linhas + a 1ª página como foto (o que chega pelo Compartilhar)
export async function lerPdf(blob) {
  const { tarefa, doc } = await abrir(blob);
  try {
    const linhas = await linhasDoDoc(doc, 15);
    const pg = await doc.getPage(1);
    const v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(3, 1400 / Math.max(v1.width, v1.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    await pg.render({ canvas, viewport: vp, background: "#fff" }).promise;
    const b = await new Promise(ok => canvas.toBlob(ok, "image/jpeg", 0.85));
    return { texto: linhas.join("\n"), linhas, imagem: b ? new File([b], "comprovante.jpg", { type: "image/jpeg" }) : null };
  } finally { tarefa.destroy(); }
}
