// Dinheiro a dois (ou em família): uma "casa" com até 5 pessoas que anotam os gastos da casa
// e veem quem pagou o quê e quem deve quanto.
// Com login, fica na nuvem (tabelas casa_* do Supabase, só os membros enxergam). Na demonstração,
// fica uma casa de mentira guardada no próprio aparelho, para dar para experimentar.
import { useEffect, useRef, useState } from "react";
import { NUVEM, cliente, ENDERECO_APP } from "./nuvem.js";

export const MAX_PESSOAS = 5;
export const linkDoConvite = token => `${ENDERECO_APP}#casa=${token}`;
const K_CACHE = uid => `agenda-casa:${uid}`;
const K_FILA = uid => `agenda-casa-fila:${uid}`;
export const K_CONVITE = "agenda-convite-casa";
const ler = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fotoPequena = f => (f && f.length <= 150000 ? f : null);

export { partes, pesosDe, saldos } from "./casa-contas.js";

// O "motor" da casa. Devolve sempre o mesmo formato, na nuvem ou na demonstração.
export function useCasa(conta, db, setDb) {
  const nuvem = NUVEM && !!conta.uid;
  const eu = nuvem ? conta.uid : "eu";
  const [st, setSt] = useState(() => nuvem ? (ler(K_CACHE(conta.uid), null) ? "ok" : "carregando") : "local");
  const [dados, setDados] = useState(() => nuvem ? ler(K_CACHE(conta.uid), null) : null); // { casa, membros, itens: { "colecao|id": item } }
  const sbRef = useRef(null), canal = useRef(null);

  // ---------- demonstração: tudo dentro do db ----------
  const local = !nuvem ? (db.casaLocal || null) : null;
  const setLocal = fn => setDb(d => { const n = fn(d.casaLocal || null); const r = { ...d }; if (n) r.casaLocal = n; else delete r.casaLocal; return r; });

  // ---------- nuvem ----------
  const guardar = d => { setDados(d); if (d) gravar(K_CACHE(conta.uid), d); else localStorage.removeItem(K_CACHE(conta.uid)); };
  const carregar = async () => {
    const sb = sbRef.current || (sbRef.current = await cliente());
    const { data: m, error: e1 } = await sb.from("casa_membros").select("casa_id").eq("user_id", conta.uid).maybeSingle();
    if (e1) throw e1;
    if (!m) { guardar(null); setSt("sem"); return null; }
    const [c, ms, its] = await Promise.all([
      sb.from("casas").select("id,nome,dono").eq("id", m.casa_id).single(),
      sb.from("casa_membros").select("user_id,nome,foto,papel,entrou_em").eq("casa_id", m.casa_id).order("entrou_em"),
      sb.from("casa_itens").select("colecao,id,dados,apagado,por").eq("casa_id", m.casa_id).eq("apagado", false),
    ]);
    if (c.error || ms.error || its.error) throw c.error || ms.error || its.error;
    const d = { casa: c.data, membros: ms.data.map(x => ({ id: x.user_id, nome: x.nome, foto: x.foto, papel: x.papel })), itens: Object.fromEntries(its.data.map(x => [`${x.colecao}|${x.id}`, x.dados])) };
    guardar(d); setSt("ok");
    return d;
  };
  const enviarFila = async () => {
    const fila = ler(K_FILA(conta.uid), []); if (!fila.length || !sbRef.current) return;
    const resto = [];
    for (const f of fila) { const { error } = await sbRef.current.from("casa_itens").upsert(f); if (error) resto.push(f); }
    gravar(K_FILA(conta.uid), resto);
  };
  useEffect(() => {
    if (!nuvem) return;
    let vivo = true;
    carregar().then(d => {
      if (!vivo || !d) return;
      enviarFila();
      canal.current = sbRef.current.channel(`casa-${d.casa.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "casa_itens", filter: `casa_id=eq.${d.casa.id}` }, p => {
          const x = p.new; if (!x || !x.colecao) return;
          setDados(atual => { if (!atual) return atual; const itens = { ...atual.itens }; const k = `${x.colecao}|${x.id}`; if (x.apagado) delete itens[k]; else itens[k] = x.dados; const n = { ...atual, itens }; gravar(K_CACHE(conta.uid), n); return n; });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "casa_membros", filter: `casa_id=eq.${d.casa.id}` }, () => { carregar().catch(() => {}); })
        .subscribe();
    }).catch(e => {
      if (!vivo) return;
      // as tabelas da casa ainda não existem na nuvem: o recurso fica escondido até existirem
      const msg = String((e && (e.message || e.code)) || "");
      if (/does not exist|schema cache|PGRST20\d|42P01|404/.test(msg)) { guardar(null); setSt("indisponivel"); }
      else setSt(s => (s === "ok" ? "ok" : "erro"));
    });
    const on = () => { enviarFila(); carregar().catch(() => {}); };
    addEventListener("online", on);
    return () => { vivo = false; removeEventListener("online", on); if (canal.current && sbRef.current) sbRef.current.removeChannel(canal.current); };
  }, [conta.uid, dados && dados.casa && dados.casa.id]);

  // A casa guarda uma cópia do meu nome e da minha foto (é o que os outros veem). Quando mudo no Perfil,
  // atualizo a cópia; os outros recebem na hora (a mudança em casa_membros chega pelo tempo real).
  const eu0 = nuvem ? dados && dados.casa && dados.membros.find(m => m.id === conta.uid) : local && local.membros.find(m => m.id === "eu");
  const meuNome = String(conta.nome || "").slice(0, 60) || (eu0 && eu0.nome) || "", minhaFoto = fotoPequena(conta.foto);
  const desatualizado = !!eu0 && ((eu0.nome || "") !== meuNome || (eu0.foto || null) !== minhaFoto);
  useEffect(() => {
    if (!desatualizado) return;
    const trocar = ms => ms.map(m => m.id === eu0.id ? { ...m, nome: meuNome, foto: minhaFoto } : m);
    if (!nuvem) { setLocal(c => c && ({ ...c, membros: trocar(c.membros) })); return; }
    let vivo = true;
    (async () => {
      const sb = sbRef.current || (sbRef.current = await cliente());
      const { error } = await sb.from("casa_membros").update({ nome: meuNome, foto: minhaFoto }).eq("casa_id", dados.casa.id).eq("user_id", conta.uid);
      if (!error && vivo) setDados(d => { if (!d) return d; const n = { ...d, membros: trocar(d.membros) }; gravar(K_CACHE(conta.uid), n); return n; });
    })().catch(() => {}); // sem internet: tenta de novo na próxima vez que a casa carregar
    return () => { vivo = false; };
  }, [desatualizado, meuNome, minhaFoto]);

  // ---------- o que as telas usam ----------
  const atual = nuvem ? dados : local && { casa: { id: "local", nome: local.nome, dono: "eu" }, membros: local.membros, itens: local.itens || {} };
  const lista = col => Object.entries((atual && atual.itens) || {}).filter(([k]) => k.startsWith(col + "|")).map(([, v]) => v).filter(Boolean);
  const salvar = async (colecao, item) => {
    const it = { ...item, id: item.id || novoId() };
    if (!nuvem) { setLocal(c => ({ ...c, itens: { ...(c.itens || {}), [`${colecao}|${it.id}`]: it } })); return it; }
    const linha = { casa_id: dados.casa.id, colecao, id: it.id, dados: it, apagado: false };
    guardar({ ...dados, itens: { ...dados.itens, [`${colecao}|${it.id}`]: it } });
    const { error } = await (sbRef.current || (sbRef.current = await cliente())).from("casa_itens").upsert(linha).then(r => r, e => ({ error: e }));
    if (error) gravar(K_FILA(conta.uid), [...ler(K_FILA(conta.uid), []).filter(f => !(f.colecao === colecao && f.id === it.id)), linha]);
    return it;
  };
  const apagar = async (colecao, id) => {
    if (!nuvem) { setLocal(c => { const itens = { ...(c.itens || {}) }; delete itens[`${colecao}|${id}`]; return { ...c, itens }; }); return; }
    const itens = { ...dados.itens }; delete itens[`${colecao}|${id}`]; guardar({ ...dados, itens });
    const linha = { casa_id: dados.casa.id, colecao, id, dados: null, apagado: true };
    const { error } = await sbRef.current.from("casa_itens").upsert(linha).then(r => r, e => ({ error: e }));
    if (error) gravar(K_FILA(conta.uid), [...ler(K_FILA(conta.uid), []), linha]);
  };
  const rpc = async (fn, args) => { const sb = sbRef.current || (sbRef.current = await cliente()); const { data, error } = await sb.rpc(fn, args); if (error) throw error; return data; };
  const criar = async nome => {
    if (!nuvem) { setLocal(() => ({ nome: nome || "Nossa casa", membros: [{ id: "eu", nome: conta.nome, foto: fotoPequena(conta.foto), papel: "dono" }], itens: {} })); return; }
    await rpc("criar_casa", { p_nome: nome || "Nossa casa", p_meu_nome: conta.nome, p_foto: fotoPequena(conta.foto) });
    await carregar();
  };
  const convidar = async () => {
    if (!nuvem) return linkDoConvite("demonstracao");
    const sb = sbRef.current || (sbRef.current = await cliente());
    const { data, error } = await sb.from("casa_convites").insert({ casa_id: dados.casa.id }).select("token").single();
    if (error) throw error;
    return linkDoConvite(data.token);
  };
  const verConvite = async token => { const r = await rpc("ver_convite", { p_token: token }); return (r && r[0]) || null; };
  const entrar = async token => { await rpc("entrar_na_casa", { p_token: token, p_meu_nome: conta.nome, p_foto: fotoPequena(conta.foto) }); await carregar(); };
  const sair = async () => {
    if (!nuvem) { setLocal(() => null); return; }
    await rpc("sair_da_casa", {}); guardar(null); setSt("sem");
  };
  // só quem criou a casa muda o nome (a regra da nuvem confere)
  const renomear = async nome => {
    const n = String(nome || "").trim().slice(0, 60); if (!n) return;
    if (!nuvem) { setLocal(c => ({ ...c, nome: n })); return; }
    const sb = sbRef.current || (sbRef.current = await cliente());
    const { error } = await sb.from("casas").update({ nome: n }).eq("id", dados.casa.id);
    if (error) throw error;
    guardar({ ...dados, casa: { ...dados.casa, nome: n } });
  };
  const tirar = async uid => {
    if (!nuvem) { setLocal(c => ({ ...c, membros: c.membros.filter(m => m.id !== uid) })); return; }
    await rpc("tirar_da_casa", { p_user: uid }); await carregar();
  };
  // só na demonstração: alguém "aceita" o convite, para ver a casa com duas pessoas
  const simularEntrada = () => setLocal(c => c.membros.length >= MAX_PESSOAS ? c : ({ ...c, membros: [...c.membros, { id: "rafa" + c.membros.length, nome: ["Rafa", "Mãe", "Lu", "Beto"][c.membros.length - 1] || "Convidado", foto: null, papel: "membro" }] }));

  return {
    nuvem, eu, estado: nuvem ? st : local ? "ok" : "sem",
    casa: atual && atual.casa, membros: (atual && atual.membros) || [],
    lanc: lista("lanc"), acertos: lista("acerto"), contas: lista("conta"), compras: lista("compra"),
    config: lista("config").find(x => x.id === "divisao") || { id: "divisao", modo: "igual" },
    // lista de compras: o limite de gasto (config "lista") e as listas prontas ("compra do mês", "churrasco")
    listaCfg: lista("config").find(x => x.id === "lista") || { id: "lista" }, modelos: lista("modelo"),
    salvar, apagar, criar, convidar, verConvite, entrar, sair, tirar, renomear, simularEntrada, recarregar: () => nuvem && carregar().catch(() => {}),
  };
}
