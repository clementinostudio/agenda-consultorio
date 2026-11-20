// Testes das regras que não podem errar. Rode: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { lerWhatsapp, mascaraWhatsapp, mostrarWhatsapp } from "./whatsapp.js";
import { fonteDaVisita, limparOrigem } from "./origem.js";
import { faseCortesia } from "./plano.js";
import { valorDaSessao, lerNumero } from "./ferramentas-contas.js";
import { porExtenso, cpfValido, fmtCPF, dataLonga } from "./documentos-pdf.js";
import { pixCopiaECola } from "./loja-contas.js";
import { pagadorDoExtrato, separarPix } from "./pix-auto.js";
import { confirmacaoDe, confirmado } from "./link-regras.js";

test("WhatsApp: aceita celular do Brasil em vários jeitos de escrever", () => {
  for (const n of ["(43) 98820-8714", "43988208714", "043 98820 8714", "+55 43 98820-8714", "5543988208714"])
    assert.deepEqual(lerWhatsapp(n), { ok: true, numero: "5543988208714" }, n);
});

test("WhatsApp: recusa o que não pode existir", () => {
  for (const n of ["", "abc", "123", "(20) 98820-8714", "(43) 3333-4444", "(43) 8820-8714", "(43) 88208-7141", "(43) 99999-9999", "(11) 91234-5678", "(43) 90820-8714", "(43) 98820-87145"])
    assert.equal(lerWhatsapp(n).ok, false, n);
});

test("WhatsApp: número de fora precisa do +", () => {
  assert.deepEqual(lerWhatsapp("+351 962 741 853"), { ok: true, numero: "351962741853" });
  assert.equal(lerWhatsapp("+1 11111111").ok, false);
});

test("WhatsApp: máscara e exibição", () => {
  assert.equal(mascaraWhatsapp("43988208714"), "(43) 98820-8714");
  assert.equal(mostrarWhatsapp("5543988208714"), "(43) 98820-8714");
  assert.equal(mostrarWhatsapp("351912345678"), "+351912345678");
});

test("Origem: marca do link, site de onde veio, direto", () => {
  assert.equal(fonteDaVisita("?utm_source=Instagram", "https://www.google.com/", "avina.com.br"), "instagram");
  assert.equal(fonteDaVisita("", "https://www.google.com.br/", "avina.com.br"), "google");
  assert.equal(fonteDaVisita("", "https://l.instagram.com/x", "avina.com.br"), "instagram");
  assert.equal(fonteDaVisita("", "", "avina.com.br"), "direto");
  assert.equal(fonteDaVisita("", "https://avina.com.br/loja/", "avina.com.br"), "");
  assert.equal(limparOrigem("<script>alert(1)</script>"), "scriptalert1script");
});

test("Cortesia: aviso 14 dias antes, e depois enquanto o preço de lançamento vale", () => {
  const ate = "2026-11-27";
  assert.equal(faseCortesia(ate, "2026-11-04"), null);
  assert.deepEqual(faseCortesia(ate, "2026-11-13"), { fase: "acabando", dias: 14 });
  assert.deepEqual(faseCortesia(ate, "2026-11-26"), { fase: "acabando", dias: 1 });
  assert.equal(faseCortesia(ate, "2026-11-27").fase, "acabou");
  assert.equal(faseCortesia(ate, "2026-11-30").fase, "acabou");
  assert.equal(faseCortesia(ate, "2026-12-01"), null);
  assert.equal(faseCortesia(null, "2026-11-20"), null);
});

test("Número digitado do jeito brasileiro", () => {
  for (const [t, v] of [["6.000", 6000], ["1.250,50", 1250.5], ["150", 150], ["R$ 150,00", 150], ["1.000.000", 1000000], ["12.5", 12.5], ["", 0], ["abc", 0]])
    assert.equal(lerNumero(t), v, t);
});

test("Valor da sessão", () => {
  const r = valorDaSessao({ renda: 6000, custos: 1500, sessoesSemana: 20, semanasFolga: 4, faltas: 10, imposto: 25 });
  assert.equal(r.bruto, 10000);
  assert.equal(r.sessoesMes, 72);
  assert.equal(r.valor, 140); // 138,88 sobe para 140
  assert.equal(valorDaSessao({ renda: 0, sessoesSemana: 20 }), null);
  assert.equal(valorDaSessao({ renda: 6000, sessoesSemana: 0 }), null);
});

test("Recibo: valor por extenso, CPF e data", () => {
  assert.equal(porExtenso(150), "cento e cinquenta reais");
  assert.equal(porExtenso(1250.5), "mil duzentos e cinquenta reais e cinquenta centavos");
  assert.equal(porExtenso(1), "um real");
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(fmtCPF("52998224725"), "529.982.247-25");
  assert.equal(dataLonga("2026-11-04"), "4 de novembro de 2026");
});

test("Pix: código com valor e CRC", () => {
  const t = pixCopiaECola({ chave: "12345678900@email.com", nome: "Ana Lima", cidade: "Apucarana", valor: 150 });
  assert.match(t, /^000201/);
  assert.match(t, /5406150\.00/);
  assert.match(t, /6304[0-9A-F]{4}$/);
});

test("Pix do banco: tira do texto só o nome de quem pagou", () => {
  assert.equal(pagadorDoExtrato("PIX RECEBIDO - MARIA S SOUZA", "Pix recebido de Maria S Souza 123.456.789-00"), "maria souza");
  assert.equal(pagadorDoExtrato("Transferência recebida", "TRANSF PIX RECEB JOAO DA SILVA ***.456.789-**"), "joao silva");
  assert.equal(pagadorDoExtrato("Pix - Nu Pagamentos", ""), "");
});

test("Pix do banco: só marca sozinho com nome e valor batendo; o resto vira dúvida", () => {
  const itens = [
    { id: "t1", tipo: "entrada", valor: 150, data: "2026-11-20", desc: "Pix recebido", bruto: "PIX RECEBIDO ANA SOUZA" },
    { id: "t2", tipo: "entrada", valor: 140, data: "2026-11-20", desc: "Pix recebido", bruto: "PIX RECEBIDO FULANO" },
    { id: "t3", tipo: "saida", valor: 150, data: "2026-11-20", desc: "Pix enviado", bruto: "PIX ENVIADO ANA" },
    { id: "t4", tipo: "entrada", valor: 99, data: "2026-11-20", desc: "Salário", bruto: "CREDITO SALARIO" },
  ];
  const casar = pre => pre.tid === "t1" ? [{ pid: "p1", ids: ["c1"], nota: 5 }] : pre.tid === "t2" ? [{ pid: "p2", ids: ["c2"], nota: 2 }] : [];
  const r = separarPix(itens, casar);
  assert.deepEqual(r.automaticos.map(a => [a.tid, a.pid, a.ids]), [["t1", "p1", ["c1"]]]);
  assert.deepEqual(r.duvidas.map(d => d.tid), ["t2"]);
  assert.equal(separarPix(itens, casar, { vistos: new Set(["t1", "t2"]) }).automaticos.length, 0);
  assert.equal(separarPix(itens, casar, { desde: "2026-11-21" }).duvidas.length, 0);
});

test("Confirmação: a resposta do paciente e a marcação à mão", () => {
  assert.equal(confirmacaoDe(true), "manual");
  assert.equal(confirmacaoDe({ r: "sim", em: 1 }), "paciente");
  assert.equal(confirmacaoDe({ r: "remarcar", em: 1 }), "remarcar");
  assert.equal(confirmacaoDe(false), null);
  assert.equal(confirmado({ r: "remarcar" }), false);
  assert.equal(confirmado({ r: "sim" }), true);
});
