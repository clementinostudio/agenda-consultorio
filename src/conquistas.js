/* =========================================================
   Conquistas: celebram a rotina (fechar o dia, agenda em dia, dinheiro guardado),
   não a produtividade. Tudo sai dos dados que o app já tem; nada de pontos para "atender mais".
   Cada conquista tem uma ilustração (public/ilustras/) que diz de que trilha ela é.
   Depois de conquistada, fica para sempre (db.conquistas = { id: "AAAA-MM-DD" }).
   ========================================================= */

export const TRILHAS = {
  rotina: { nome: "Rotina leve", ilustra: "cafe" },
  consultorio: { nome: "Consultório organizado", ilustra: "arquivo" },
  metas: { nome: "Metas", ilustra: "trofeu" },
  dinheiro: { nome: "Dinheiro da casa", ilustra: "dinheiro" },
  estrada: { nome: "Na estrada", ilustra: "pneu" },
  app: { nome: "Do seu jeito", ilustra: "ipad" },
  seguranca: { nome: "Seguro", ilustra: "cadeados" },
};

export const NIVEIS = [[0, "Começando"], [3, "No ritmo"], [7, "Em dia"], [12, "Referência"], [18, "Lenda da agenda"]];
export function nivelDe(n) {
  let i = 0; for (let k = 0; k < NIVEIS.length; k++) if (n >= NIVEIS[k][0]) i = k;
  const prox = NIVEIS[i + 1];
  return { nome: NIVEIS[i][1], prox: prox ? prox[1] : null, faltam: prox ? prox[0] - n : 0, pct: prox ? (n - NIVEIS[i][0]) / (prox[0] - NIVEIS[i][0]) : 1 };
}

// [id, trilha, título, como conseguir, meta, valor atual(x), só no modo Pessoal, ilustração própria]
const LISTA = [
  ["fechar-1", "rotina", "Primeiro dia fechado", "Feche o dia uma vez: 2 minutos e você desliga tranquilo.", 1, x => x.fechadosTotal],
  ["fechar-3", "rotina", "Três dias seguidos", "Feche o dia 3 vezes seguidas.", 3, x => x.fechadosMelhor],
  ["fechar-7", "rotina", "Uma semana em dia", "Feche o dia 7 vezes seguidas.", 7, x => x.fechadosMelhor],
  ["fechar-21", "rotina", "Hábito formado", "Feche o dia 21 vezes seguidas.", 21, x => x.fechadosMelhor],
  ["fechar-60", "rotina", "Cabeça leve", "Chegue a 60 dias fechados.", 60, x => x.fechadosTotal],
  ["primeiro-pac", "consultorio", "Primeira ficha", "Cadastre o primeiro paciente.", 1, x => x.pacientes],
  ["sessoes-10", "consultorio", "Agenda andando", "Registre 10 sessões.", 10, x => x.sessoes],
  ["sessoes-100", "consultorio", "Cem encontros", "Registre 100 sessões.", 100, x => x.sessoes],
  ["sessoes-500", "consultorio", "Trajetória", "Registre 500 sessões.", 500, x => x.sessoes],
  ["presenca", "consultorio", "Presença firme", "Um mês com 10 sessões ou mais e 90% de presença.", 90, x => x.melhorPresenca],
  ["meta-1", "metas", "Meta batida", "Bata a meta do mês (defina em Perfil → Valores e metas).", 1, x => x.metasBatidas],
  ["meta-3", "metas", "Três metas seguidas", "Bata a meta 3 meses seguidos.", 3, x => x.metasSeguidas],
  ["receber-zero", "metas", "Ninguém devendo", "Fique com todas as cobranças recebidas (depois das 5 primeiras).", 1, x => x.tudoRecebido],
  ["caixinha-1", "dinheiro", "Primeira caixinha", "Guarde dinheiro numa caixinha.", 1, x => x.caixinhas, true],
  ["caixinha-meta", "dinheiro", "Objetivo alcançado", "Complete a meta de uma caixinha.", 1, x => x.caixinhaCompleta, true],
  ["mes-azul", "dinheiro", "Mês no azul", "Termine um mês com mais entrada do que saída.", 1, x => x.mesesAzul, true],
  ["teto-ok", "dinheiro", "Dentro do teto", "Termine um mês sem estourar nenhum teto de categoria.", 1, x => x.mesesNoTeto, true],
  ["tanque-1", "estrada", "Primeiro tanque", "Anote um abastecimento com os litros (em Transporte → Abastecer).", 1, x => x.abastecimentos, true, "bomba"],
  ["consumo-real", "estrada", "Consumo de verdade", "Anote 2 abastecimentos com a km do painel: o app calcula quanto o carro faz por litro.", 2, x => x.comKm, true, "bomba"],
  ["oleo", "estrada", "Motor feliz", "Anote uma troca de óleo para receber o lembrete da próxima.", 1, x => x.trocasOleo, true, "ferramentas"],
  ["papelada", "estrada", "Papelada no lugar", "Coloque a data do IPVA, do licenciamento ou do seguro do carro.", 1, x => x.docsCarro, true],
  ["voz-10", "app", "Fala que eu anoto", "Anote 10 gastos falando.", 10, x => x.porVoz, true],
  ["extrato", "app", "Extrato em dia", "Importe o extrato do banco.", 1, x => x.importados, true, "arquivo"],
  ["boleto", "app", "Boleto na mão", "Leia um boleto pela câmera ou pelo código.", 1, x => x.boletos, true, "arquivo"],
  ["instalado", "app", "Na tela inicial", "Instale o app no celular ou no computador.", 1, x => x.instalado],
  ["avisos", "app", "Nada passa batido", "Ligue os avisos com o app fechado.", 1, x => x.push],
  ["nuvem", "seguranca", "Guardado com chave", "Use uma conta com login: tudo fica salvo na nuvem.", 1, x => x.nuvem],
  ["discreto", "seguranca", "Discrição", "Avisos ligados sem o nome do paciente na tela bloqueada.", 1, x => x.discreto],
];

// Junta os números que as conquistas usam (uma passada só pelos dados)
function medir(db, h, ex) {
  const hoje = h.todayISO(), fech = db.fechados || {};
  // dias com atendimento até ontem (+ os fechados): a sequência só conta dias de trabalho
  const dias = [...new Set([...db.sessions.map(s => s.date), ...Object.keys(fech)])].filter(d => d < hoje).sort();
  let seq = 0, melhor = 0, total = 0;
  for (const d of dias) { if (fech[d]) { seq++; total++; if (seq > melhor) melhor = seq; } else seq = 0; }
  if (fech[hoje]) { total++; if (seq + 1 > melhor) melhor = seq + 1; }
  // meses (últimos 24) do consultório e da casa
  const meses = []; { const d = h.fromISO(hoje); for (let i = 0; i < 24; i++) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); meses.push(`${m.getFullYear()}-${h.pad(m.getMonth() + 1)}`); } }
  const meta = (ex.perfil && ex.perfil.meta) || 0;
  let metasBatidas = 0, metasSeguidas = 0, corrida = 0, melhorPresenca = 0;
  [...meses].reverse().forEach(ch => {
    const ses = db.sessions.filter(s => s.date.startsWith(ch));
    const feitas = ses.filter(s => s.status === "done").length, faltas = ses.filter(s => s.status === "missed").length;
    if (feitas >= 10) melhorPresenca = Math.max(melhorPresenca, Math.round(feitas / (feitas + faltas) * 100));
    if (meta > 0 && h.liquidoMes(db, ch) >= meta) { metasBatidas++; corrida++; metasSeguidas = Math.max(metasSeguidas, corrida); } else if (ch !== hoje.slice(0, 7)) corrida = 0;
  });
  const cobrancas = db.charges.filter(c => !c.hidden);
  const P = db.pessoal || { lanc: [], contas: [], caixinhas: [] };
  const guardado = cx => h.soma(cx.movs || [], m => m.valor);
  // meses já fechados da casa: sobrou dinheiro? ficou dentro dos tetos?
  let mesesAzul = 0, mesesNoTeto = 0;
  const lim = Object.entries(P.limites || {}).filter(([, v]) => v > 0);
  meses.slice(1).forEach(ch => {
    const ls = P.lanc.filter(l => l.data.startsWith(ch)); if (ls.length < 5) return;
    const pagas = P.contas.filter(c => c.pagas && c.pagas[ch]);
    const entrou = h.soma(ls.filter(l => l.tipo === "entrada"), l => l.valor) + (P.incluirConsultorio ? h.liquidoMes(db, ch) : 0);
    const saiu = h.soma(ls.filter(l => l.tipo === "saida"), l => l.valor) + h.soma(pagas, c => c.valor);
    if (entrou > saiu) mesesAzul++;
    if (lim.length) { const g = {}; ls.forEach(l => { if (l.tipo === "saida") g[l.cat] = (g[l.cat] || 0) + l.valor; }); pagas.forEach(c => { g[c.cat] = (g[c.cat] || 0) + c.valor; }); if (lim.every(([c, v]) => (g[c] || 0) <= v)) mesesNoTeto++; }
  });
  return {
    fechadosTotal: total, fechadosMelhor: melhor,
    pacientes: db.patients.length, sessoes: db.sessions.filter(s => s.status === "done").length, melhorPresenca,
    metasBatidas, metasSeguidas,
    tudoRecebido: cobrancas.length >= 5 && cobrancas.every(c => c.paid) ? 1 : 0,
    caixinhas: (P.caixinhas || []).filter(cx => guardado(cx) > 0).length,
    caixinhaCompleta: (P.caixinhas || []).filter(cx => cx.meta > 0 && guardado(cx) >= cx.meta).length,
    mesesAzul, mesesNoTeto,
    porVoz: P.lanc.filter(l => l.via === "voz").length,
    importados: P.lanc.some(l => l.importId) ? 1 : 0,
    boletos: P.contas.some(c => c.codigo) ? 1 : 0,
    abastecimentos: P.lanc.filter(l => l.cat === "transporte" && l.litros > 0).length,
    comKm: P.lanc.filter(l => l.cat === "transporte" && l.litros > 0 && l.km > 0).length,
    trocasOleo: P.lanc.filter(l => l.cat === "transporte" && l.manut === "oleo").length,
    docsCarro: (P.veiculos || (P.veiculo ? [P.veiculo] : [])).some(v => v && v.docs && Object.values(v.docs).some(d => d && d.data)) ? 1 : 0,
    instalado: ex.instalado ? 1 : 0, push: ex.push ? 1 : 0, nuvem: ex.nuvem ? 1 : 0,
    discreto: ex.push && !(ex.av && ex.av.nomes) ? 1 : 0,
  };
}

// Lista de conquistas com o progresso de cada uma. ex: { perfil, usaPessoal, instalado, push, nuvem, av }
export function avaliarConquistas(db, h, ex) {
  const x = medir(db, h, ex), feitas = db.conquistas || {};
  return LISTA.filter(c => !c[6] || ex.usaPessoal).map(([id, trilha, titulo, texto, meta, valor, , ilustra]) => {
    const atual = Math.min(meta, Math.max(0, valor(x) || 0));
    return { id, trilha, titulo, texto, meta, atual, pct: atual / meta, ilustra: ilustra || TRILHAS[trilha].ilustra, feito: !!feitas[id] || atual >= meta, quando: feitas[id] || null };
  });
}

// A próxima conquista que está mais perto (para o cartão do Início)
export function proximaConquista(lista, trilhas) {
  return lista.filter(c => !c.feito && c.pct >= .34 && (!trilhas || trilhas.includes(c.trilha))).sort((a, b) => b.pct - a.pct)[0] || null;
}
