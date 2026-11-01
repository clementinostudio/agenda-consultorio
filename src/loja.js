// Loja: o caixa de uma loja pequena (doces, sorvete, salgados...). Quem cuida da loja e quem ajuda anotam as vendas,
// os gastos e o que está faltando, e no fim do dia o app diz quanto deveria ter na gaveta.
// Com login, fica na nuvem (tabelas loja_* do Supabase, só quem é da loja enxerga). Sem login (no computador,
// sem a nuvem ligada), a loja fica guardada só no aparelho.
// Diferente da casa, a loja junta muita coisa (cada venda é uma linha): o app baixa só os dois últimos meses
// e, depois, só o que mudou. Os meses antigos chegam somados por dia (função loja_resumo).
import { useEffect, useRef, useState } from "react";
import { NUVEM, cliente, ENDERECO_APP } from "./nuvem.js";

export const MAX_AJUDANTES = 5;
export const linkDoConviteLoja = token => `${ENDERECO_APP}#loja=${token}`;
const K_CACHE = uid => `agenda-loja:${uid}`;
const K_FILA = uid => `agenda-loja-fila:${uid}`;
export const K_CONVITE_LOJA = "agenda-convite-loja";
const ler = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fotoPequena = f => (f && f.length <= 150000 ? f : null);
const pad = n => String(n).padStart(2, "0");
const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hojeLoja = () => isoDe(new Date());
// primeiro dia do mês passado: daqui para a frente o app guarda tudo; antes disso, só os totais por dia
export const inicioJanela = (hoje = hojeLoja()) => { const [y, m] = hoje.split("-").map(Number); return isoDe(new Date(y, m - 2, 1)); };
// o que tem data (e por isso entra na janela); o resto (produtos, lista, ajustes) vem sempre inteiro
const COM_DIA = new Set(["venda", "gasto", "caixa", "mov"]);

// As contas puras (formas de pagamento, categorias, cédulas, caixa do dia, gaveta, resumo, Pix) ficam em loja-contas.js:
// o app de celular importa de lá sem levar a nuvem junto
export {
  PAGAMENTOS, pagDe, CATS_LOJA, catLoja, CEDULAS, CORES_PRODUTO, PRODUTOS_SUGERIDOS, somaV, totaisDia, gaveta, trocoSugerido, maisVendidos,
  totaisPeriodo, porDia, vendasPorHora, resumoDoPeriodo, lojaTravada, avisoEquipeApp, chavePix, pixCopiaECola,
} from "./loja-contas.js";

/* ---------- o "motor" da loja: devolve sempre o mesmo formato, na nuvem ou no aparelho ---------- */
export function useLoja(conta, db, setDb) {
  const nuvem = NUVEM && !!conta.uid;
  const eu = nuvem ? conta.uid : "eu";
  const [st, setSt] = useState(() => nuvem ? (ler(K_CACHE(conta.uid), null) ? "ok" : "carregando") : "local");
  const [dados, setDados] = useState(() => nuvem ? ler(K_CACHE(conta.uid), null) : null); // { loja, membros, itens: { "colecao|id": item }, ate, desde }
  const sbRef = useRef(null), canal = useRef(null), dadosRef = useRef(dados);
  const sb = async () => sbRef.current || (sbRef.current = await cliente());

  // ---------- sem nuvem: tudo dentro do db ----------
  const local = !nuvem ? (db.lojaLocal || null) : null;
  const setLocal = fn => setDb(d => { const n = fn(d.lojaLocal || null); const r = { ...d }; if (n) r.lojaLocal = n; else delete r.lojaLocal; return r; });

  // ---------- nuvem ----------
  // muda os dados sempre a partir do estado mais novo (várias vendas seguidas não se atropelam)
  // (a fonte é o dadosRef, que muda na hora: o estado do React só chega no próximo desenho)
  const tGravar = useRef(0);
  const mudar = fn => {
    const n = fn(dadosRef.current); dadosRef.current = n; setDados(n);
    // a cópia no aparelho espera um pouco: várias vendas seguidas viram uma gravação só
    clearTimeout(tGravar.current); tGravar.current = setTimeout(() => { const x = dadosRef.current; if (x) gravar(K_CACHE(conta.uid), x); else localStorage.removeItem(K_CACHE(conta.uid)); }, 400);
    return n;
  };
  const aplicar = (itens, linhas) => {
    let ate = null;
    linhas.forEach(x => { const k = `${x.colecao}|${x.id}`; if (x.apagado || !x.dados) delete itens[k]; else itens[k] = x.dados; if (!ate || x.atualizado_em > ate) ate = x.atualizado_em; });
    return ate;
  };
  const carregar = async (tudo) => {
    const s = await sb();
    const { data: m, error: e1 } = await s.from("loja_membros").select("loja_id").eq("user_id", conta.uid).maybeSingle();
    if (e1) throw e1;
    if (!m) { mudar(() => null); setSt("sem"); return null; }
    const desde = inicioJanela();
    const cache = dadosRef.current;
    // mesmo loja, mesma janela: só o que mudou desde a última vez
    const incremental = !tudo && cache && cache.loja && cache.loja.id === m.loja_id && cache.desde === desde && cache.ate;
    // a nuvem entrega no máximo 1000 linhas por vez: vem em páginas
    const pagina = i => {
      let q = s.from("loja_itens").select("colecao,id,dia,dados,apagado,atualizado_em").eq("loja_id", m.loja_id).order("atualizado_em").order("colecao").order("id").range(i, i + 999);
      return incremental ? q.gt("atualizado_em", cache.ate) : q.eq("apagado", false).or(`dia.is.null,dia.gte.${desde}`);
    };
    const linhas = async () => {
      const todas = [];
      for (let i = 0; i < 50000; i += 1000) { const r = await pagina(i); if (r.error) throw r.error; todas.push(...r.data); if (r.data.length < 1000) break; }
      return todas;
    };
    const [l, ms, its] = await Promise.all([
      s.from("lojas").select("id,nome,dono,pro_ate").eq("id", m.loja_id).single(),
      s.from("loja_membros").select("user_id,nome,foto,papel,ve_lucro,entrou_em").eq("loja_id", m.loja_id).order("entrou_em"),
      linhas(),
    ]);
    if (l.error || ms.error) throw l.error || ms.error;
    const d = mudar(atual => {
      const itens = incremental && atual ? { ...atual.itens } : {};
      const ate = aplicar(itens, its.filter(x => !x.dia || x.dia >= desde));
      return { loja: l.data, membros: ms.data.map(x => ({ id: x.user_id, nome: x.nome, foto: x.foto, papel: x.papel, veLucro: x.ve_lucro })), itens, desde, ate: ate || (incremental && atual ? atual.ate : null) };
    });
    setSt("ok");
    return d;
  };
  const enviarFila = async () => {
    const fila = ler(K_FILA(conta.uid), []); if (!fila.length) return;
    const s = await sb(), resto = [];
    for (const f of fila) { const { error } = await s.from("loja_itens").upsert(f); if (error) resto.push(f); }
    gravar(K_FILA(conta.uid), resto);
  };
  const lojaId = dados && dados.loja && dados.loja.id;
  useEffect(() => {
    if (!nuvem) return;
    let vivo = true;
    carregar().then(async d => {
      if (!vivo || !d) return;
      enviarFila().catch(() => {});
      const s = await sb();
      canal.current = s.channel(`loja-${d.loja.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "loja_itens", filter: `loja_id=eq.${d.loja.id}` }, p => {
          const x = p.new; if (!x || !x.colecao) return;
          mudar(atual => { if (!atual) return atual; const itens = { ...atual.itens }; const ate = aplicar(itens, [x]); return { ...atual, itens, ate: ate && (!atual.ate || ate > atual.ate) ? ate : atual.ate }; });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "loja_membros", filter: `loja_id=eq.${d.loja.id}` }, () => { carregar().catch(() => {}); })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lojas", filter: `id=eq.${d.loja.id}` }, p => { const x = p.new; if (x) mudar(a => a && ({ ...a, loja: { id: x.id, nome: x.nome, dono: x.dono, pro_ate: x.pro_ate } })); })
        .subscribe();
    }).catch(e => {
      if (!vivo) return;
      // as tabelas da loja ainda não existem na nuvem: o recurso fica escondido até existirem
      const msg = String((e && (e.message || e.code)) || "");
      if (/does not exist|schema cache|PGRST20\d|42P01|404/.test(msg)) { mudar(() => null); setSt("indisponivel"); }
      else setSt(s => (s === "ok" ? "ok" : "erro"));
    });
    const on = () => { enviarFila().catch(() => {}); carregar().catch(() => {}); };
    const vis = () => { if (document.visibilityState === "visible") carregar().catch(() => {}); };
    addEventListener("online", on); document.addEventListener("visibilitychange", vis);
    return () => { vivo = false; removeEventListener("online", on); document.removeEventListener("visibilitychange", vis); if (canal.current && sbRef.current) sbRef.current.removeChannel(canal.current); canal.current = null; };
  }, [conta.uid, lojaId]);

  // A loja guarda uma cópia do meu nome e da minha foto (é o que os outros veem): mudou no Perfil, atualiza
  const eu0 = nuvem ? dados && dados.loja && dados.membros.find(m => m.id === conta.uid) : local && local.membros.find(m => m.id === "eu");
  const meuNome = String(conta.nome || "").slice(0, 60) || (eu0 && eu0.nome) || "", minhaFoto = fotoPequena(conta.foto);
  const desatualizado = !!eu0 && ((eu0.nome || "") !== meuNome || (eu0.foto || null) !== minhaFoto);
  useEffect(() => {
    if (!desatualizado) return;
    const trocar = ms => ms.map(m => m.id === eu0.id ? { ...m, nome: meuNome, foto: minhaFoto } : m);
    if (!nuvem) { setLocal(c => c && ({ ...c, membros: trocar(c.membros) })); return; }
    let vivo = true;
    (async () => {
      const { error } = await (await sb()).from("loja_membros").update({ nome: meuNome, foto: minhaFoto }).eq("loja_id", dados.loja.id).eq("user_id", conta.uid);
      if (!error && vivo) mudar(d => d && ({ ...d, membros: trocar(d.membros) }));
    })().catch(() => {});
    return () => { vivo = false; };
  }, [desatualizado, meuNome, minhaFoto]);

  // ---------- o que as telas usam ----------
  const atual = nuvem ? dados : local && { loja: { id: "local", nome: local.nome, dono: "eu", pro_ate: null }, membros: local.membros, itens: local.itens || {} };
  const todos = Object.entries((atual && atual.itens) || {});
  const lista = col => todos.filter(([k]) => k.startsWith(col + "|")).map(([, v]) => v).filter(Boolean);
  const salvar = async (colecao, item) => {
    const it = { ...item, id: item.id || novoId() };
    if (!nuvem) { setLocal(c => ({ ...c, itens: { ...(c.itens || {}), [`${colecao}|${it.id}`]: it } })); return it; }
    const d = dadosRef.current; if (!d || !d.loja) return it;
    const linha = { loja_id: d.loja.id, colecao, id: it.id, dia: COM_DIA.has(colecao) ? it.dia || null : null, dados: it, apagado: false };
    mudar(a => a && ({ ...a, itens: { ...a.itens, [`${colecao}|${it.id}`]: it } }));
    const { error } = await (await sb()).from("loja_itens").upsert(linha).then(r => r, e => ({ error: e }));
    if (error) gravar(K_FILA(conta.uid), [...ler(K_FILA(conta.uid), []).filter(f => !(f.colecao === colecao && f.id === it.id)), linha]);
    return it;
  };
  const apagar = async (colecao, id) => {
    if (!nuvem) { setLocal(c => { const itens = { ...(c.itens || {}) }; delete itens[`${colecao}|${id}`]; return { ...c, itens }; }); return; }
    const d = dadosRef.current; if (!d || !d.loja) return;
    const velho = d.itens[`${colecao}|${id}`];
    mudar(a => { if (!a) return a; const itens = { ...a.itens }; delete itens[`${colecao}|${id}`]; return { ...a, itens }; });
    const linha = { loja_id: d.loja.id, colecao, id, dia: (velho && COM_DIA.has(colecao) && velho.dia) || null, dados: null, apagado: true };
    const { error } = await (await sb()).from("loja_itens").upsert(linha).then(r => r, e => ({ error: e }));
    if (error) gravar(K_FILA(conta.uid), [...ler(K_FILA(conta.uid), []).filter(f => !(f.colecao === colecao && f.id === id)), linha]);
  };
  const rpc = async (fn, args) => { const { data, error } = await (await sb()).rpc(fn, args); if (error) throw error; return data; };
  const criar = async nome => {
    if (!nuvem) { setLocal(() => ({ nome: nome || "Minha loja", membros: [{ id: "eu", nome: conta.nome, foto: fotoPequena(conta.foto), papel: "dono", veLucro: true }], itens: {} })); return; }
    await rpc("criar_loja", { p_nome: nome || "Minha loja", p_meu_nome: conta.nome, p_foto: fotoPequena(conta.foto) });
    await carregar(true);
  };
  const convidar = async () => {
    if (!nuvem) throw new Error("sem login");
    const { data, error } = await (await sb()).from("loja_convites").insert({ loja_id: dados.loja.id }).select("token").single();
    if (error) throw error;
    return linkDoConviteLoja(data.token);
  };
  const verConvite = async token => { const r = await rpc("ver_convite_loja", { p_token: token }); return (r && r[0]) || null; };
  const entrar = async token => { await rpc("entrar_na_loja", { p_token: token, p_meu_nome: conta.nome, p_foto: fotoPequena(conta.foto) }); await carregar(true); };
  const sair = async () => {
    if (!nuvem) { setLocal(() => null); return; }
    await rpc("sair_da_loja", {}); mudar(() => null); setSt("sem");
  };
  const renomear = async nome => {
    const n = String(nome || "").trim().slice(0, 60); if (!n) return;
    if (!nuvem) { setLocal(c => ({ ...c, nome: n })); return; }
    const { error } = await (await sb()).from("lojas").update({ nome: n }).eq("id", dados.loja.id);
    if (error) throw error;
    mudar(d => d && ({ ...d, loja: { ...d.loja, nome: n } }));
  };
  const tirar = async uid => {
    if (!nuvem) { setLocal(c => ({ ...c, membros: c.membros.filter(m => m.id !== uid) })); return; }
    await rpc("tirar_da_loja", { p_user: uid }); await carregar();
  };
  const deixarVerLucro = async (uid, ve) => {
    if (!nuvem) { setLocal(c => ({ ...c, membros: c.membros.map(m => m.id === uid ? { ...m, veLucro: ve } : m) })); return; }
    await rpc("loja_ve_lucro", { p_user: uid, p_ve: ve });
    mudar(d => d && ({ ...d, membros: d.membros.map(m => m.id === uid ? { ...m, veLucro: ve } : m) }));
  };
  // Quem criou a loja assina o Pro: a loja fica sabendo até quando (assim o celular do ajudante também libera a equipe)
  const marcarPro = async ate => {
    const d = dadosRef.current;
    if (!nuvem || !d || !d.loja || d.loja.dono !== conta.uid || d.loja.pro_ate === ate) return;
    const { error } = await (await sb()).from("lojas").update({ pro_ate: ate }).eq("id", d.loja.id);
    if (!error) mudar(x => x && ({ ...x, loja: { ...x.loja, pro_ate: ate } }));
  };
  // Totais por dia dos meses antigos (que não ficam no aparelho)
  const resumo = async (de, ate) => {
    if (!nuvem || !dados || !dados.loja) return [];
    const r = await rpc("loja_resumo", { p_loja: dados.loja.id, p_de: de, p_ate: ate });
    return (r || []).map(x => ({ dia: String(x.dia).slice(0, 10), colecao: x.colecao, total: Number(x.total) || 0, n: Number(x.n) || 0 }));
  };

  const loja = atual && atual.loja;
  const membros = (atual && atual.membros) || [];
  const euM = membros.find(m => m.id === eu);
  const souDona = !!loja && loja.dono === eu;
  const caixas = lista("caixa");
  return {
    nuvem, eu, estado: nuvem ? st : local ? "ok" : "sem",
    loja, membros, souDona, veLucro: souDona || !!(euM && euM.veLucro),
    desde: (nuvem && dados && dados.desde) || "0000-00-00",
    produtos: lista("produto").sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || (a.criado || 0) - (b.criado || 0)),
    vendas: lista("venda"), gastos: lista("gasto"), faltas: lista("falta"), caixas, movs: lista("mov"),
    config: lista("config").find(x => x.id === "loja") || { id: "loja" },
    // muda a cada item novo, mudado ou apagado (a identidade dos itens): o retrato do app de celular sai de novo
    versao: (atual && atual.itens) || null,
    salvar, apagar, criar, convidar, verConvite, entrar, sair, tirar, renomear, deixarVerLucro, marcarPro, resumo,
    recarregar: () => nuvem && carregar().catch(() => {}),
  };
}
