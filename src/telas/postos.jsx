// "Posto mais barato perto": no Paraná, as notas fiscais de agora (com a distância); fora, a pesquisa da ANP
// na sua cidade. Mostra o mais barato, quanto ele economiza num tanque e se vale ir até lá. A lógica está em src/postos.js.
import React, { useEffect, useRef, useState } from "react";
import { I, Sheet, vibrar, brl, dm, ehIOS, servidorAvisos } from "../App.jsx";
import { obterLocal } from "./precos.jsx";
import { COMBS, combDoVeiculo, postosPR, postosANP, cidadeDoLugar, noParana, resumoPostos, valeIr, linkMapa, haQuanto, localizarCeps, comDistancia } from "../postos.js";

const K_ESCOLHA = "agenda-postos-escolha"; // { comb, raio }
const RAIOS = [2, 5, 10, 20];
const preco = v => `R$ ${v.toFixed(2).replace(".", ",")}`;
const km = d => d == null ? "" : d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace(".", ",")} km`;
const lerEscolha = () => { try { return JSON.parse(localStorage.getItem(K_ESCOLHA) || "{}") || {}; } catch (e) { return {}; } };

// Onde a pessoa está agora (o GPS de até 10 minutos atrás); sem GPS, o último lugar guardado ou a cidade do perfil
async function localAgora() {
  if (navigator.geolocation) {
    try {
      const p = await new Promise((ok, erro) => navigator.geolocation.getCurrentPosition(ok, erro, { timeout: 12000, maximumAge: 10 * 60e3, enableHighAccuracy: false }));
      return { lat: p.coords.latitude, lon: p.coords.longitude, gps: true };
    } catch (e) {}
  }
  return obterLocal(false).catch(() => null);
}

export function PostoBaratoSheet({ veiculo, consumo, sugerido, onClose }) {
  const salvo = lerEscolha();
  const [comb, setComb] = useState(() => sugerido || (veiculo ? combDoVeiculo(veiculo) : salvo.comb) || "gasolina");
  const [raio, setRaio] = useState(salvo.raio || 5);
  const [st, setSt] = useState({ st: "buscando" });
  const [, setTick] = useState(0); // redesenha enquanto os postos da ANP vão sendo localizados
  const rodada = useRef(0);
  const litros = Number(veiculo && veiculo.tanque) > 0 ? Number(veiculo.tanque) : 40;
  const opcoes = COMBS.filter(c => c.id !== "gnv" || (veiculo && veiculo.combustivel === "gnv"));

  const buscar = async () => {
    const minha = ++rodada.current, ainda = () => rodada.current === minha;
    setSt(s => ({ ...s, st: "buscando" }));
    try { localStorage.setItem(K_ESCOLHA, JSON.stringify({ comb, raio })); } catch (e) {}
    const local = await localAgora();
    if (!ainda()) return;
    if (!local) return setSt({ st: "semLocal" });
    try {
      if (noParana(local.lat, local.lon)) {
        const lista = await postosPR(local.lat, local.lon, raio, comb);
        if (ainda()) setSt({ st: "ok", fonte: "nota", lista, gps: local.gps });
      } else {
        const onde = await cidadeDoLugar(local.lat, local.lon);
        if (!onde.cidade) throw new Error("cidade");
        const d = await postosANP(servidorAvisos(), onde.uf, onde.cidade, comb);
        if (!ainda()) return;
        setSt({ st: "ok", fonte: "anp", lista: d.lista, ini: d.ini, fim: d.fim, cidade: onde.cidade, velho: d.velho, local, localizando: true });
        // a ANP só dá o CEP de cada posto: acha o ponto de cada um para saber a distância
        await localizarCeps(d.lista.map(p => p.cep), () => ainda() && setTick(t => t + 1));
        if (ainda()) setSt(s => ({ ...s, localizando: false }));
      }
    } catch (e) { if (ainda()) setSt({ st: "erro" }); }
  };
  useEffect(() => { buscar(); }, [comb, raio]);

  // na ANP, a distância vem do CEP; "Cidade toda" mostra também os que ainda não têm lugar
  const lista = st.fonte === "anp" ? comDistancia(st.lista || [], st.local).filter(p => raio === 20 || (p.dist != null && p.dist <= raio)) : st.lista || [];
  const r = resumoPostos(lista, litros);
  // o mais perto, para comparar com o mais barato (vale atravessar a cidade?)
  const comDist = lista.filter(p => p.dist != null);
  const perto = comDist.length > 1 ? comDist.reduce((m, p) => p.dist < m.dist ? p : m) : null;
  const vale = r && perto && perto !== r.menor && r.menor.dist != null ? valeIr({ ...r.menor, dist: Math.max(0, r.menor.dist - perto.dist) }, perto.preco, litros, consumo || 11) : null;
  const abrir = p => { vibrar("toque"); window.open(linkMapa(p, ehIOS()), "_blank", "noopener"); };
  const sub = st.fonte === "anp" ? `Pesquisa da ANP${st.cidade ? ` em ${st.cidade}` : ""}` : "Notas fiscais de agora (Nota Paraná)";

  return (
    <Sheet title="Posto mais barato" sub={sub} onClose={onClose}>
      <div className="casa-chips" role="radiogroup" aria-label="Combustível">
        {opcoes.map(c => <button key={c.id} type="button" role="radio" aria-checked={comb === c.id} className={comb === c.id ? "on" : ""} onClick={() => { vibrar("toque"); setComb(c.id); }}>{c.nome}</button>)}
      </div>
      <div className="casa-chips" role="radiogroup" aria-label="Distância">
        {RAIOS.map(x => <button key={x} type="button" role="radio" aria-checked={raio === x} className={raio === x ? "on" : ""} onClick={() => { vibrar("toque"); setRaio(x); }}>{x === 20 ? (st.fonte === "anp" ? "Cidade toda" : "20 km") : `${x} km`}</button>)}
      </div>

      {st.st === "buscando" && !lista.length && <div className="postos-vazio"><span className="postos-pulso" aria-hidden="true"><I.target /></span><small>Procurando os postos perto de você…</small></div>}
      {st.st === "semLocal" && <div className="postos-vazio"><small>Não consegui saber onde você está. Libere a localização para o app (ou coloque a sua cidade em Perfil → Dados pessoais).</small><button type="button" className="pill-btn" onClick={buscar}><I.target /> Tentar de novo</button></div>}
      {st.st === "erro" && <div className="postos-vazio"><small>{st.fonte === "anp" || !lista.length ? "Não consegui buscar os preços agora. Confira a internet e tente de novo." : "O site da Nota Paraná não respondeu agora."}</small><button type="button" className="pill-btn" onClick={buscar}><I.repeat /> Tentar de novo</button></div>}
      {st.st === "ok" && !lista.length && st.localizando && <div className="postos-vazio"><span className="postos-pulso" aria-hidden="true"><I.target /></span><small>Vendo onde fica cada posto da cidade…</small></div>}
      {st.st === "ok" && !lista.length && !st.localizando && <div className="postos-vazio"><small>{st.fonte === "anp" ? ((st.lista || []).length ? `Nenhum posto pesquisado pela ANP a até ${raio} km. Tente uma distância maior.` : `A ANP não pesquisou postos com ${COMBS.find(c => c.id === comb).nome.toLowerCase()} em ${st.cidade || "sua cidade"} nesta semana.`) : "Nenhuma nota com esse combustível nos últimos 3 dias. Tente uma distância maior."}</small></div>}

      {r && (
        <div className={"postos-top" + (st.st === "buscando" ? " carregando" : "")}>
          <small className="postos-rot">O mais barato {raio === 20 ? (st.fonte === "anp" ? `de ${st.cidade}` : "da região") : `a até ${raio} km`}</small>
          <div className="postos-top-l">
            <span className="postos-preco">{preco(r.menor.preco)}<small>/{comb === "gnv" ? "m³" : "litro"}</small></span>
            <button type="button" className="btn mode postos-ir" onClick={() => abrir(r.menor)}><I.target /> Ir até lá</button>
          </div>
          <b className="postos-nome">{r.menor.nome}{r.menor.bandeira ? <small> · {r.menor.bandeira}</small> : null}</b>
          <small className="postos-end">{[r.menor.endereco, r.menor.bairro, km(r.menor.dist), r.menor.t ? haQuanto(r.menor.t) : ""].filter(Boolean).join(" · ")}</small>
          {r.economia >= 1 && <p className="postos-eco">{preco(r.tipico - r.menor.preco)} abaixo do preço comum daqui ({preco(r.tipico)}). Enchendo {litros} litros, você economiza <b>{brl(r.economia)}</b>.</p>}
          {vale && <p className="postos-eco">O mais perto ({perto.nome}, {km(perto.dist)}) cobra {preco(perto.preco)}. {vale.vale ? <>Mesmo contando a ida e a volta, sobram <b>{brl(vale.sobra)}</b> num tanque.</> : <>Indo só para abastecer, a ida e a volta comem a economia.</>}</p>}
        </div>
      )}

      {lista.length > 1 && <b className="precos-t">Outros postos</b>}
      <div className="postos-lista">
        {lista.slice(1, 25).map(p => (
          <button key={p.id} type="button" className="posto-linha" onClick={() => abrir(p)}>
            <span className="mid"><b>{p.nome}</b><small>{[p.bairro || p.endereco, km(p.dist), p.t ? haQuanto(p.t) : ""].filter(Boolean).join(" · ")}</small></span>
            <span className="preco"><b>{preco(p.preco)}</b>{r && <small>+{preco(p.preco - r.menor.preco).replace("R$ ", "")}</small>}</span>
          </button>
        ))}
      </div>
      {st.st === "ok" && lista.length > 0 && (
        <small className="precos-nota">
          {st.fonte === "nota"
            ? "Preço das notas fiscais dos últimos 3 dias. Pode ter desconto de app ou de pagamento à vista."
            : `Pesquisa semanal da ANP${st.ini ? `, coletada de ${dm(st.ini)} a ${dm(st.fim)}` : ""}. O preço pode ter mudado desde então, e a distância é pelo CEP.${st.velho ? " Sem internet agora: mostrando a última busca." : ""}`}
        </small>
      )}
    </Sheet>
  );
}
