// SEO da página de apresentação (avina.com.br), feito na hora do build (npm run build:site):
// - dados estruturados (Schema.org) em cada página, a partir do próprio HTML e dos preços de src/plano.js
// - sitemap.xml com todas as páginas que podem aparecer no Google (as com "noindex" ficam de fora)
// - robots.txt apontando para o sitemap
// - preload das fontes do título e do texto (o título aparece já na fonte certa, sem pular)
// Página nova: é só criar sobre/<endereço>/index.html com title, description e canonical. O resto sai sozinho.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PLANOS } from "./src/plano.js";

export const SITE = "https://avina.com.br";
const APP = "https://app.avina.com.br/";

// O que cada página vende (vira o bloco "WebApplication" com os preços); "trilha" é o nome curto no caminho do Google.
// Página fora daqui ganha só WebPage e trilha.
const APLICATIVO = {
  "/": { nome: "Avina", categoria: "FinanceApplication", produtos: ["pessoal", "completo"] },
  "/consultorio/": { nome: "Avina para profissionais", categoria: "BusinessApplication", produtos: ["consultorio", "completo"], trilha: "Para profissionais" },
};
// Páginas que vêm de public/ (as mesmas do app), mas cujo endereço oficial é avina.com.br
const LEGAIS = ["termos", "privacidade", "cookies"];

// Todas as páginas de sobre/ (cada index.html vira um endereço; 404.html é a página de "não encontrada")
export function paginas(raiz) {
  const achadas = {};
  const andar = pasta => readdirSync(pasta, { withFileTypes: true }).forEach(e => {
    const p = join(pasta, e.name);
    if (e.isDirectory()) andar(p);
    else if (e.name.endsWith(".html")) {
      const nome = relative(raiz, p).replace(/\\/g, "/").replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "").replace(/\//g, "-");
      achadas[nome || "inicio"] = p;
    }
  });
  andar(raiz);
  return achadas;
}

// ---------- leitura do HTML ----------
const tira = s => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const meta = (html, re) => (html.match(re) || [])[1] || "";
const ler = html => ({
  titulo: meta(html, /<title>([^<]*)<\/title>/),
  descricao: meta(html, /<meta name="description" content="([^"]*)"/),
  canonica: meta(html, /<link rel="canonical" href="([^"]*)"/),
  semIndice: /<meta name="robots" content="[^"]*noindex/.test(html),
  // perguntas da seção "Perguntas rápidas" (<details><summary>pergunta</summary><p>resposta</p></details>)
  perguntas: [...html.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map(m => ({ p: tira(m[1]), r: tira(m[2]) })),
});

// ---------- dados estruturados ----------
const ORG = `${SITE}/#organizacao`, WEBSITE = `${SITE}/#site`;

function ofertas(produtos, url) {
  const gratis = { "@type": "Offer", name: "Grátis", price: "0", priceCurrency: "BRL", url };
  const pagas = Object.values(PLANOS).filter(p => produtos.includes(p.produto)).map(p => ({
    "@type": "Offer",
    name: `${p.nome} (${p.ciclo === "ano" ? "anual" : "mensal"})`,
    price: p.preco.toFixed(2),
    priceCurrency: "BRL",
    url,
    priceSpecification: {
      "@type": "UnitPriceSpecification", price: p.preco.toFixed(2), priceCurrency: "BRL",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: p.ciclo === "ano" ? "ANN" : "MON" },
    },
  }));
  return [gratis, ...pagas];
}

function grafo(pg) {
  const url = pg.canonica;
  const caminho = new URL(url).pathname;
  const app = APLICATIVO[caminho];
  const nomeCurto = app?.trilha || pg.titulo.split(/\s[|·:]\s|:\s/)[0].trim();
  const itens = [];

  // quem faz e qual é o site: em todas as páginas, para cada uma se explicar sozinha
  itens.push({
    "@type": "Organization", "@id": ORG, name: "Avina", url: `${SITE}/`,
    logo: { "@type": "ImageObject", url: `${SITE}/icons/icon-512.png`, width: 512, height: 512 },
  });
  itens.push({ "@type": "WebSite", "@id": WEBSITE, url: `${SITE}/`, name: "Avina", inLanguage: "pt-BR", publisher: { "@id": ORG } });

  const pagina = {
    "@type": pg.perguntas.length ? ["WebPage", "FAQPage"] : "WebPage",
    "@id": url, url, name: pg.titulo, description: pg.descricao, inLanguage: "pt-BR",
    isPartOf: { "@id": WEBSITE },
  };
  if (pg.perguntas.length) pagina.mainEntity = pg.perguntas.map(q => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } }));
  if (caminho !== "/") pagina.breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: nomeCurto, item: url },
    ],
  };
  if (app) pagina.about = { "@id": `${url}#app` };
  itens.push(pagina);

  if (app) itens.push({
    "@type": "WebApplication", "@id": `${url}#app`, name: app.nome, url: APP,
    applicationCategory: app.categoria, operatingSystem: "Android, iOS, Windows, macOS",
    browserRequirements: "Funciona no navegador e pode ser instalado na tela inicial",
    inLanguage: "pt-BR", description: pg.descricao, image: `${SITE}/screenshots/computador.png`,
    offers: ofertas(app.produtos, `${url}#planos`), publisher: { "@id": ORG },
  });

  // "<" escapado: um texto com "</script>" nunca fecha a tag antes da hora
  return JSON.stringify({ "@context": "https://schema.org", "@graph": itens }).replace(/</g, "\\u003c");
}

// ---------- sitemap ----------
// data da última mudança = último commit que mexeu no arquivo (o Google ignora lastmod que muda sem motivo)
function ultimaMudanca(arquivo) {
  try {
    const d = execSync(`git log -1 --format=%cs -- "${arquivo}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (d) return d;
  } catch {}
  return new Date().toISOString().slice(0, 10);
}

function sitemap(arquivos) {
  const urls = arquivos.map(({ arquivo, url }) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${ultimaMudanca(arquivo)}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

// ---------- o plugin ----------
export default function seo({ publico }) {
  let entradas = {};
  return {
    name: "avina-seo",
    configResolved(cfg) { entradas = cfg.build.rollupOptions.input || {}; },

    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const pg = ler(html);
        const tags = [];
        if (!pg.semIndice && pg.canonica) tags.push({ tag: "script", attrs: { type: "application/ld+json" }, children: grafo(pg), injectTo: "head" });
        // fontes latinas (cobrem o português) carregam junto com o CSS
        for (const f of Object.keys(ctx.bundle || {})) {
          if (/(comfortaa|inter)-latin-wght-normal-[^/]+\.woff2$/.test(f))
            tags.push({ tag: "link", attrs: { rel: "preload", href: `/${f}`, as: "font", type: "font/woff2", crossorigin: true }, injectTo: "head-prepend" });
        }
        return tags;
      },
    },

    generateBundle() {
      const lista = [];
      for (const arquivo of Object.values(entradas)) {
        const pg = ler(readFileSync(arquivo, "utf8"));
        if (pg.semIndice || !pg.canonica) continue;
        lista.push({ arquivo: relative(process.cwd(), arquivo), url: pg.canonica });
      }
      for (const nome of LEGAIS) {
        const arquivo = resolve(publico, nome, "index.html");
        if (existsSync(arquivo) && !ler(readFileSync(arquivo, "utf8")).semIndice) lista.push({ arquivo: relative(process.cwd(), arquivo), url: `${SITE}/${nome}/` });
      }
      // a página inicial primeiro, depois em ordem alfabética
      lista.sort((a, b) => (a.url === `${SITE}/` ? -1 : b.url === `${SITE}/` ? 1 : a.url.localeCompare(b.url)));
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap(lista) });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` });
    },
  };
}
