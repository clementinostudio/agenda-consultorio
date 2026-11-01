// O motor do app: o Avina do site (WebView, components/camada-web.tsx) é quem guarda os dados, faz o login e
// sincroniza com a nuvem. As telas nativas leem um retrato dos dados e pedem as ações ao site.
// - O site manda o retrato sempre que algo muda (ação "estado" da ponte, ../src/app-nativo.js). Fica guardado no
//   aparelho: na próxima abertura, as telas nativas aparecem na hora, antes do site terminar de carregar.
// - pedirSite(acao, dados) pede algo ao site (salvar um gasto, perguntar à Bolinha, abrir uma tela) e devolve
//   uma Promise. Se o site ainda está abrindo, o pedido espera na fila.
// - A camada do site fica atrás das telas nativas; mostrarWeb() traz o site para a frente (consultório, loja,
//   ajustes, login) e esconderWeb() volta para as telas nativas.
import { useSyncExternalStore } from 'react';

/* ---------- O retrato que o site manda ---------- */

export type TemaEscolhido = 'auto' | 'dark' | 'light';
export type Modo = 'consultorio' | 'pessoal' | 'loja';

// Os campos marcados "novo" vieram com as telas nativas de Contas fixas, Transporte e Nossa casa. Todos são opcionais:
// um retrato antigo (guardado no aparelho, ou de uma cópia do site de antes) continua valendo.

/* Transporte (as tabelas fixas, como SUBS e MANUTENCOES, vêm de @site/transporte.js, não do retrato) */
export type SubTransp = 'combustivel' | 'app' | 'publico' | 'manutencao' | 'melhorias' | 'estacionamento' | 'documentos' | 'outros'; // SUBS
export type IdManut = 'revisao' | 'oleo' | 'pneus' | 'freios' | 'bateria' | 'conserto' | 'funilaria' | 'lavagem' | 'pecas' | 'acessorios' | 'alinhamento'; // MANUTENCOES
export type CombAbast = 'gasolina' | 'etanol' | 'diesel' | 'gnv'; // o combustível de um abastecimento
export type LancTransp = {
  sub: SubTransp; // l.sub, ou adivinhado pela descrição (subDe)
  veiculoId: string | null; // de qual veículo (donoDoGasto, já resolvido pelo site); null sem veículo
  litros?: number; precoLitro?: number; combustivel?: CombAbast; km?: number; manut?: IdManut;
};

export type Lanc = {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number; // em reais, sempre positivo
  data: string; // AAAA-MM-DD
  cat: string; // id da categoria (Estado.categorias / Estado.catEntrada)
  desc: string;
  marca: string | null; // id em ../src/marcas.js (marcaPorId), quando reconhecida
  site?: string | null; // domínio da logo, já resolvido pelo site
  banco?: string | null; // nome do banco, quando veio do Open Finance
  moeda?: string | null; // compra em outra moeda (o valor já está em reais)
  valorOrig?: number | null;
  obs?: string | null;
  transp?: LancTransp; // novo: só nos gastos com cat 'transporte'
  casaId?: string | null; // novo: o gasto também está na casa (Nossa casa)
};

export type Categoria = { id: string; nome: string; cor: string; ink: string; ic: string };

// A situação da conta no mês de agora (situacaoConta do site): ≤ 5 dias para vencer é 'breve'
export type SituacaoConta = 'paga' | 'atrasada' | 'hoje' | 'breve' | 'ok';

export type ContaFixa = {
  id: string;
  nome: string;
  valor: number; // em reais (numa conta em outra moeda, já convertido, com IOF)
  dia: number; // dia do vencimento
  cat: string | null;
  paga: boolean; // paga no mês de agora
  vence: string; // AAAA-MM-DD do vencimento neste mês
  assinatura: boolean;
  marca: string | null;
  site?: string | null;
  // novos
  st?: SituacaoConta;
  dias?: number; // dias de hoje até o vencimento (< 0: atrasada há N dias; 0: vence hoje)
  pagaEm?: string | null; // AAAA-MM-DD do pagamento deste mês
  pagas?: Record<string, string>; // os pagamentos dos últimos 12 meses: 'AAAA-MM' → 'AAAA-MM-DD'
  codigo?: string | null; // a linha digitável do boleto lido
  moeda?: string | null; // cobrada em outra moeda ('USD'...); o valor muda com a cotação
  valorOrig?: number | null; // o valor na moeda de lá
  iof?: boolean; // soma o IOF do cartão
  transp?: { sub: SubTransp; veiculoId: string | null } | null; // só nas contas de transporte
};

export type Caixinha = { id: string; nome: string; emoji: string; guardado: number; meta: number | null; doBanco: boolean };

export type ItemAgenda = { hora: string; nome: string; status: 'proxima' | 'feita' | 'faltou' | 'cancelada' | 'outra'; valor: number | null };

/* ---------- Transporte (novo) ---------- */

export type Combustivel = 'flex' | 'gasolina' | 'etanol' | 'diesel' | 'gnv' | 'eletrico'; // COMBUSTIVEIS
export type MesTransp = { chave: string; total: number; porSub: Partial<Record<SubTransp, { total: number; n: number }>> };
// A próxima troca de óleo ou o próximo rodízio dos pneus (pelo km ou pela data, o que vier antes)
export type LembreteVeiculo = {
  ate: string; proxKm: number | null; faltamKm: number | null; faltamDias: number; urgente: boolean;
  ultima: { data: string; km: number | null };
};
export type DocVeiculo = { k: 'ipva' | 'licenc' | 'seguro'; nome: string; data: string; valor: number; dias: number };

export type Veiculo = {
  id: string;
  nome: string; // o nome dado, o modelo da FIPE, "Seu veículo" ou "Apps e transporte público"
  tipo: 'carro' | 'moto' | 'bike' | 'nenhum';
  combustivel: Combustivel | null;
  desenho: string | null; // o desenho do veículo: public/ilustras/<desenho>.webp no site ('carro-hatch', 'moto'...); null = bike
  fotoK: string | null; // a foto própria: muda quando a foto muda (a imagem vem por pedirSite('foto'))
  km: number | null;
  consumo: number | null; consumoReal: boolean; precoPago: number | null; custoKm: number | null;
  ultimoAbast: { data: string; litros: number; precoLitro: number | null; combustivel: CombAbast | null; km: number | null; desc: string } | null;
  fipe: { valor: string; mes: string | null; modelo: string } | null; // o valor vem como texto: "R$ 52.300,00"
  oleo: LembreteVeiculo | null;
  rodizio: LembreteVeiculo | null;
  oleoKm: number; oleoMeses: number;
  docs: DocVeiculo[];
  custo: { // quanto o veículo custa de verdade (só carro e moto)
    total: number; porMes: number; porDia: number; nMeses: number; porKm: number | null; rodados: number;
    porSub: Partial<Record<SubTransp, number>>; perdeu: { valor: number; desde: string } | null;
  } | null;
  appRef: { valor: number; km: number } | null; // a corrida de referência do "Carro ou app?"
  postos: { nome: string; n: number; gasto: number; litros: number; preco: number | null; ultimo: string }[];
  meses?: MesTransp[]; // só com 2 ou mais veículos: os últimos 12 meses deste veículo
};

// Os preços da semana (ANP): da cidade, senão do estado, senão do Brasil
export type PrecosANP = {
  p: Partial<Record<'gasolina' | 'aditivada' | 'etanol' | 'diesel' | 'gnv', number>>;
  onde: 'cidade' | 'estado' | 'brasil'; nome: string | null;
  ini: string | null; fim: string | null; em: number; velho?: boolean;
};

export type Transporte = {
  veiculos: Veiculo[]; // na ordem do site
  meses: MesTransp[]; // os últimos 12 meses, do mais antigo ao mais novo (já com as contas fixas pagas de transporte)
  precos: PrecosANP | null; // null = ainda não buscou
  cidade: string | null; // a cidade do perfil (sem ela, não há preço da cidade)
};

/* ---------- Nossa casa (novo) ---------- */

export type EstadoCasa = 'carregando' | 'ok' | 'sem' | 'erro' | 'indisponivel';
export type MembroCasa = {
  id: string; nome: string; papel: 'dono' | 'membro';
  foto: string | null; // só o avatar pronto (SVG pequeno)
  fotoK: string | null; // a foto de verdade: chave da versão (a imagem vem por pedirSite('foto'))
};
export type GastoCasa = {
  id: string; valor: number; desc: string; cat: string; data: string; criado: number | null;
  pagou: string; autor: string | null;
  participantes: string[]; // quem divide (todos, quando o gasto não diz)
  partes: Record<string, number>; // quanto cabe a cada um, em reais (já com os pesos)
  proporcional: boolean;
  contaId: string | null; // veio do "Paguei" de uma conta da casa
  origem: string | null; // id do lançamento pessoal de onde veio
  nota: { loja: string; itens: number; fonte: string | null; temFoto: boolean; temLink: boolean } | null; // os itens vêm por casaNota
};
export type AcertoCasa = { id: string; de: string; para: string; valor: number; data: string; criado: number | null };
export type ContaCasa = {
  id: string; nome: string; valor: number; dia: number; cat: string;
  paga: { por: string; data: string; gastoId: string } | null; // no mês de agora
};
export type ItemCompra = {
  id: string; texto: string; qtd: number; obs: string | null;
  secao: string; // o corredor do mercado (nota.js: secaoDe / nomeSecao)
  feito: boolean; por: string | null; autor: string | null; criado: number | null;
  preco: { unit: number; total: number; loja: string; data: string } | null; // o último preço pago (só nos que faltam)
};
export type DadosCasa = {
  id: string; nome: string; dono: string; eu: string; souDono: boolean; max: number;
  membros: MembroCasa[];
  divisao: { modo: 'igual' | 'proporcional'; pcts: Record<string, number> | null };
  saldo: Record<string, number>; // de todo o histórico
  dividas: { de: string; para: string; valor: number }[];
  gastos: GastoCasa[]; // o mês de agora e os 2 anteriores, do mais novo ao mais velho
  meses: { chave: string; total: number }[]; // 6 meses
  acertos: AcertoCasa[]; // os 10 mais recentes
  contas: ContaCasa[]; // por dia
  compras: ItemCompra[];
  listaLimite: number | null;
  modelos: { id: string; nome: string; itens: { texto: string; qtd: number; obs?: string }[] }[]; // as listas prontas
  mercado: {
    mes: number; notas: number;
    mudou: { nome: string; de: { unit: number; loja: string; data: string }; para: { unit: number; loja: string; data: string }; pct: number }[];
  } | null;
  pix: string | null; // a chave Pix (vai na mensagem de "Lembrar no WhatsApp")
};
export type CasaRetrato = { estado: EstadoCasa; nuvem: boolean; casa: DadosCasa | null }; // nuvem false = a casa de demonstração

/* ---------- Loja (novo: telas nativas da Loja; o lado do site é ../src/app-nativo-trabalho.js, retratoLoja) ----------
   As tabelas fixas (formas de pagamento, categorias de gasto, cédulas) vêm de @site/loja-contas.js, não do retrato. */
export type PagLoja = 'dinheiro' | 'pix' | 'debito' | 'credito'; // PAGAMENTOS
export type EstadoLoja = 'carregando' | 'ok' | 'sem' | 'erro' | 'indisponivel';
// O resumo de um período (resumoDoPeriodo): totais, o que mais vendeu (até 6) e os dias (até 31)
export type ResumoLoja = {
  de: string; ate: string;
  entrou: number; saiu: number; sobrou: number; vendas: number; ticket: number;
  porCat: Record<string, number>; // ids de CATS_LOJA
  top: { nome: string; q: number; total: number }[];
  dias: { dia: string; entrou: number; saiu: number }[];
};
export type MembroLoja = {
  id: string; nome: string; papel: 'dono' | 'ajudante'; veLucro: boolean;
  foto: string | null; // só o avatar pronto (SVG pequeno)
  fotoK: string | null; // a foto de verdade: chave da versão (a imagem vem por pedirSite('lojaFoto'))
};
export type ProdutoLoja = { id: string; nome: string; preco: number; cor: string; tinta: string }; // os ativos, na ordem do caixa
export type VendaLoja = {
  id: string; hora: string; total: number; pag: PagLoja; desc: string | null;
  resumo: string; // "2× Brigadeiro, Coxinha" (ou a descrição, ou "Venda")
  autor: string | null; comItens: boolean;
};
export type MovLoja = { id: string; tipo: 'retirada' | 'reforco'; valor: number; desc: string | null; hora: string; pessoal: boolean };
export type GastoLoja = { id: string; valor: number; desc: string; cat: string; dia: string; daGaveta: boolean; autor: string | null; nota: boolean };
export type FaltaLoja = { id: string; texto: string; qtd: number; feito: boolean; autor: string | null; criado: number | null };
// O que deveria estar na gaveta hoje (gaveta): troco do começo + vendas em dinheiro + posto − gastos da gaveta − tirado
export type GavetaLoja = {
  troco: number; vendas: number; gastos: number; reforcos: number; retiradas: number; esperado: number;
  fechado: { contado: number; dif: number; deixou: number | null; hora: string; por: string | null } | null;
};
export type DadosLoja = {
  id: string; nome: string;
  eu: string; souDona: boolean; veLucro: boolean;
  podeAnotar: boolean; // false: equipe travada (só quem cuida da loja anota)
  aviso: string | null; // o texto neutro da equipe, quando há
  historicoDias: number | null; // 30 quando a versão grátis limita o histórico do resumo; null sem limite
  temPix: boolean; // a loja tem chave Pix (o QR com valor sai no pedido lojaPix)
  membros: MembroLoja[];
  produtos: ProdutoLoja[];
  hoje: {
    dia: string; vendas: number; entrou: number; ticket: number;
    porPag: Record<PagLoja, number>;
    porHora: { h: number; total: number; n: number }[]; // da primeira à última hora com venda, sem buracos
    saiu: number | null; sobrou: number | null; // null para quem não vê o lucro
  };
  gaveta: GavetaLoja;
  vendasHoje: VendaLoja[]; // as 50 mais novas
  movsHoje: MovLoja[]; // na ordem em que aconteceram
  gastosDe: string; // os gastos vêm desde este dia ('AAAA-MM-01': o mês de agora, ou também o anterior)
  gastos: GastoLoja[]; // do mais novo ao mais velho
  faltas: FaltaLoja[]; // a lista do que falta (e o que já foi comprado, feito: true)
  sempreFalta: string[]; // o que sempre falta e não está na lista agora (até 8)
  resumo: { hoje: ResumoLoja; sete: ResumoLoja; mes: ResumoLoja } | null; // null para quem não vê o lucro
};
export type LojaRetrato = { estado: EstadoLoja; nuvem: boolean; loja: DadosLoja | null };

// O que este site já atende das telas nativas novas (Estado.recursos). Sem o recurso (uma cópia antiga do site),
// o app abre a área no site, como antes.
export type Recurso = 'contas2' | 'transporte' | 'casa' | 'loja2';

export type Estado = {
  v: 1;
  em: number; // quando o site montou este retrato (ms)
  logado: boolean;
  tema: TemaEscolhido;
  conta: { nome: string; email: string; foto: string | null; uid: string | null } | null;
  modos: Modo[];
  modo: Modo | null; // a área aberta no site agora
  termo: string; // "Paciente", "Analisando"...
  plano: { pro: boolean; estado: string | null; ate: string | null } | null; // null = sem limite (cobrança desligada)
  servidor: string;
  bancoLigado: boolean; // Open Finance liberado para esta conta (hoje: só admin)
  categorias: Categoria[];
  catEntrada: Categoria[];
  pessoal: {
    lanc: Lanc[]; // últimos 400 dias
    contas: ContaFixa[];
    caixinhas: Caixinha[];
    limites: Record<string, number>; // teto do mês por categoria
    renda: number | null; // renda do mês, quando anotada
  } | null;
  consultorio: {
    hoje: ItemAgenda[];
    recebidoMes: number;
    aReceber: number;
    sessoesMes: number;
    faltasMes: number;
    pacientesAtivos: number;
  } | null;
  transporte?: Transporte | null; // novo; null = Pessoal desligado
  casa?: CasaRetrato | null; // novo; null = Pessoal desligado
  loja?: LojaRetrato | null; // novo; null = área Loja desligada (sem o campo: um site sem as telas nativas da Loja)
  recursos?: string[]; // novo: as telas nativas que este site atende (Recurso); sem a lista, nenhuma
};

/* ---------- Respostas do site para pedidos conhecidos ---------- */

export type ContaBanco = {
  id: string; itemId: string; banco: string; nome: string; final: string; tipo: 'conta' | 'cartao'; saldo: number;
  limite?: number | null; livre?: number | null; vence?: string | null; fecha?: string | null; minimo?: number | null;
  especial?: number | null; especialUsado?: number | null;
};
export type Investimento = { id: string; itemId: string; banco: string; nome: string; tipo: string; subtipo: string | null; saldo: number; aplicado: number | null; rendeu: number | null; vence: string | null };
export type BancoConectado = { id: string; nome: string; status: string; atualizado: string | null; logo?: string | null };
export type ResumoBanco = { ligado: boolean; bancos?: BancoConectado[]; contas?: ContaBanco[]; investimentos?: Investimento[]; em?: string; erro?: string };

export type RespostaBolinha =
  | { tipo: 'resposta'; texto: string }
  | { tipo: 'gastos'; texto: string; itens: Omit<Lanc, 'id'>[] } // proposta: o app mostra e a pessoa confirma
  | { tipo: 'erro'; texto: string };

// Um pedido que não deu certo: erro é o código ('limite', 'moeda', 'sem-casa'...) e texto, a frase pronta para
// mostrar (neutra: nada de preço nem de assinar)
export type Falha = { ok: false; erro: string; texto: string };

// Ações que o site atende (src/app-nativo.js + src/App.jsx). Os nomes e formatos são o contrato da ponte.
// Regras dos pedidos novos: o que cria algo aceita o id mandado pelo app (repetir não duplica); o que liga ou desliga
// recebe o valor final (feito: true), não "inverter". O site não vibra nem avisa: quem vibra e mostra o
// "Desfazer" é a tela nativa.
export type PedidosSite = {
  estado: { dados: null; volta: Estado };
  abrir: { dados: { area?: Modo | 'casa' | 'transporte'; tela?: string; acao?: string; id?: string }; volta: null };
  lancar: { dados: { itens: (Omit<Lanc, 'id'> & { id?: string })[] }; volta: { ok: true; ids: string[] } | Falha };

  // Contas fixas (recurso 'contas2'). mes: 'AAAA-MM' (padrão: o de agora); data: 'AAAA-MM-DD' (padrão: hoje)
  contaPagar: { dados: { id: string; mes?: string; data?: string }; volta: { ok: true; mes: string; data: string } | Falha };
  contaDesfazer: { dados: { id: string; mes?: string }; volta: { ok: boolean } };
  // sem id: conta nova. Numa conta em outra moeda, mudar o valor responde erro 'moeda' (o app abre a edição no site)
  contaSalvar: { dados: { id?: string; nome: string; valor: number; dia: number; cat?: string | null; assinatura?: boolean; marca?: string | null }; volta: { ok: true; id: string } | Falha };
  contaApagar: { dados: { id: string }; volta: { ok: boolean } };

  // Transporte (recurso 'transporte'). Gasto novo passa pelo limite do plano grátis (erro 'limite')
  transporteGasto: {
    dados: { id?: string; veiculoId?: string | null; sub: SubTransp; valor: number; data?: string; desc?: string; litros?: number; precoLitro?: number; combustivel?: CombAbast; km?: number; manut?: IdManut };
    volta: { ok: true; id: string } | Falha;
  };
  // o "Paguei" do IPVA, licenciamento ou seguro: anota o gasto e passa a data para o ano seguinte. lancId (do app): o
  // pedido repetido não paga duas vezes. Sem valor no documento nem no pedido: erro 'valor'
  veiculoDocPagar: { dados: { veiculoId: string; k: 'ipva' | 'licenc' | 'seguro'; valor?: number; lancId?: string }; volta: { ok: true; lancId: string; proxima: string | null } | Falha };
  // só km, consumo e o "Carro ou app?" mudam por aqui (o resto do veículo é no site: abrir { acao: 'veiculo' })
  veiculoAtualizar: { dados: { id: string; km?: number | null; consumo?: number | null; appRef?: { valor: number; km: number } | null }; volta: { ok: boolean } };
  veiculoFoto: { dados: { id: string }; volta: string | null }; // a foto própria do veículo (data URL)
  transportePrecos: { dados: { forcar?: boolean }; volta: PrecosANP | { erro: 'sem-cidade' | 'sem-servidor' | 'sem-internet' } };

  // Nossa casa (recurso 'casa'). Sem casa, todos respondem erro 'sem-casa'
  casaGasto: { dados: { id?: string; valor: number; desc?: string; cat?: string; data?: string; pagou?: string; participantes?: string[] }; volta: { ok: true; id: string } | Falha };
  casaGastoApagar: { dados: { id: string }; volta: { ok: boolean } };
  casaAcertar: { dados: { id?: string; de: string; para: string; valor: number }; volta: { ok: true; id: string } | Falha };
  casaAcertoApagar: { dados: { id: string }; volta: { ok: boolean } };
  casaContaPagar: { dados: { id: string; gastoId?: string }; volta: { ok: true; gastoId: string } | Falha };
  casaConta: { dados: { id?: string; nome: string; valor: number; dia: number; cat?: string }; volta: { ok: true; id: string } | Falha };
  casaContaApagar: { dados: { id: string }; volta: { ok: boolean } };
  // texto: "2 leite, pão; café"; itens: uma lista pronta (somar: false)
  casaListaAdicionar: { dados: { texto?: string; itens?: { texto: string; qtd?: number; obs?: string }[]; somar?: boolean }; volta: { novos: number; ja: { id: string; texto: string; qtd: number }[] } };
  casaLista: { dados: { id: string; feito?: boolean; texto?: string; qtd?: number; obs?: string | null }; volta: { ok: boolean } };
  casaListaTirar: { dados: { ids: string[] }; volta: { ok: boolean; itens: unknown[] } }; // itens: como estavam, para o Desfazer
  casaListaRestaurar: { dados: { itens: unknown[] }; volta: { ok: boolean } };
  casaListaLimite: { dados: { limite: number | null }; volta: { ok: boolean } };
  casaAvisarMercado: { dados: null; volta: { ok: true; enviados: number; recente: boolean } | Falha };
  casaTrazer: { dados: { ids: string[]; dividir: boolean }; volta: { ok: true; n: number } | Falha };
  casaNota: {
    dados: { id: string };
    volta: { loja: string; data: string; total: number; fonte: string | null; url: string | null; temFoto: boolean; itens: { nome: string; qtd: number; un: string | null; unit: number; valor: number }[] } | null;
  };

  // A foto de um veículo ou de alguém da casa (data URL), fora do retrato; o app guarda por id + fotoK
  foto: { dados: { de: 'veiculo' | 'membro'; id: string }; volta: string | null };

  // Loja (recurso 'loja2'; src/app-nativo-trabalho.js). Sem a loja: erro 'sem-loja'; abrindo: 'carregando'; equipe
  // travada (só nos que anotam): 'travado', com o texto neutro do site. Os ids vêm do app: repetir não duplica.
  // A venda do caixa: com itens, o nome e o preço vêm dos produtos do site; sem itens, o valor. Repetir devolve a mesma
  lojaVenda: { dados: { id: string; itens?: { p: string; q: number }[]; valor?: number; pag: PagLoja; desc?: string }; volta: { ok: true; id: string; total: number } | Falha };
  // os apagar devolvem o item como estava (o Desfazer manda de volta por lojaRestaurar)
  lojaVendaApagar: { dados: { id: string }; volta: { ok: boolean; item: unknown; erro?: string; texto?: string } };
  // o Pix copia e cola com o valor e o QR em SVG (null se o gerador do site ainda não baixou). Não grava: em
  // "O Pix caiu", o app chama lojaVenda { pag: 'pix' }. Sem chave: erro 'sem-pix'
  lojaPix: { dados: { valor: number }; volta: { codigo: string; svg: string | null; nome: string } | Falha };
  lojaGasto: { dados: { id: string; valor: number; desc?: string; cat?: string; dia?: string; daGaveta?: boolean }; volta: { ok: true; id: string } | Falha };
  lojaGastoApagar: { dados: { id: string }; volta: { ok: boolean; item: unknown; erro?: string; texto?: string } };
  // tirar ou pôr dinheiro na gaveta; pessoal: a dona (com o Pessoal ligado) leva a retirada para o Pessoal
  lojaMov: { dados: { id: string; tipo: 'retirada' | 'reforco'; valor: number; desc?: string; pessoal?: boolean }; volta: { ok: true; id: string; pessoal: boolean } | Falha };
  lojaMovApagar: { dados: { id: string; comPessoal?: boolean }; volta: { ok: boolean; item: unknown; erro?: string; texto?: string } };
  // fecha o caixa do dia (padrão hoje); o site refaz a conta do que deveria ter. Fechar de novo regrava
  lojaFechar: { dados: { dia?: string; troco?: number; contado: number; deixou?: number }; volta: { ok: true; esperado: number; dif: number; deixou: number } | Falha };
  // "2 leite condensado" vira 2× leite condensado; id que já está na lista não entra de novo
  lojaFaltaAdicionar: { dados: { itens: { id: string; texto: string }[] }; volta: { ok: true; novos: number } | Falha };
  lojaFalta: { dados: { id: string; feito: boolean }; volta: { ok: boolean } };
  lojaFaltaTirar: { dados: { ids: string[] }; volta: { ok: boolean; itens: unknown[] } };
  lojaRestaurar: { dados: { colecao: 'venda' | 'gasto' | 'falta' | 'mov'; itens: unknown[] }; volta: { ok: boolean } | Falha };
  // os marcados da lista viram um gasto (com o preço de cada um, se veio), entram no "sempre falta" e saem da lista
  lojaComprei: { dados: { id: string; total?: number; precos?: Record<string, number>; cat: string; daGaveta: boolean }; volta: { ok: true; id: string; valor: number } | Falha };
  // um mês fora do retrato. Erros: sem-lucro, historico (o texto neutro da versão grátis), sem-internet, mes
  lojaResumo: { dados: { mes: string }; volta: ResumoLoja | Falha };
  lojaFoto: { dados: { id: string }; volta: string | null }; // a foto de quem está na loja (data URL)

  apagarLanc: { dados: { id: string }; volta: { ok: boolean } };
  bolinha: { dados: { texto: string; historico: { quem: 'eu' | 'ela'; texto: string }[] }; volta: RespostaBolinha };
  banco: { dados: { rota: 'resumo' | 'estado'; forcar?: boolean }; volta: ResumoBanco };
  desligarBanco: { dados: { itemId: string }; volta: { ok: boolean } };
  conectarBanco: { dados: { itemId?: string }; volta: BancoConectado | null };
  tema: { dados: { modo: TemaEscolhido }; volta: null };
  sincronizar: { dados: null; volta: null };
  sair: { dados: null; volta: null };
};

/* ---------- Loja simples (sem biblioteca) ---------- */

function loja<T>(inicial: T) {
  let valor = inicial;
  const ouvintes = new Set<() => void>();
  return {
    ler: () => valor,
    mudar: (v: T) => { if (Object.is(v, valor)) return; valor = v; ouvintes.forEach((f) => f()); },
    ouvir: (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
  };
}

const lerLocal = <T,>(k: string, f: T): T => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : f; } catch { return f; } };
const gravarLocal = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const K_ESTADO = 'avina-nativo-estado';
const K_OCULTO = 'avina-nativo-oculto';

const estado = loja<Estado | null>(lerLocal<Estado | null>(K_ESTADO, null));
const siteVivo = loja(false); // o site respondeu (carregou e registrou as ações)
const web = loja<{ visivel: boolean; motivo: string | null }>({ visivel: false, motivo: null });
const oculto = loja<boolean>(lerLocal(K_OCULTO, false));

let gravarDepois: ReturnType<typeof setTimeout> | undefined;
// Chamado pela camada do site quando chega um retrato novo
export function receberEstado(e: Estado) {
  estado.mudar(e);
  clearTimeout(gravarDepois);
  // sem login, nada dos dados da pessoa fica guardado no aparelho
  gravarDepois = setTimeout(() => gravarLocal(K_ESTADO, e.logado ? e : { ...e, pessoal: null, consultorio: null, transporte: null, casa: null, loja: null }), 600);
}
export const lerEstado = () => estado.ler();
export const useEstado = () => useSyncExternalStore(estado.ouvir, estado.ler);

// O site já atende a tela nativa deste recurso? (sem ele, uma cópia antiga do site: o app abre a área no site)
export const temRecurso = (e: Estado | null | undefined, r: Recurso) => !!e?.recursos?.includes(r);
export const useRecurso = (r: Recurso) => useSyncExternalStore(estado.ouvir, () => temRecurso(estado.ler(), r));
export const useTemaEscolhido = (): TemaEscolhido => useSyncExternalStore(estado.ouvir, () => estado.ler()?.tema ?? 'auto');
export const useSiteVivo = () => useSyncExternalStore(siteVivo.ouvir, siteVivo.ler);
// true/false pelo último retrato; null quando o site ainda não mandou nenhum (primeira abertura)
export const useLogado = (): boolean | null => useSyncExternalStore(estado.ouvir, () => estado.ler()?.logado ?? null);

// Esconder os valores (o "olho" do topo): vale para todas as telas e fica guardado
export const useOculto = () => useSyncExternalStore(oculto.ouvir, oculto.ler);
export const lerOculto = () => oculto.ler(); // fora de componente (o texto de um recado)
export const alternarOculto = () => { const n = !oculto.ler(); oculto.mudar(n); gravarLocal(K_OCULTO, n); };

/* ---------- A camada do site ---------- */

export const useWeb = () => useSyncExternalStore(web.ouvir, web.ler);
export const lerWeb = () => web.ler(); // fora de componente (a camada do site, ao receber o retrato)
export const ouvirWeb = (f: () => void) => web.ouvir(f); // fora de componente (voltar à tela nativa quando o site sai da frente)
// motivo: o que levou o site para a frente ('login', 'area', 'banco', 'ajustes'...)
export const mostrarWeb = (motivo = 'area') => web.mudar({ visivel: true, motivo });
export const esconderWeb = () => { if (web.ler().visivel) web.mudar({ visivel: false, motivo: null }); };

/* ---------- Pedidos ao site ---------- */

type Injetor = (js: string) => void;
let injetar: Injetor | null = null;
let proximo = 0;
const pendentes = new Map<number, { ok: (v: any) => void; falha: (e: Error) => void; t: ReturnType<typeof setTimeout> }>();
const fila: (() => void)[] = [];

// A camada do site liga (e desliga) o injetor; quando o site avisa que está vivo, a fila sai
export function ligarInjetor(f: Injetor | null) { injetar = f; if (!f) siteVivo.mudar(false); }
export function siteProntoParaPedidos() {
  siteVivo.mudar(true);
  while (fila.length) fila.shift()!();
}
// O site recarregou (versão nova, sistema derrubou a WebView): pedidos em andamento não vão ter resposta
export function siteReiniciou() {
  siteVivo.mudar(false);
  pendentes.forEach((p) => { clearTimeout(p.t); p.falha(new Error('site-reiniciou')); });
  pendentes.clear();
}

export function pedirSite<A extends keyof PedidosSite>(acao: A, dados: PedidosSite[A]['dados'], limiteMs = 30_000): Promise<PedidosSite[A]['volta']> {
  return new Promise((ok, falha) => {
    const enviar = () => {
      if (!injetar) { falha(new Error('sem-site')); return; }
      const id = ++proximo;
      const t = setTimeout(() => { pendentes.delete(id); falha(new Error('tempo')); }, limiteMs);
      pendentes.set(id, { ok, falha, t });
      injetar(`window.__avinaNativo && window.__avinaNativo(${id}, ${JSON.stringify(acao)}, ${JSON.stringify(dados ?? null)}); true;`);
    };
    if (siteVivo.ler()) enviar(); else fila.push(enviar);
  });
}

// Abre uma tela do site e traz a camada do site para a frente (o Avina → Consultório, Ajustes, a loja...).
// Pede primeiro e mostra quando o site já trocou de tela (ou em 250 ms), para não aparecer a tela anterior.
// Ex.: abrirNoSite({ area: 'consultorio' }); abrirNoSite({ tela: 'ajustes' }, 'ajustes')
export function abrirNoSite(dados: PedidosSite['abrir']['dados'], motivo = 'area'): Promise<boolean> {
  let mostrou = false; // só uma vez: uma resposta atrasada não traz o site de volta depois que a pessoa saiu dele
  const mostrar = () => { if (!mostrou) { mostrou = true; mostrarWeb(motivo); } };
  const t = setTimeout(mostrar, 250);
  return pedirSite('abrir', dados).then(
    () => { clearTimeout(t); mostrar(); return true; },
    () => { clearTimeout(t); mostrar(); return false; },
  );
}

// Resposta de um pedido: { resp: id, erro?, valor? } (veio pela mensagem da WebView)
export function receberResposta(m: { resp: number; erro?: string | null; valor?: unknown }) {
  const p = pendentes.get(m.resp);
  if (!p) return;
  pendentes.delete(m.resp);
  clearTimeout(p.t);
  if (m.erro) p.falha(new Error(m.erro)); else p.ok(m.valor ?? null);
}
