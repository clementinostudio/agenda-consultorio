// O Avina dentro do app: a cópia do site num HTML só (montada por ../scripts/montar-celular.mjs).
// - Uma cópia vem dentro do app (assets/site/avina.html): abre na hora, até sem internet.
// - O site publica as versões novas em https://app.avina.com.br/celular/. O app procura ao abrir e ao voltar para
//   ele; se tiver, baixa e guarda no aparelho, e a versão nova entra na próxima vez que o Avina abrir.
//   Assim o app acompanha o site sem esperar a loja (o código roda na WebView, como a Apple permite).
// - Só aceita cópias com uma ponte que este app conhece (PONTE em lib/ponte.ts).
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { PONTE } from '@/lib/ponte';
import embutida from '@/assets/site/versao.json';

export const ENDERECO = 'https://app.avina.com.br/';
type Versao = { versao: number; ponte: number; commit?: string };

const pasta = new Directory(Paths.document, 'site');
const arqHtml = new File(pasta, 'avina.html');
const arqVersao = new File(pasta, 'versao.json');

async function baixada(): Promise<Versao | null> {
  try { return arqHtml.exists && arqVersao.exists ? (JSON.parse(await arqVersao.text()) as Versao) : null; } catch { return null; }
}

export async function carregarSite(): Promise<{ html: string; versao: number }> {
  const v = await baixada();
  if (v && v.versao > embutida.versao && v.ponte <= PONTE) {
    try { return { html: await arqHtml.text(), versao: v.versao }; } catch {}
  }
  const [a] = await Asset.loadAsync(require('@/assets/site/avina.html'));
  return { html: await new File(a.localUri ?? a.uri).text(), versao: embutida.versao };
}

let procurando = false;
// true quando baixou uma versão mais nova que a aberta agora
export async function procurarVersaoNova(aberta: number): Promise<boolean> {
  if (procurando) return false;
  procurando = true;
  try {
    const r = await fetch(`${ENDERECO}celular/versao.json`, { cache: 'no-store' });
    if (!r.ok) return false;
    const v = (await r.json()) as Versao;
    if (!(v.versao > aberta) || v.ponte > PONTE) return false;
    const ja = await baixada();
    if (ja && ja.versao >= v.versao) return true;
    const h = await fetch(`${ENDERECO}celular/avina.html`, { cache: 'no-store' });
    const html = h.ok ? await h.text() : '';
    if (html.length < 200_000 || !html.includes('</html>')) return false; // veio pela metade
    if (!pasta.exists) pasta.create();
    await arqHtml.write(html);
    await arqVersao.write(JSON.stringify(v)); // por último: só vale quando o HTML já está inteiro
    return true;
  } catch {
    return false;
  } finally {
    procurando = false;
  }
}
