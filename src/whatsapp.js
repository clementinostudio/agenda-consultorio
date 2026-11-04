// WhatsApp de quem usa o Avina: a tela obrigatória do PWA, o Perfil e o painel do dono usam estas regras.
// Confere se o número PODE existir (DDD real, celular com 9, sem número inventado). Saber se é mesmo da pessoa exigiria
// mandar um código por SMS ou WhatsApp, e isso é pago.
const DDDS = new Set(("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 "
  + "61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99").split(" "));
const SEQUENCIAS = ["01234567", "12345678", "23456789", "98765432", "87654321", "76543210"];
const inventado = d => /^(\d)\1+$/.test(d) || SEQUENCIAS.includes(d);

// O que a pessoa digitou -> { ok: true, numero: "5543988887777" } ou { ok: false, erro: "..." }
export function lerWhatsapp(entrada) {
  const t = String(entrada || "").trim();
  let d = t.replace(/\D/g, "");
  if (!d) return { ok: false, erro: "Coloque o seu número de WhatsApp." };
  // quem mora fora escreve com + e o código do país
  if (t.startsWith("+") && !d.startsWith("55")) {
    if (d.length < 8 || d.length > 15 || inventado(d.slice(-8))) return { ok: false, erro: "Esse número não parece certo. Confira o código do país e o número." };
    return { ok: true, numero: d };
  }
  d = d.replace(/^0+/, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 10) return { ok: false, erro: /[6-9]/.test(d[2]) ? "Falta o 9 depois do DDD." : "Esse parece ser um telefone fixo. Coloque o celular que tem WhatsApp." };
  if (d.length !== 11) return { ok: false, erro: "Coloque o DDD e os 9 números do celular." };
  if (!DDDS.has(d.slice(0, 2))) return { ok: false, erro: "Esse DDD não existe. Confira." };
  if (d[2] !== "9" || d[3] === "0") return { ok: false, erro: "Celular começa com 9 depois do DDD. Confira." };
  if (inventado(d.slice(3)) || inventado(d.slice(2, 10))) return { ok: false, erro: "Esse número não parece de verdade. Coloque o seu WhatsApp." };
  return { ok: true, numero: "55" + d };
}

// Enquanto digita: (43) 98888-7777
export function mascaraWhatsapp(entrada) {
  const t = String(entrada || "");
  if (t.trim().startsWith("+")) return t;
  const d = t.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// 5543988887777 -> (43) 98888-7777 (de outro país: +351...)
export function mostrarWhatsapp(numero) {
  const d = String(numero || "");
  if (!d) return "";
  return d.startsWith("55") && d.length === 13 ? mascaraWhatsapp(d.slice(2)) : `+${d}`;
}

export const linkWhatsapp = (numero, texto) => `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
