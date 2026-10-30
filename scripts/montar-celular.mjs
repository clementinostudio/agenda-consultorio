// Monta a cópia do Avina para o app de celular: roda o build do vite.celular.config.js e junta tudo num HTML só.
//   node scripts/montar-celular.mjs                 → app-celular/assets/site/ (vai dentro do app; abre sem internet)
//   node scripts/montar-celular.mjs --publicar dist → também em dist/celular/ (sai junto com o site; o app baixa
//                                                     sozinho as versões novas, sem esperar a loja)
// O versao.json diz quando a cópia foi montada e qual "ponte" ela usa (o jeito de conversar com o app nativo:
// src/app-nativo.js). O app só aceita cópias com uma ponte que ele conhece.
import { build } from "vite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PONTE = 1;
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(raiz, "dist-celular");
const BASE = "https://app.avina.com.br/";

await build({ root: raiz, configFile: join(raiz, "vite.celular.config.js"), logLevel: "warn" });

const ler = url => {
  if (!url.startsWith(BASE)) throw new Error(`Arquivo fora do app: ${url}`);
  return readFileSync(join(SAIDA, url.slice(BASE.length)), "utf8");
};
// dentro de <script>, "</script" e "<!--" confundem o navegador: escapa sem mudar o que o código faz
const seguro = js => js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

let html = readFileSync(join(SAIDA, "index.html"), "utf8");
let js = 0, css = 0;
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) => { js++; return `<script type="module">${seguro(ler(src))}</script>`; });
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => { css++; return `<style>${ler(href)}</style>`; });
if (js !== 1 || css !== 1) throw new Error(`Esperava 1 script e 1 estilo no index.html, achei ${js} e ${css}`);
if (/src="https:\/\/app\.avina\.com\.br\/assets\/[^"]+\.js"/.test(html)) throw new Error("Sobrou um script de fora no HTML");

let commit = "";
try { commit = execSync("git rev-parse --short HEAD", { cwd: raiz }).toString().trim(); } catch (e) {}
const versao = { versao: Date.now(), commit, ponte: PONTE, bytes: Buffer.byteLength(html) };

const gravar = pasta => {
  mkdirSync(pasta, { recursive: true });
  writeFileSync(join(pasta, "avina.html"), html);
  writeFileSync(join(pasta, "versao.json"), JSON.stringify(versao));
};
gravar(join(raiz, "app-celular", "assets", "site"));
const i = process.argv.indexOf("--publicar");
if (i > 0) gravar(join(raiz, process.argv[i + 1] || "dist", "celular"));

console.log(`Avina do celular montado: ${(versao.bytes / 1024 / 1024).toFixed(1)} MB${commit ? ` (commit ${commit})` : ""}`);
