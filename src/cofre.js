// Cofre das anotações de sessão: o texto é trancado no aparelho com uma senha que só a pessoa sabe
// (AES-GCM de 256 bits, chave tirada da senha com PBKDF2). Na nuvem só chega o texto embaralhado:
// nem o Supabase nem o servidor de avisos conseguem ler. Sem a senha, não há como recuperar.
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { let s = ""; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const ITERACOES = 310000;
const TESTE = "alvena-cofre-ok";
const MINUTOS_ABERTO = 10;

let chave = null, timer = null;
const avisar = () => dispatchEvent(new Event("cofre"));

async function derivar(senha, sal, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function trancar(texto, k = chave) {
  if (!k) throw new Error("cofre fechado");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(texto));
  return { iv: b64(iv), ct: b64(ct) };
}
export async function abrirTexto(item, k = chave) {
  if (!k) throw new Error("cofre fechado");
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(item.iv) }, k, deB64(item.ct)));
}
// Primeira vez: cria o cofre (o que vai para o db é só o sal e um texto de teste trancado)
export async function criarCofre(senha) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const k = await derivar(senha, sal, ITERACOES);
  const teste = await trancar(TESTE, k);
  chave = k; mexeu();
  return { v: 1, sal: b64(sal), iter: ITERACOES, teste };
}
export async function destrancar(cofre, senha) {
  const k = await derivar(senha, deB64(cofre.sal), cofre.iter || ITERACOES);
  try { if (await abrirTexto(cofre.teste, k) !== TESTE) return false; } catch (e) { return false; }
  chave = k; mexeu();
  return true;
}
// Troca a senha: abre tudo com a chave atual e tranca de novo com a nova
export async function trocarSenha(notas, nova) {
  const textos = await Promise.all(notas.map(n => abrirTexto(n)));
  const cofre = await criarCofre(nova);
  const novas = await Promise.all(notas.map(async (n, i) => ({ ...n, ...(await trancar(textos[i])) })));
  return { cofre, notas: novas };
}
export const aberto = () => !!chave;
export function fecharCofre() { chave = null; clearTimeout(timer); avisar(); }
// Cada uso renova o tempo; parado por 10 minutos, tranca sozinho
export function mexeu() { clearTimeout(timer); if (chave) timer = setTimeout(fecharCofre, MINUTOS_ABERTO * 60000); avisar(); }
// Saindo do app (tela bloqueada, outro app), tranca depois de 1 minuto
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
  if (!chave) return;
  if (document.visibilityState === "hidden") { clearTimeout(timer); timer = setTimeout(fecharCofre, 60000); }
  else mexeu();
});
