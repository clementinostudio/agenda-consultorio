// Regras do link que não dependem de nada (testáveis com npm test). src/link.js reexporta tudo daqui.

// O que está em db.confirmados["<paciente>:<data>"]: true (marcado à mão) ou { r: "sim" | "remarcar", em } (resposta
// do próprio paciente pelo link). Devolve "manual", "paciente", "remarcar" ou null.
export const confirmacaoDe = v => !v ? null : v === true ? "manual" : v.r === "remarcar" ? "remarcar" : "paciente";
export const confirmado = v => { const c = confirmacaoDe(v); return c === "manual" || c === "paciente"; };
