// "Baixar meus dados": tudo o que a pessoa tem no app num arquivo .zip, montado aqui no aparelho (nada vai para
// servidor nenhum). Serve para levar os registros para onde quiser (portabilidade da LGPD) e para guardar uma cópia.
// Sem React e sem bibliotecas: o .zip é feito à mão (sem compressão, o jeito mais simples que todo sistema abre).
import { aberto, abrirTexto, mexeu } from "./cofre.js";

/* ---------- ZIP (método STORE, sem compressão) ---------- */
const enc = new TextEncoder();
// tabela do CRC-32 (o mesmo do zip, do png e do gzip), feita uma vez só
let TABELA = null;
function crc32(bytes) {
  if (!TABELA) {
    TABELA = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABELA[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABELA[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// data e hora no formato do MS-DOS (é o que o zip guarda): hora local, segundos de 2 em 2
function dosDataHora(d) {
  const ano = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    data: ((ano - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}
// arquivos: [{ nome: "pasta/arquivo.csv", dados: texto ou Uint8Array, data?: Date }] → Blob application/zip.
// Os nomes vão em UTF-8 (bit 11 ligado), para os acentos aparecerem certos no Windows, no Mac e no unzip.
export function criarZip(arquivos) {
  const partes = [], central = [];
  let pos = 0;
  const agora = new Date();
  for (const a of arquivos) {
    const nome = enc.encode(String(a.nome).replace(/\\/g, "/").replace(/^\/+/, ""));
    const dados = typeof a.dados === "string" ? enc.encode(a.dados) : a.dados instanceof Uint8Array ? a.dados : new Uint8Array(a.dados || []);
    const crc = crc32(dados), { hora, data } = dosDataHora(a.data || agora);
    // cabeçalho local (30 bytes + nome)
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034B50, true);  // assinatura
    loc.setUint16(4, 20, true);          // versão necessária (2.0)
    loc.setUint16(6, 0x0800, true);      // bit 11: nome em UTF-8
    loc.setUint16(8, 0, true);           // método 0 = STORE
    loc.setUint16(10, hora, true);
    loc.setUint16(12, data, true);
    loc.setUint32(14, crc, true);
    loc.setUint32(18, dados.length, true); // tamanho guardado
    loc.setUint32(22, dados.length, true); // tamanho original
    loc.setUint16(26, nome.length, true);
    loc.setUint16(28, 0, true);          // sem campo extra
    partes.push(new Uint8Array(loc.buffer), nome, dados);
    // entrada do diretório central (46 bytes + nome)
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014B50, true);
    cen.setUint16(4, (3 << 8) | 20, true); // feito em "Unix", versão 2.0 (as permissões abaixo valem no Mac e no Linux)
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, hora, true);
    cen.setUint16(14, data, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, dados.length, true);
    cen.setUint32(24, dados.length, true);
    cen.setUint16(28, nome.length, true);
    cen.setUint16(30, 0, true);           // extra
    cen.setUint16(32, 0, true);           // comentário
    cen.setUint16(34, 0, true);           // disco
    cen.setUint16(36, 0, true);           // atributos internos
    cen.setUint32(38, (0o100644 << 16) >>> 0, true); // arquivo comum, rw-r--r--
    cen.setUint32(42, pos, true);         // onde começa o cabeçalho local
    central.push(new Uint8Array(cen.buffer), nome);
    pos += 30 + nome.length + dados.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  // fim do diretório central (22 bytes)
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054B50, true);
  fim.setUint16(4, 0, true);
  fim.setUint16(6, 0, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, pos, true);
  fim.setUint16(20, 0, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: "application/zip" });
}

/* ---------- planilhas (CSV do jeito do app: ";" entre colunas, tudo entre aspas, BOM, abre direto no Excel) ---------- */
const BOM = "﻿";
const aspas = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
export const linhaCSV = cols => cols.map(aspas).join(";");
// cabecalho: ["Data", "Nome", ...]; linhas: [[...], ...]
export const csv = (cabecalho, linhas) => BOM + [cabecalho, ...linhas].map(linhaCSV).join("\r\n") + "\r\n";
// dinheiro como nas outras planilhas do app (150,00: o Excel brasileiro lê como número)
export const dinheiro = v => (Number(v) || 0).toFixed(2).replace(".", ",");
// "2026-03-05" → "05/03/2026" (o que não for data fica como veio)
export const dataBR = iso => {
  const s = String(iso || "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s;
};
const pad = n => String(n).padStart(2, "0");
const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const simNao = v => v ? "sim" : "não";
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* ---------- prontuários ---------- */
// O texto das anotações trancadas, quando o cofre está aberto: [{ pid, sid, tipo, data, texto }].
// tipo "ficha" (o texto é o JSON da ficha) ou "evolucao". null se o cofre está fechado ou não há anotações.
export async function notasLegiveis(db) {
  const notas = (db && db.notas) || [];
  if (!notas.length || !aberto()) return null;
  const abertas = await Promise.all(notas.map(async n => {
    try { return { pid: n.pid, sid: n.sid || null, tipo: n.tipo === "ficha" ? "ficha" : "evolucao", data: n.data || "", criado: n.criado || 0, texto: await abrirTexto(n) }; }
    catch (e) { return null; } // uma anotação que não abre não impede as outras
  }));
  mexeu(); // usar o cofre renova o tempo dele aberto
  return abertas.filter(Boolean);
}
// O que vai na ficha do prontuário (os mesmos campos da ficha em telas/consultorio.jsx)
const FICHA = [
  ["demanda", "Avaliação da demanda"],
  ["objetivos", "Objetivos do trabalho"],
  ["procedimentos", "Abordagem e procedimentos"],
  ["encaminhamento", "Encaminhamento ou encerramento"],
  ["documentos", "Documentos produzidos"],
];
const lerFicha = t => { try { const d = JSON.parse(t); return d && typeof d === "object" ? d : { demanda: String(t) }; } catch (e) { return { demanda: String(t || "") }; } };
function textoProntuario(p, notas, { conta, hoje, sessoes }) {
  const pf = (conta && conta.perfil) || {}, doc = pf.doc || {};
  const L = [`PRONTUÁRIO · ${p.name}`, ""];
  const prof = [doc.nome || (conta && conta.nome), pf.profissao, doc.registro ? `registro ${doc.registro}` : ""].filter(Boolean).join(" · ");
  if (prof) L.push(`Profissional: ${prof}`);
  L.push(`Gerado em ${dataBR(hoje)} pelo Avina`, `Sessões atendidas: ${sessoes}`, "");
  const ficha = notas.filter(n => n.tipo === "ficha").sort((a, b) => b.criado - a.criado)[0];
  if (ficha) {
    const f = lerFicha(ficha.texto);
    L.push("== FICHA DO ATENDIMENTO ==", "");
    if (f.inicio) L.push(`Início do atendimento: ${dataBR(f.inicio)}`);
    if (f.nascimento) L.push(`Data de nascimento: ${dataBR(f.nascimento)}`);
    if (f.inicio || f.nascimento) L.push("");
    FICHA.forEach(([k, titulo]) => { if (f[k] && String(f[k]).trim()) L.push(`${titulo}:`, String(f[k]).trim(), ""); });
  }
  const evol = notas.filter(n => n.tipo !== "ficha").sort((a, b) => a.data.localeCompare(b.data) || a.criado - b.criado);
  if (evol.length) {
    L.push("== EVOLUÇÕES ==", "");
    evol.forEach(n => L.push(`-- ${dataBR(n.data)} --`, String(n.texto || "").trim(), ""));
  }
  return BOM + L.join("\r\n").replace(/\r?\n/g, "\r\n");
}
// nome de arquivo que todo sistema aceita (tira / \ : * ? " < > | e o que não se vê), sem repetir
function nomeArquivo(nome, usados) {
  const base = String(nome || "").normalize("NFC").replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 80) || "Sem nome";
  let n = base, i = 2;
  while (usados.has(n.toLowerCase())) n = `${base} (${i++})`;
  usados.add(n.toLowerCase());
  return n;
}

/* ---------- o pacote ---------- */
// Tira da conta e do db o que é segredo (a senha embaralhada das contas sem nuvem, tokens): o resto vai inteiro
const SEGREDO = /^(hash|senha|password|token|access_?token|refresh_?token|secret|segredo)$|token$/i;
function semSegredos(x) {
  if (Array.isArray(x)) return x.map(semSegredos);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).filter(([k]) => !SEGREDO.test(k)).map(([k, v]) => [k, semSegredos(v)]));
  return x;
}
const SITUACAO = { done: "Atendido", missed: "Falta" };
const FREQ = { 7: "Semanal", 14: "Quinzenal", 28: "Mensal" };
const PREF = { manhã: "Manhã", tarde: "Tarde", noite: "Noite", qualquer: "Tanto faz" };

// { db, conta, notasAbertas?, nomeCat?, agora? } → { blob, nome, resumo }
// notasAbertas: o que notasLegiveis(db) devolveu (sem isso, os prontuários vão só trancados, no dados-completos.json).
// nomeCat: id da categoria → nome (o app passa o dele; sem isso fica o id)
export async function montarPacote({ db, conta, notasAbertas, nomeCat, agora = new Date() }) {
  db = db || {};
  const hoje = isoDe(agora);
  const cat = id => (nomeCat && id ? nomeCat(id) : id) || "";
  const pacientes = db.patients || [], sessoes = db.sessions || [], cobrancas = (db.charges || []).filter(c => !c.hidden);
  const espera = db.espera || [], P = db.pessoal || {}, lanc = (P.lanc || []).filter(Boolean), contas = (P.contas || []).filter(Boolean);
  const pac = id => pacientes.find(p => p.id === id);
  const nomePac = id => (pac(id) || { name: "Removido" }).name;
  const arquivos = [], conteudo = [];
  const por = (a, b) => String(a || "").localeCompare(String(b || ""));

  if (pacientes.length) {
    arquivos.push({ nome: "consultorio/pacientes.csv", dados: csv(
      ["Nome", "WhatsApp", "CPF", "Situação", "Desde", "Valor da sessão", "Sublocação", "Frequência", "Horário", "Próxima sessão", "Cobrança", "Sessões no pacote", "Quem paga", "CPF de quem paga", "Sessões atendidas", "Faltas"],
      pacientes.slice().sort((a, b) => por(a.name, b.name)).map(p => {
        const ses = sessoes.filter(s => s.patientId === p.id);
        return [p.name, p.phone, p.cpf, p.active === false ? "Inativo" : "Ativo", dataBR(p.desde), dinheiro(p.price),
          p.subletType === "percent" ? `${String(p.sublet ?? 0).replace(".", ",")}%` : dinheiro(p.sublet),
          FREQ[p.freq] || (p.freq ? `A cada ${p.freq} dias` : ""), p.time, p.active === false ? "" : dataBR(p.nextDate),
          p.billing === "package" ? "Por pacote" : "Por sessão", p.billing === "package" ? p.packageSize : "",
          p.pagadorNome, p.pagadorNome ? p.pagadorCpf : "", ses.filter(s => s.status === "done").length, ses.filter(s => s.status === "missed").length];
      })) });
    conteudo.push("consultorio/pacientes.csv: as pessoas cadastradas, com contato, valores e a agenda de cada uma.");
  }
  if (sessoes.length) {
    arquivos.push({ nome: "consultorio/sessoes.csv", dados: csv(
      ["Data", "Horário", "Nome", "Situação", "Valor", "Sublocação", "Líquido", "Cobrança paga em"],
      sessoes.slice().sort((a, b) => por(a.date, b.date) || por(a.time, b.time)).map(s => {
        const c = s.chargeId && cobrancas.find(x => x.id === s.chargeId);
        const entra = s.status === "done" || s.cobrada;
        return [dataBR(s.date), s.time, nomePac(s.patientId), s.status === "missed" && s.cobrada ? "Falta cobrada" : SITUACAO[s.status] || s.status || "",
          dinheiro(s.price), dinheiro(s.sublet), dinheiro(entra ? (Number(s.price) || 0) - (Number(s.sublet) || 0) : 0),
          !entra ? "" : c && c.paid ? dataBR(c.paidAt) : "em aberto"];
      })) });
    conteudo.push("consultorio/sessoes.csv: cada sessão registrada (atendida ou falta), com o valor e se já foi paga.");
  }
  if (cobrancas.length) {
    arquivos.push({ nome: "consultorio/cobrancas.csv", dados: csv(
      ["Criada em", "Nome", "Valor", "Situação", "Pago em", "Sessões", "Recibo feito", "No Receita Saúde"],
      cobrancas.slice().sort((a, b) => por(a.createdAt, b.createdAt)).map(c => [dataBR(c.createdAt), nomePac(c.patientId), dinheiro(c.amount),
        c.paid ? "Paga" : "Em aberto", c.paid ? dataBR(c.paidAt) : "",
        (c.sessionIds || []).map(id => sessoes.find(s => s.id === id)).filter(Boolean).map(s => s.date).sort().map(dataBR).join(" "),
        simNao(c.reciboEm), simNao(c.rsaude)])) });
    conteudo.push("consultorio/cobrancas.csv: as cobranças, pagas e em aberto, com as sessões de cada uma.");
  }
  if (espera.length) {
    arquivos.push({ nome: "consultorio/lista-de-espera.csv", dados: csv(
      ["Nome", "WhatsApp", "Prefere", "Observação", "Na lista desde"],
      espera.slice().sort((a, b) => por(a.desde, b.desde)).map(e => [e.nome, e.phone, PREF[e.pref] || e.pref, e.obs, dataBR(e.desde)])) });
    conteudo.push("consultorio/lista-de-espera.csv: quem está esperando um horário.");
  }
  if (lanc.length) {
    arquivos.push({ nome: "pessoal/lancamentos.csv", dados: csv(
      ["Data", "Tipo", "Descrição", "Categoria", "Valor", "Moeda original", "Valor na moeda original", "Banco", "Observação"],
      lanc.slice().sort((a, b) => por(a.data, b.data)).map(l => [dataBR(l.data), l.tipo === "entrada" ? "Entrada" : "Gasto", l.desc, cat(l.cat), dinheiro(l.valor),
        l.moeda && l.moeda !== "BRL" ? l.moeda : "", l.moeda && l.moeda !== "BRL" && l.valorOrig != null ? dinheiro(l.valorOrig) : "",
        typeof l.banco === "string" ? l.banco : "", l.obs])) });
    conteudo.push("pessoal/lancamentos.csv: os gastos e as entradas do Pessoal.");
  }
  if (contas.length) {
    arquivos.push({ nome: "pessoal/contas-fixas.csv", dados: csv(
      ["Nome", "Valor", "Vence todo dia", "Categoria", "Assinatura", "Meses pagos"],
      contas.slice().sort((a, b) => por(a.nome, b.nome)).map(c => [c.nome, dinheiro(c.valor), c.dia, cat(c.cat), simNao(c.assinatura),
        Object.keys(c.pagas || {}).sort().map(m => `${m.slice(5, 7)}/${m.slice(0, 4)}`).join(" ")])) });
    conteudo.push("pessoal/contas-fixas.csv: as contas de todo mês e os meses em que foram pagas.");
  }

  // prontuários legíveis: um .txt por pessoa (a ficha primeiro, depois as evoluções por data)
  let prontuarios = 0;
  if (notasAbertas && notasAbertas.length) {
    const usados = new Set();
    const pids = [...new Set(notasAbertas.map(n => n.pid))];
    pids.map(pid => pac(pid) || { id: pid, name: "Removido" }).sort((a, b) => por(a.name, b.name)).forEach(p => {
      const ns = notasAbertas.filter(n => n.pid === p.id);
      arquivos.push({ nome: `prontuarios/${nomeArquivo(p.name, usados)}.txt`, dados: textoProntuario(p, ns, { conta, hoje, sessoes: sessoes.filter(s => s.patientId === p.id && s.status === "done").length }) });
      prontuarios++;
    });
    conteudo.push("prontuarios/: um arquivo de texto por pessoa, com a ficha do atendimento e as evoluções em ordem de data.");
  }

  // tudo, do jeito que o app guarda (dá para abrir em qualquer editor de texto ou programa que leia JSON)
  const completo = { app: "Avina", geradoEm: agora.toISOString(), conta: semSegredos(conta || {}), dados: semSegredos(db) };
  arquivos.push({ nome: "dados-completos.json", dados: JSON.stringify(completo, null, 2) });

  const notasTrancadas = (db.notas || []).length;
  const resumo = { pacientes: pacientes.length, sessoes: sessoes.length, cobrancas: cobrancas.length, espera: espera.length, lancamentos: lanc.length, contas: contas.length, prontuarios, notasTrancadas };
  const leia = [
    "MEUS DADOS NO AVINA",
    "",
    `Arquivo gerado em ${dataBR(hoje)} às ${pad(agora.getHours())}:${pad(agora.getMinutes())}${conta && conta.nome ? `, da conta de ${conta.nome}` : ""}${conta && conta.email ? ` (${conta.email})` : ""}.`,
    "Ele foi montado no seu aparelho. Nada foi enviado para nenhum lugar.",
    "",
    "O QUE TEM AQUI",
    "",
    ...conteudo.map(t => `- ${t}`),
    "- dados-completos.json: tudo o que você tem no app, do jeito que ele guarda. Serve para levar para outro sistema ou guardar uma cópia completa.",
    "",
    "As planilhas (.csv) abrem no Excel, no Google Planilhas ou no Numbers. Datas no formato DD/MM/AAAA e valores em reais (150,00).",
    "",
    "PRONTUÁRIOS",
    "",
    !notasTrancadas ? "Não há anotações de prontuário na conta."
      : prontuarios ? `Os prontuários vieram legíveis na pasta "prontuarios", porque o cofre estava aberto quando o arquivo foi gerado. Guarde este arquivo em lugar seguro: ele tem informação sigilosa.`
        : `As ${plural(notasTrancadas, "anotação", "anotações")} de prontuário estão no dados-completos.json ainda trancadas com a sua senha (o texto aparece embaralhado). Para recebê-las legíveis, abra o cofre com a senha e gere o arquivo de novo.`,
    "",
  ].join("\r\n");
  arquivos.unshift({ nome: "LEIA-ME.txt", dados: BOM + leia });

  arquivos.forEach(a => { a.data = agora; });
  return { blob: criarZip(arquivos), nome: `avina-meus-dados-${hoje}.zip`, resumo, arquivos: arquivos.map(a => a.nome) };
}
