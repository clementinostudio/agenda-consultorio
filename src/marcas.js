/* =========================================================
   Marcas: reconhece a empresa (mesmo com erro de digitação) e mostra a logo de verdade.
   A logo vem do ícone do próprio site da empresa (serviço de ícones do Google, com o do DuckDuckGo de reserva).
   Para incluir uma marca: [id, nome, site, categoria, apelidos...]
   - apelidos: texto simples (minúsculo, sem acento) ou expressão regular (para nomes que também são palavras comuns)
   - site vazio "": a marca é reconhecida, mas a logo fica com o ícone da categoria (ou a foto que você escolher)
   ========================================================= */

export const semAcentoM = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const normalizar = s => semAcentoM(s).replace(/[’'`´]/g, "").replace(/&/g, " e ").replace(/[^a-z0-9$€£ ]+/g, " ").replace(/\s+/g, " ").trim();

const LISTA = [
  // ---------- mercados: nacionais ----------
  ["carrefour", "Carrefour", "carrefour.com.br", "mercado", "carrefour", "carrefur", "carefour", "carrefor", "carrefuor"],
  ["atacadao", "Atacadão", "atacadao.com.br", "mercado", "atacadao"],
  ["assai", "Assaí", "assai.com.br", "mercado", "assai", "assai atacadista"],
  ["paodeacucar", "Pão de Açúcar", "paodeacucar.com", "mercado", "pao de acucar", "pao acucar"],
  ["extra", "Extra", "clubeextra.com.br", "mercado", "mercado extra", "supermercado extra", "extra mercado", "hiper extra", "clube extra"],
  ["samsclub", "Sam's Club", "samsclub.com.br", "mercado", "sams club", "sams"],
  ["big", "Big", "big.com.br", "mercado", "hiper big", "supermercado big", "big hiper"],
  ["dia", "Dia", "dia.com.br", "mercado", "supermercado dia", "mercado dia"],
  ["tenda", "Tenda Atacado", "tendaatacado.com.br", "mercado", "tenda atacado", "tenda"],
  ["makro", "Makro", "makro.com.br", "mercado", "makro"],
  ["fortatacadista", "Fort Atacadista", "fortatacadista.com.br", "mercado", "fort atacadista"],
  ["comper", "Comper", "comper.com.br", "mercado", "comper"],
  ["mateus", "Mateus Supermercados", "grupomateus.com.br", "mercado", "mateus supermercados", "mix mateus", "grupo mateus"],
  ["gbarbosa", "GBarbosa", "gbarbosa.com.br", "mercado", "gbarbosa", "g barbosa"],
  ["bretas", "Bretas", "bretas.com.br", "mercado", "bretas"],
  ["perini", "Perini", "perini.com.br", "mercado", "perini"],
  ["hortifruti", "Hortifruti", "hortifruti.com.br", "mercado", "hortifruti"],
  ["oba", "Oba Hortifruti", "obahortifruti.com.br", "mercado", "oba hortifruti", "oba"],
  ["stmarche", "St Marche", "marche.com.br", "mercado", "st marche", "santa marche"],
  ["eataly", "Eataly", "eataly.com.br", "mercado", "eataly"],
  ["minutopa", "Minuto Pão de Açúcar", "paodeacucar.com", "mercado", "minuto pao de acucar"],
  ["oxxo", "OXXO", "oxxo.com.br", "mercado", "oxxo"],
  ["amazonfresh", "Amazon Fresh", "amazon.com.br", "mercado", "amazon fresh"],
  ["daki", "Daki", "soudaki.com", "mercado", "daki"],
  ["shopper", "Shopper", "shopper.com.br", "mercado", "shopper"],
  // ---------- mercados: Paraná e Sul ----------
  ["muffato", "Super Muffato", "supermuffato.com.br", "mercado", "super muffato", "muffato", "mufato", "mufatto", "muffatto", "mufatu"],
  ["maxatacadista", "Max Atacadista", "maxatacadista.com.br", "mercado", "max atacadista", "atacadista max", "max atacado", "maxi atacadista", "max"],
  ["condor", "Condor", "condor.com.br", "mercado", "condor", "super condor"],
  ["festval", "Festval", "festval.com.br", "mercado", "festval", "festival supermercado"],
  ["angeloni", "Angeloni", "angeloni.com.br", "mercado", "angeloni"],
  ["giassi", "Giassi", "giassi.com.br", "mercado", "giassi"],
  ["bistek", "Bistek", "bistek.com.br", "mercado", "bistek"],
  ["zaffari", "Zaffari", "zaffari.com.br", "mercado", "zaffari", "zafari"],
  ["nacional", "Nacional", "supernacional.com.br", "mercado", "supermercado nacional", "super nacional"],
  ["unidasul", "Rissul", "rissul.com.br", "mercado", "rissul"],
  ["superkoch", "Komprão / Koch", "superkoch.com.br", "mercado", "komprao", "super koch", "koch"],
  ["cooper", "Cooper", "cooper.coop.br", "mercado", "cooper"],
  ["jacomar", "Jacomar", "jacomar.com.br", "mercado", "jacomar"],
  ["tozetto", "Tozetto", "tozetto.com.br", "mercado", "tozetto"],
  ["amigao", "Amigão Supermercados", "amigao.com", "mercado", "amigao"],
  ["cidadecancao", "Cidade Canção", "cidadecancao.com.br", "mercado", "cidade cancao"],
  ["economico", "Econômico Supermercados", "", "mercado", "economico", "super economico", "supermercado economico", "economico supermercados"],
  ["superviscardi", "Viscardi", "superviscardi.com.br", "mercado", "viscardi"],
  ["beltrao", "Beltrão Supermercados", "beltraosupermercados.com.br", "mercado", "beltrao supermercados"],
  ["superpao", "Superpão", "superpao.com.br", "mercado", "superpao", "super pao"],
  ["carreiro", "Carreiro", "", "mercado", "carreiro supermercado"],
  ["fortaleza", "Fortaleza Atacadista", "", "mercado", "fortaleza atacadista"],
  ["verdao", "Verdão Supermercados", "", "mercado", "verdao"],
  ["planalto", "Planalto Supermercados", "", "mercado", "supermercado planalto", "planalto supermercados"],
  // ---------- mercados: Sudeste ----------
  ["savegnago", "Savegnago", "savegnago.com.br", "mercado", "savegnago"],
  ["guanabara", "Guanabara", "supermercadosguanabara.com.br", "mercado", "guanabara"],
  ["mundial", "Mundial", "supermercadosmundial.com.br", "mercado", "supermercado mundial", "mundial supermercado"],
  ["prezunic", "Prezunic", "prezunic.com.br", "mercado", "prezunic"],
  ["zonasul", "Zona Sul", "zonasul.com.br", "mercado", "zona sul"],
  ["supermarket", "SuperMarket", "supermarketrj.com.br", "mercado", "supermarket"],
  ["sonda", "Sonda", "sondadelivery.com.br", "mercado", "sonda"],
  ["hirota", "Hirota", "hirota.com.br", "mercado", "hirota"],
  ["nagumo", "Nagumo", "nagumo.com.br", "mercado", "nagumo"],
  ["mambo", "Mambo", "mambo.com.br", "mercado", "mambo"],
  ["dalben", "Dalben", "dalben.com.br", "mercado", "dalben"],
  ["covabra", "Covabra", "covabra.com.br", "mercado", "covabra"],
  ["sondadelivery", "Pague Menos Supermercados", "superpaguemenos.com.br", "mercado", "pague menos supermercado", "supermercado pague menos"],
  ["roldao", "Roldão", "roldao.com.br", "mercado", "roldao"],
  ["spani", "Spani Atacadista", "spani.com.br", "mercado", "spani"],
  ["andorinha", "Andorinha", "superandorinha.com.br", "mercado", "andorinha"],
  ["coop", "Coop", "coop.com.br", "mercado", "coop"],
  ["epa", "EPA", "epa.com.br", "mercado", "supermercado epa", "epa plus"],
  ["supernosso", "Supernosso", "supernosso.com", "mercado", "supernosso", "super nosso"],
  ["verdemar", "Verdemar", "verdemar.com.br", "mercado", "verdemar"],
  ["bh", "Supermercados BH", "supermercadosbh.com.br", "mercado", "supermercado bh", "supermercados bh"],
  ["dma", "DMA Distribuidora", "dmadistribuidora.com.br", "mercado", "dma"],
  ["apoio", "Apoio Mineiro", "apoiomineiro.com.br", "mercado", "apoio mineiro"],
  ["sacolao", "Sacolão", "", "mercado", "sacolao"],
  ["saoroque", "Super São Roque", "", "mercado", "sao roque supermercado"],
  // ---------- mercados: Nordeste, Norte, Centro-Oeste ----------
  ["assaiNE", "Atakarejo", "atakarejo.com.br", "mercado", "atakarejo"],
  ["bompreco", "Bompreço", "bompreco.com.br", "mercado", "bompreco", "bom preco"],
  ["nordestao", "Nordestão", "nordestao.com.br", "mercado", "nordestao"],
  ["saoluiz", "Mercadinhos São Luiz", "mercadinhossaoluiz.com.br", "mercado", "sao luiz", "mercadinho sao luiz"],
  ["frangolandia", "Frangolândia", "", "mercado", "frangolandia"],
  ["lider", "Líder", "lider.net.br", "mercado", "supermercado lider"],
  ["formosa", "Formosa", "formosaonline.com.br", "mercado", "formosa supermercado"],
  ["dbsuper", "DB Supermercados", "dbsupermercados.com.br", "mercado", "db supermercados"],
  ["novaera", "Nova Era", "novaera.com.br", "mercado", "nova era supermercado"],
  ["pinheiro", "Pinheiro", "pinheirosupermercado.com.br", "mercado", "pinheiro supermercado"],
  ["redemix", "Rede Mix", "redemix.com.br", "mercado", "rede mix"],
  ["hiperbompreco", "Hiper Bompreço", "bompreco.com.br", "mercado", "hiper bompreco"],
  ["supercompras", "Super Compras", "", "mercado", "super compras"],
  // ---------- comida fora e delivery ----------
  ["ifood", "iFood", "ifood.com.br", "comida", "ifood", "i food", "aifood", "ifod"],
  ["rappi", "Rappi", "rappi.com.br", "comida", "rappi", "rapi"],
  ["ze", "Zé Delivery", "ze.delivery", "comida", "ze delivery"],
  ["aiqfome", "aiqfome", "aiqfome.com", "comida", "aiqfome", "ai q fome", "aiq fome"],
  ["keeta", "Keeta", "keeta.com", "comida", "keeta"],
  ["mcdonalds", "McDonald's", "mcdonalds.com.br", "comida", "mcdonalds", "mc donalds", "mcdonald", "mc donald", "mequi", "meque", "mc"],
  ["burgerking", "Burger King", "burgerking.com.br", "comida", "burger king", "burguer king", "bk"],
  ["subway", "Subway", "subway.com", "comida", "subway"],
  ["kfc", "KFC", "kfc.com.br", "comida", "kfc"],
  ["bobs", "Bob's", "bobs.com.br", "comida", "bobs"],
  ["habibs", "Habib's", "habibs.com.br", "comida", "habibs", "habib"],
  ["giraffas", "Giraffas", "giraffas.com.br", "comida", "giraffas", "girafas"],
  ["outback", "Outback", "outback.com.br", "comida", "outback"],
  ["madero", "Madero", "restaurantemadero.com.br", "comida", "madero", "jeronimo"],
  ["cocobambu", "Coco Bambu", "cocobambu.com", "comida", "coco bambu"],
  ["spoleto", "Spoleto", "spoleto.com.br", "comida", "spoleto"],
  ["pizzahut", "Pizza Hut", "pizzahut.com.br", "comida", "pizza hut"],
  ["dominos", "Domino's", "dominos.com.br", "comida", "dominos", "domino"],
  ["starbucks", "Starbucks", "starbucks.com.br", "comida", "starbucks"],
  ["cacaushow", "Cacau Show", "cacaushow.com.br", "comida", "cacau show"],
  ["kopenhagen", "Kopenhagen", "kopenhagen.com.br", "comida", "kopenhagen"],
  ["chinainbox", "China in Box", "chinainbox.com.br", "comida", "china in box"],
  ["gendai", "Gendai", "gendai.com.br", "comida", "gendai"],
  ["jaspa", "Jassa", "", "comida", "jassa"],
  ["popeyes", "Popeyes", "popeyes.com.br", "comida", "popeyes"],
  ["burgerfuel", "Johnny Rockets", "johnnyrockets.com.br", "comida", "johnny rockets"],
  ["paris6", "Paris 6", "paris6.com.br", "comida", "paris 6"],
  ["fogodechao", "Fogo de Chão", "fogodechao.com.br", "comida", "fogo de chao"],
  ["applebees", "Applebee's", "applebees.com.br", "comida", "applebees"],
  ["abbraccio", "Abbraccio", "abbraccio.com.br", "comida", "abbraccio"],
  ["ragazzo", "Ragazzo", "ragazzo.com.br", "comida", "ragazzo"],
  ["casadopaodequeijo", "Casa do Pão de Queijo", "casadopaodequeijo.com.br", "comida", "casa do pao de queijo"],
  ["havanna", "Havanna", "havanna.com.br", "comida", "havanna"],
  ["chiquinho", "Chiquinho Sorvetes", "chiquinho.com.br", "comida", "chiquinho"],
  ["bacio", "Bacio di Latte", "baciodilatte.com.br", "comida", "bacio di latte"],
  ["oakberry", "Oakberry", "oakberry.com", "comida", "oakberry"],
  ["cafecafe", "Café Cultura", "cafecultura.com.br", "comida", "cafe cultura"],
  ["frangoassado", "Frango Assado", "frangoassado.com.br", "comida", "frango assado"],
  ["divino", "Divino Fogão", "divinofogao.com.br", "comida", "divino fogao"],
  ["vivenda", "Vivenda do Camarão", "vivendadocamarao.com.br", "comida", "vivenda do camarao"],
  ["patroni", "Patroni", "patroni.com.br", "comida", "patroni"],
  ["bigfrango", "Montana Grill", "montanagrill.com.br", "comida", "montana grill"],
  ["mcfit", "Mr. Cheney", "mrcheney.com.br", "comida", "mr cheney"],
  ["pizzariabraz", "Bráz Pizzaria", "brazpizzaria.com.br", "comida", "braz pizzaria"],
  ["coca", "Coca-Cola", "cocacola.com.br", "comida", "coca cola"],
  // ---------- transporte ----------
  ["uber", "Uber", "uber.com", "transporte", "uber", "uber eats", "uberx", "ubber"],
  ["99", "99", "99app.com", "transporte", "99 ?pop", "99 ?taxi", "99app", /\b(?:na|no|da|do|pela|pelo)\s+99\b(?!\s*(?:reais|real|conto|contos|centavos|,\d))/],
  ["indrive", "inDrive", "indrive.com", "transporte", "indrive", "in drive"],
  ["cabify", "Cabify", "cabify.com", "transporte", "cabify"],
  ["blablacar", "BlaBlaCar", "blablacar.com.br", "transporte", "blablacar", "bla bla car"],
  ["shell", "Shell", "shell.com.br", "transporte", "shell", "posto shell"],
  ["ipiranga", "Ipiranga", "ipiranga.com.br", "transporte", "ipiranga", "posto ipiranga"],
  ["petrobras", "Petrobras / Vibra", "petrobras.com.br", "transporte", "petrobras", "posto br", "vibra"],
  ["ale", "Ale Combustíveis", "ale.com.br", "transporte", "posto ale"],
  ["raizen", "Raízen", "raizen.com.br", "transporte", "raizen"],
  ["semparar", "Sem Parar", "semparar.com.br", "transporte", "sem parar"],
  ["veloe", "Veloe", "veloe.com.br", "transporte", "veloe"],
  ["conectcar", "ConectCar", "conectcar.com", "transporte", "conectcar", "conect car"],
  ["taggy", "Taggy", "taggy.com.br", "transporte", "taggy"],
  ["estapar", "Estapar", "estapar.com.br", "transporte", "estapar"],
  ["zuldigital", "Zul+", "zuldigital.com.br", "transporte", "zul digital", "zul"],
  ["latam", "LATAM", "latamairlines.com", "transporte", "latam"],
  ["gol", "GOL", "voegol.com.br", "transporte", /\b(?:passagem|voo|voos|aviao)\s+(?:da\s+)?gol\b/, "voe gol"],
  ["azul", "Azul", "voeazul.com.br", "transporte", /\b(?:passagem|voo|voos|aviao)\s+(?:da\s+)?azul\b/, "voe azul", "azul linhas aereas"],
  ["clickbus", "ClickBus", "clickbus.com.br", "transporte", "clickbus", "click bus"],
  ["buser", "Buser", "buser.com.br", "transporte", "buser"],
  ["localiza", "Localiza", "localiza.com", "transporte", "localiza"],
  ["movida", "Movida", "movida.com.br", "transporte", "movida"],
  ["unidas", "Unidas", "unidas.com.br", "transporte", "unidas"],
  ["detran", "Detran", "", "transporte", "detran", "ipva", "licenciamento"],
  ["metro", "Metrô", "metro.sp.gov.br", "transporte", "metro sp"],
  ["bilheteunico", "Bilhete Único", "", "transporte", "bilhete unico"],
  ["porto", "Porto Seguro", "portoseguro.com.br", "transporte", "porto seguro"],
  // ---------- saúde ----------
  ["drogasil", "Drogasil", "drogasil.com.br", "saude", "drogasil", "droga sil"],
  ["drogaraia", "Droga Raia", "drogaraia.com.br", "saude", "droga raia", "drogaraia", "raia"],
  ["paguemenos", "Pague Menos", "paguemenos.com.br", "saude", "pague menos", "farmacia pague menos"],
  ["panvel", "Panvel", "panvel.com", "saude", "panvel"],
  ["drogariasaopaulo", "Drogaria São Paulo", "drogariasaopaulo.com.br", "saude", "drogaria sao paulo"],
  ["pacheco", "Drogarias Pacheco", "drogariaspacheco.com.br", "saude", "pacheco"],
  ["nissei", "Farmácias Nissei", "farmaciasnissei.com.br", "saude", "nissei"],
  ["venancio", "Drogaria Venancio", "drogariavenancio.com.br", "saude", "venancio"],
  ["araujo", "Drogaria Araujo", "araujo.com.br", "saude", "drogaria araujo", "araujo"],
  ["saojoao", "Farmácias São João", "saojoaofarmacias.com.br", "saude", "sao joao farmacia", "farmacias sao joao"],
  ["extrafarma", "Extrafarma", "extrafarma.com.br", "saude", "extrafarma"],
  ["drogal", "Drogal", "drogal.com.br", "saude", "drogal"],
  ["farmaponte", "Farma Ponte", "farmaponte.com.br", "saude", "farma ponte"],
  ["preçopopular", "Farmácia Preço Popular", "precopopular.com.br", "saude", "preco popular"],
  ["maisvida", "Farmácias Mais Vida", "", "saude", "mais vida farmacia"],
  ["unimed", "Unimed", "unimed.coop.br", "saude", "unimed"],
  ["amil", "Amil", "amil.com.br", "saude", "amil"],
  ["sulamerica", "SulAmérica", "sulamerica.com.br", "saude", "sulamerica", "sul america"],
  ["bradescosaude", "Bradesco Saúde", "bradescoseguros.com.br", "saude", "bradesco saude"],
  ["hapvida", "Hapvida", "hapvida.com.br", "saude", "hapvida", "notredame", "notre dame intermedica"],
  ["porto saude", "Porto Saúde", "portoseguro.com.br", "saude", "porto saude"],
  ["odontoprev", "OdontoPrev", "odontoprev.com.br", "saude", "odontoprev"],
  ["fleury", "Fleury", "fleury.com.br", "saude", "fleury"],
  ["dasa", "Dasa", "dasa.com.br", "saude", "dasa", "delboni", "lavoisier"],
  ["sabin", "Sabin", "sabin.com.br", "saude", "sabin"],
  ["hermespardini", "Hermes Pardini", "hermespardini.com.br", "saude", "hermes pardini"],
  ["drconsulta", "Dr. Consulta", "drconsulta.com", "saude", "dr consulta"],
  ["smartfit", "Smart Fit", "smartfit.com.br", "saude", "smart fit", "smartfit"],
  ["bluefit", "Bluefit", "bluefit.com.br", "saude", "bluefit", "blue fit"],
  ["selfit", "Selfit", "selfitacademias.com.br", "saude", "selfit"],
  ["bodytech", "Bodytech", "bodytech.com.br", "saude", "bodytech", "body tech"],
  ["bioritmo", "Bio Ritmo", "bioritmo.com.br", "saude", "bio ritmo"],
  ["wellhub", "Wellhub", "wellhub.com", "saude", "wellhub", "gympass"],
  ["totalpass", "TotalPass", "totalpass.com", "saude", "totalpass", "total pass"],
  ["zenklub", "Zenklub", "zenklub.com.br", "saude", "zenklub"],
  ["vittude", "Vittude", "vittude.com", "saude", "vittude"],
  ["doctoralia", "Doctoralia", "doctoralia.com.br", "saude", "doctoralia"],
  ["petz", "Petz", "petz.com.br", "saude", "petz"],
  ["cobasi", "Cobasi", "cobasi.com.br", "saude", "cobasi"],
  ["petlove", "Petlove", "petlove.com.br", "saude", "petlove", "pet love"],
  // ---------- lazer e assinaturas ----------
  ["netflix", "Netflix", "netflix.com", "lazer", "netflix", "netflics", "netflx", "netiflix"],
  ["spotify", "Spotify", "spotify.com", "lazer", "spotify", "spotfy", "spotifi"],
  ["deezer", "Deezer", "deezer.com", "lazer", "deezer"],
  ["youtube", "YouTube", "youtube.com", "lazer", "youtube", "you tube", "youtube premium"],
  ["primevideo", "Prime Video", "primevideo.com", "lazer", "prime video", "amazon prime", "prime"],
  ["disney", "Disney+", "disneyplus.com", "lazer", "disney", "disney plus"],
  ["max", "Max (HBO)", "max.com", "lazer", "hbo max", "hbo", "max streaming"],
  ["globoplay", "Globoplay", "globoplay.globo.com", "lazer", "globoplay", "globo play"],
  ["paramount", "Paramount+", "paramountplus.com", "lazer", "paramount"],
  ["crunchyroll", "Crunchyroll", "crunchyroll.com", "lazer", "crunchyroll"],
  ["appletv", "Apple TV", "tv.apple.com", "lazer", "apple tv"],
  ["applemusic", "Apple Music", "music.apple.com", "lazer", "apple music"],
  ["amazonmusic", "Amazon Music", "music.amazon.com.br", "lazer", "amazon music"],
  ["tidal", "Tidal", "tidal.com", "lazer", "tidal"],
  ["twitch", "Twitch", "twitch.tv", "lazer", "twitch"],
  ["telecine", "Telecine", "telecine.com.br", "lazer", "telecine"],
  ["premiere", "Premiere", "premiere.globo.com", "lazer", "premiere"],
  ["skymais", "Sky", "sky.com.br", "lazer", "sky", "sky mais"],
  ["claro tv", "Claro TV+", "claro.com.br", "lazer", "claro tv"],
  ["mubi", "MUBI", "mubi.com", "lazer", "mubi"],
  ["kindle", "Kindle Unlimited", "amazon.com.br", "lazer", "kindle"],
  ["audible", "Audible", "audible.com.br", "lazer", "audible"],
  ["skeelo", "Skeelo", "skeelo.app", "lazer", "skeelo"],
  ["steam", "Steam", "steampowered.com", "lazer", "steam"],
  ["playstation", "PlayStation", "playstation.com", "lazer", "playstation", "psn", "play station", "ps plus"],
  ["xbox", "Xbox", "xbox.com", "lazer", "xbox", "game pass"],
  ["nintendo", "Nintendo", "nintendo.com", "lazer", "nintendo"],
  ["epicgames", "Epic Games", "epicgames.com", "lazer", "epic games"],
  ["riot", "Riot Games", "riotgames.com", "lazer", "riot", "valorant", "league of legends"],
  ["roblox", "Roblox", "roblox.com", "lazer", "roblox"],
  ["cinemark", "Cinemark", "cinemark.com.br", "lazer", "cinemark"],
  ["cinepolis", "Cinépolis", "cinepolis.com.br", "lazer", "cinepolis"],
  ["kinoplex", "Kinoplex", "kinoplex.com.br", "lazer", "kinoplex"],
  ["uci", "UCI Cinemas", "ucicinemas.com.br", "lazer", "uci"],
  ["ingresso", "Ingresso.com", "ingresso.com", "lazer", "ingresso com", "ingresso.com"],
  ["sympla", "Sympla", "sympla.com.br", "lazer", "sympla"],
  ["eventim", "Eventim", "eventim.com.br", "lazer", "eventim"],
  ["ticketmaster", "Ticketmaster", "ticketmaster.com.br", "lazer", "ticketmaster"],
  ["airbnb", "Airbnb", "airbnb.com.br", "lazer", "airbnb", "air bnb", "airbinb"],
  ["booking", "Booking", "booking.com", "lazer", "booking"],
  ["decolar", "Decolar", "decolar.com", "lazer", "decolar"],
  ["hurb", "Hurb", "hurb.com", "lazer", "hurb"],
  ["cvc", "CVC", "cvc.com.br", "lazer", "cvc"],
  ["maxmilhas", "MaxMilhas", "maxmilhas.com.br", "lazer", "maxmilhas", "max milhas"],
  ["123milhas", "123milhas", "123milhas.com", "lazer", "123 milhas", "123milhas"],
  ["smiles", "Smiles", "smiles.com.br", "lazer", "smiles"],
  ["livelo", "Livelo", "livelo.com.br", "lazer", "livelo"],
  ["beachpark", "Beach Park", "beachpark.com.br", "lazer", "beach park"],
  ["beto carrero", "Beto Carrero", "betocarrero.com.br", "lazer", "beto carrero"],
  // ---------- compras: varejo, roupas, beleza ----------
  ["amazon", "Amazon", "amazon.com.br", "compras", "amazon", "amazon.com", "amazom", "amazn"],
  ["mercadolivre", "Mercado Livre", "mercadolivre.com.br", "compras", "mercado livre", "mercadolivre"],
  ["shopee", "Shopee", "shopee.com.br", "compras", "shopee", "shopii", "xopi", "shoppe"],
  ["shein", "Shein", "shein.com", "compras", "shein", "xein", "shien"],
  ["aliexpress", "AliExpress", "aliexpress.com", "compras", "aliexpress", "ali express"],
  ["temu", "Temu", "temu.com", "compras", "temu"],
  ["magalu", "Magalu", "magazineluiza.com.br", "compras", "magalu", "magazine luiza", "magazine"],
  ["americanas", "Americanas", "americanas.com.br", "compras", "americanas", "lojas americanas"],
  ["casasbahia", "Casas Bahia", "casasbahia.com.br", "compras", "casas bahia", "casa bahia"],
  ["pontofrio", "Ponto", "pontofrio.com.br", "compras", "ponto frio", "pontofrio"],
  ["fastshop", "Fast Shop", "fastshop.com.br", "compras", "fast shop"],
  ["kabum", "KaBuM!", "kabum.com.br", "compras", "kabum"],
  ["terabyte", "Terabyte", "terabyteshop.com.br", "compras", "terabyte"],
  ["pichau", "Pichau", "pichau.com.br", "compras", "pichau"],
  ["havan", "Havan", "havan.com.br", "compras", "havan"],
  ["lojasgazin", "Gazin", "gazin.com.br", "compras", "gazin"],
  ["colombo", "Lojas Colombo", "colombo.com.br", "compras", "lojas colombo", "colombo"],
  ["quero-quero", "Lojas Quero-Quero", "queroquero.com.br", "compras", "quero quero"],
  ["mm", "Lojas MM", "lojasmm.com", "compras", "lojas mm"],
  ["novomundo", "Novo Mundo", "novomundo.com.br", "compras", "novo mundo"],
  ["renner", "Renner", "lojasrenner.com.br", "compras", "renner", "lojas renner"],
  ["riachuelo", "Riachuelo", "riachuelo.com.br", "compras", "riachuelo"],
  ["cea", "C&A", "cea.com.br", "compras", /\bc ?& ?a\b/, /\bcea\b/, /\bc e a\b/],
  ["marisa", "Marisa", "marisa.com.br", "compras", "marisa"],
  ["pernambucanas", "Pernambucanas", "pernambucanas.com.br", "compras", "pernambucanas"],
  ["zara", "Zara", "zara.com", "compras", "zara"],
  ["hm", "H&M", "hm.com", "compras", /\bh ?& ?m\b/],
  ["hering", "Hering", "hering.com.br", "compras", "hering"],
  ["malwee", "Malwee", "malwee.com.br", "compras", "malwee"],
  ["youcom", "Youcom", "youcom.com.br", "compras", "youcom"],
  ["farm", "FARM", "farmrio.com.br", "compras", "farm rio"],
  ["arezzo", "Arezzo", "arezzo.com.br", "compras", "arezzo"],
  ["havaianas", "Havaianas", "havaianas.com.br", "compras", "havaianas"],
  ["nike", "Nike", "nike.com.br", "compras", "nike"],
  ["adidas", "adidas", "adidas.com.br", "compras", "adidas"],
  ["puma", "Puma", "puma.com", "compras", "puma"],
  ["olympikus", "Olympikus", "olympikus.com.br", "compras", "olympikus"],
  ["centauro", "Centauro", "centauro.com.br", "compras", "centauro"],
  ["netshoes", "Netshoes", "netshoes.com.br", "compras", "netshoes", "net shoes"],
  ["decathlon", "Decathlon", "decathlon.com.br", "compras", "decathlon"],
  ["dafiti", "Dafiti", "dafiti.com.br", "compras", "dafiti"],
  ["zattini", "Zattini", "zattini.com.br", "compras", "zattini"],
  ["enjoei", "Enjoei", "enjoei.com.br", "compras", "enjoei"],
  ["olx", "OLX", "olx.com.br", "compras", "olx"],
  ["boticario", "O Boticário", "boticario.com.br", "compras", "boticario", "o boticario"],
  ["natura", "Natura", "natura.com.br", "compras", "natura"],
  ["avon", "Avon", "avon.com.br", "compras", "avon"],
  ["eudora", "Eudora", "eudora.com.br", "compras", "eudora"],
  ["sephora", "Sephora", "sephora.com.br", "compras", "sephora"],
  ["belezanaweb", "Beleza na Web", "belezanaweb.com.br", "compras", "beleza na web"],
  ["quemdisse", "Quem Disse, Berenice?", "quemdisseberenice.com.br", "compras", "quem disse berenice"],
  ["ocapitalista", "Época Cosméticos", "epocacosmeticos.com.br", "compras", "epoca cosmeticos"],
  ["vivara", "Vivara", "vivara.com.br", "compras", "vivara"],
  ["pandora", "Pandora", "pandora.net", "compras", "pandora"],
  ["chilli", "Chilli Beans", "chillibeans.com.br", "compras", "chilli beans"],
  ["ri happy", "Ri Happy", "rihappy.com.br", "compras", "ri happy"],
  ["livrariacultura", "Livraria Leitura", "leitura.com.br", "compras", "livraria leitura", "leitura"],
  ["saraiva", "Saraiva", "saraiva.com.br", "compras", "saraiva"],
  ["estante", "Estante Virtual", "estantevirtual.com.br", "compras", "estante virtual"],
  ["kalunga", "Kalunga", "kalunga.com.br", "compras", "kalunga"],
  ["miniso", "Miniso", "miniso.com.br", "compras", "miniso"],
  ["imaginarium", "Imaginarium", "imaginarium.com.br", "compras", "imaginarium"],
  ["apple", "Apple", "apple.com", "compras", "apple", "icloud", "app store", "itunes"],
  ["google", "Google", "google.com", "compras", "google", "google one", "play store", "google play"],
  ["microsoft", "Microsoft", "microsoft.com", "compras", "microsoft", "office 365", "microsoft 365", "onedrive"],
  ["samsung", "Samsung", "samsung.com", "compras", "samsung"],
  ["motorola", "Motorola", "motorola.com.br", "compras", "motorola"],
  ["xiaomi", "Xiaomi", "mi.com", "compras", "xiaomi"],
  ["dell", "Dell", "dell.com", "compras", "dell"],
  ["openai", "ChatGPT", "openai.com", "compras", "chatgpt", "chat gpt", "openai", "gpt"],
  ["anthropic", "Claude", "claude.ai", "compras", "claude", "anthropic"],
  ["gemini", "Gemini", "gemini.google.com", "compras", "gemini"],
  ["canva", "Canva", "canva.com", "compras", "canva"],
  ["adobe", "Adobe", "adobe.com", "compras", "adobe", "photoshop", "lightroom"],
  ["notion", "Notion", "notion.so", "compras", "notion"],
  ["dropbox", "Dropbox", "dropbox.com", "compras", "dropbox"],
  ["duolingo", "Duolingo", "duolingo.com", "compras", "duolingo"],
  ["linkedin", "LinkedIn", "linkedin.com", "compras", "linkedin"],
  ["tinder", "Tinder", "tinder.com", "lazer", "tinder"],
  ["zoom", "Zoom", "zoom.us", "compras", "zoom"],
  ["hostinger", "Hostinger", "hostinger.com.br", "compras", "hostinger"],
  ["godaddy", "GoDaddy", "godaddy.com", "compras", "godaddy"],
  ["registrobr", "Registro.br", "registro.br", "compras", "registro br"],
  ["leroy", "Leroy Merlin", "leroymerlin.com.br", "casa", "leroy merlin", "leroy"],
  ["tokstok", "Tok&Stok", "tokstok.com.br", "casa", "tok stok", "tokstok"],
  ["telhanorte", "Telhanorte", "telhanorte.com.br", "casa", "telhanorte"],
  ["cec", "C&C", "cec.com.br", "casa", "c e c casa"],
  ["madeiramadeira", "MadeiraMadeira", "madeiramadeira.com.br", "casa", "madeira madeira", "madeiramadeira"],
  ["mobly", "Mobly", "mobly.com.br", "casa", "mobly"],
  ["camicado", "Camicado", "camicado.com.br", "casa", "camicado"],
  ["etna", "Etna", "etna.com.br", "casa", "etna"],
  ["ikea", "IKEA", "ikea.com", "casa", "ikea"],
  ["balaroti", "Balaroti", "balaroti.com.br", "casa", "balaroti"],
  ["cassol", "Cassol", "cassol.com.br", "casa", "cassol"],
  ["obramax", "Obramax", "obramax.com.br", "casa", "obramax"],
  // ---------- casa: energia, água, gás, internet, telefone, aluguel ----------
  ["copel", "Copel", "copel.com", "casa", "copel"],
  ["sanepar", "Sanepar", "sanepar.com.br", "casa", "sanepar"],
  ["compagas", "Compagas", "compagas.com.br", "casa", "compagas"],
  ["celesc", "Celesc", "celesc.com.br", "casa", "celesc"],
  ["casan", "Casan", "casan.com.br", "casa", "casan"],
  ["rgeceee", "CEEE Equatorial", "ceee.equatorialenergia.com.br", "casa", "ceee"],
  ["rge", "RGE", "rge-rs.com.br", "casa", "rge"],
  ["corsan", "Corsan", "corsan.com.br", "casa", "corsan"],
  ["enel", "Enel", "enel.com.br", "casa", "enel", "eletropaulo"],
  ["cpfl", "CPFL", "cpfl.com.br", "casa", "cpfl"],
  ["edp", "EDP", "edp.com.br", "casa", "edp"],
  ["elektro", "Neoenergia Elektro", "neoenergia.com", "casa", "elektro"],
  ["sabesp", "Sabesp", "sabesp.com.br", "casa", "sabesp"],
  ["comgas", "Comgás", "comgas.com.br", "casa", "comgas"],
  ["naturgy", "Naturgy", "naturgy.com.br", "casa", "naturgy", "ceg"],
  ["light", "Light", "light.com.br", "casa", /\b(?:da|na|conta da)\s+light\b/, "light energia"],
  ["aguasdorio", "Águas do Rio", "aguasdorio.com.br", "casa", "aguas do rio", "cedae"],
  ["cemig", "Cemig", "cemig.com.br", "casa", "cemig"],
  ["copasa", "Copasa", "copasa.com.br", "casa", "copasa"],
  ["gasmig", "Gasmig", "gasmig.com.br", "casa", "gasmig"],
  ["energisa", "Energisa", "energisa.com.br", "casa", "energisa"],
  ["equatorial", "Equatorial Energia", "equatorialenergia.com.br", "casa", "equatorial", "celpa", "cemar", "cepisa"],
  ["neoenergia", "Neoenergia", "neoenergia.com", "casa", "neoenergia", "coelba", "celpe", "cosern"],
  ["enelce", "Enel Ceará", "enel.com.br", "casa", "coelce"],
  ["embasa", "Embasa", "embasa.ba.gov.br", "casa", "embasa"],
  ["compesa", "Compesa", "compesa.com.br", "casa", "compesa"],
  ["cagece", "Cagece", "cagece.com.br", "casa", "cagece"],
  ["caesb", "Caesb", "caesb.df.gov.br", "casa", "caesb"],
  ["saneago", "Saneago", "saneago.com.br", "casa", "saneago"],
  ["sanasa", "Sanasa", "sanasa.com.br", "casa", "sanasa"],
  ["ultragaz", "Ultragaz", "ultragaz.com.br", "casa", "ultragaz", "ultra gaz"],
  ["liquigas", "Liquigás", "liquigas.com.br", "casa", "liquigas"],
  ["supergasbras", "Supergasbras", "supergasbras.com.br", "casa", "supergasbras"],
  ["nacionalgas", "Nacional Gás", "nacionalgas.com.br", "casa", "nacional gas"],
  ["vivo", "Vivo", "vivo.com.br", "casa", /\b(?:da|na|conta da|internet da|fibra da)\s+vivo\b/, "vivo fibra", "vivo internet", "conta vivo"],
  ["claro", "Claro", "claro.com.br", "casa", /\b(?:da|na|conta da|internet da)\s+claro\b/, "claro net", "net claro", "claro internet", "conta claro"],
  ["tim", "TIM", "tim.com.br", "casa", /\b(?:da|na|conta da)\s+tim\b/, "tim live", "tim black", "conta tim"],
  ["oi", "Oi", "oi.com.br", "casa", /\b(?:da|na|conta da|internet da)\s+oi\b/, "oi fibra"],
  ["nio", "Nio", "niointernet.com.br", "casa", "nio internet", "nio fibra"],
  ["desktop", "Desktop", "desktop.com.br", "casa", "desktop internet"],
  ["ligga", "Ligga", "ligga.com.br", "casa", "ligga"],
  ["unifique", "Unifique", "unifique.com.br", "casa", "unifique"],
  ["brisanet", "Brisanet", "brisanet.com.br", "casa", "brisanet"],
  ["algar", "Algar Telecom", "algartelecom.com.br", "casa", "algar"],
  ["starlink", "Starlink", "starlink.com", "casa", "starlink"],
  ["quintoandar", "QuintoAndar", "quintoandar.com.br", "casa", "quinto andar", "quintoandar"],
  ["loft", "Loft", "loft.com.br", "casa", "loft"],
  ["condominio", "Condomínio", "", "casa", "condominio"],
  ["iptu", "IPTU", "", "casa", "iptu"],
  // ---------- bancos, cartões e pagamentos ----------
  ["nubank", "Nubank", "nubank.com.br", "outros", "nubank", "nu bank", "nubak", "roxinho"],
  ["itau", "Itaú", "itau.com.br", "outros", "itau", "personnalite"],
  ["bradesco", "Bradesco", "bradesco.com.br", "outros", "bradesco"],
  ["santander", "Santander", "santander.com.br", "outros", "santander"],
  ["bb", "Banco do Brasil", "bb.com.br", "outros", "banco do brasil", "bb"],
  ["caixa", "Caixa", "caixa.gov.br", "outros", "caixa economica", "caixa federal", "banco caixa"],
  ["inter", "Inter", "inter.co", "outros", "banco inter", "inter"],
  ["c6", "C6 Bank", "c6bank.com.br", "outros", "c6 bank", "c6"],
  ["picpay", "PicPay", "picpay.com", "outros", "picpay", "pic pay"],
  ["mercadopago", "Mercado Pago", "mercadopago.com.br", "outros", "mercado pago"],
  ["pagbank", "PagBank", "pagbank.com.br", "outros", "pagbank", "pagseguro", "pag seguro"],
  ["neon", "Neon", "neon.com.br", "outros", "banco neon"],
  ["next", "Next", "next.me", "outros", "banco next"],
  ["sicredi", "Sicredi", "sicredi.com.br", "outros", "sicredi"],
  ["sicoob", "Sicoob", "sicoob.com.br", "outros", "sicoob"],
  ["btg", "BTG Pactual", "btgpactual.com", "outros", "btg"],
  ["xp", "XP Investimentos", "xpi.com.br", "outros", "xp investimentos"],
  ["rico", "Rico", "rico.com.vc", "outros", "rico investimentos"],
  ["original", "Banco Original", "original.com.br", "outros", "banco original"],
  ["pan", "Banco Pan", "bancopan.com.br", "outros", "banco pan"],
  ["will", "Will Bank", "willbank.com.br", "outros", "will bank"],
  ["porto cartao", "Cartão Porto", "portoseguro.com.br", "outros", "cartao porto"],
  ["paypal", "PayPal", "paypal.com", "outros", "paypal", "pay pal"],
  ["wise", "Wise", "wise.com", "outros", "wise"],
  ["nomad", "Nomad", "nomadglobal.com", "outros", "nomad"],
  ["serasa", "Serasa", "serasa.com.br", "outros", "serasa"],
  ["receita", "Receita Federal", "gov.br", "outros", "receita federal", "darf", "imposto de renda", "carne leao"],
  ["crp", "Conselho de Psicologia (CRP)", "cfp.org.br", "outros", "crp", "anuidade crp", "conselho regional de psicologia"],
  ["sesc", "Sesc", "sesc.com.br", "lazer", "sesc"],
  // ---------- educação ----------
  ["alura", "Alura", "alura.com.br", "outros", "alura"],
  ["udemy", "Udemy", "udemy.com", "outros", "udemy"],
  ["coursera", "Coursera", "coursera.org", "outros", "coursera"],
  ["hotmart", "Hotmart", "hotmart.com", "outros", "hotmart"],
  ["kiwify", "Kiwify", "kiwify.com.br", "outros", "kiwify"],
  ["wizard", "Wizard", "wizard.com.br", "outros", "wizard"],
  ["ccaa", "CCAA", "ccaa.com.br", "outros", "ccaa"],
  ["fisk", "Fisk", "fisk.com.br", "outros", "fisk"],
  ["cultura inglesa", "Cultura Inglesa", "culturainglesa.com.br", "outros", "cultura inglesa"],
  ["kumon", "Kumon", "kumon.com.br", "outros", "kumon"],
  ["unopar", "Unopar", "unopar.com.br", "outros", "unopar"],
  ["unicesumar", "Unicesumar", "unicesumar.edu.br", "outros", "unicesumar", "cesumar"],
  ["estacio", "Estácio", "estacio.br", "outros", "estacio"],
  ["anhanguera", "Anhanguera", "anhanguera.com", "outros", "anhanguera"],
  ["pucpr", "PUCPR", "pucpr.br", "outros", "pucpr", "puc pr"],
];

export const MARCAS = LISTA.map(([id, nome, site, cat, ...apelidos], ordem) => ({
  id, nome, site, cat, ordem,
  apelidos: apelidos.filter(a => typeof a === "string").map(normalizar),
  re: apelidos.map(p => (p instanceof RegExp ? p : new RegExp(`\\b${normalizar(p).replace(/[.$]/g, m => "\\" + m)}\\b`))),
}));
const POR_ID = new Map(MARCAS.map(m => [m.id, m]));
export const marcaPorId = id => (id && POR_ID.get(id)) || null;

/* ---------- De onde vem a logo (da melhor para a mais simples) ----------
   1. o ícone de alta resolução que o próprio site oferece para iPhone (apple-touch-icon, 180px)
   2. o serviço de ícones novo do Google (avisa com erro quando não acha, em vez de mandar um ícone genérico)
   3. o serviço antigo do Google (só vale se vier maior que 16px; 16px é o globo genérico)
   Se nenhuma servir, o app mostra as iniciais da empresa numa cor própria (nunca uma seta cinza). */
export const fontesLogo = site => [
  { url: `https://${site}/apple-touch-icon.png`, min: 48 },
  { url: `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${site}&size=128`, min: 16 },
  { url: `https://www.google.com/s2/favicons?domain=${site}&sz=128`, min: 17 },
];
export const logoDoSite = (site, fonte = 0) => (fontesLogo(site)[fonte] || {}).url || "";
export const logoMarca = (m, fonte = 0) => logoDoSite(m.site, fonte);

// Lembra qual fonte deu certo para cada site (assim não testa tudo de novo a cada tela)
const CHAVE_FONTE = "agenda-logos-fonte";
let memoria = null;
const lerMemoria = () => { if (!memoria) { try { memoria = JSON.parse(localStorage.getItem(CHAVE_FONTE) || "{}"); } catch (e) { memoria = {}; } } return memoria; };
export function fonteLembrada(site) {
  const r = lerMemoria()[site]; if (!r) return undefined;
  const [i, quando] = r, idade = Date.now() - quando;
  if (i < 0 ? idade > 3 * 864e5 : idade > 30 * 864e5) return undefined; // "sem logo" é testado de novo a cada 3 dias
  return i;
}
let gravando = null;
export function lembrarFonte(site, i) {
  if (i < 0 && typeof navigator !== "undefined" && navigator.onLine === false) return; // sem internet não é "sem logo"
  const m = lerMemoria(); if (m[site] && m[site][0] === i) return;
  m[site] = [i, Date.now()];
  clearTimeout(gravando); gravando = setTimeout(() => { try { localStorage.setItem(CHAVE_FONTE, JSON.stringify(m)); } catch (e) {} }, 400);
}

// Iniciais e cor da empresa (para quando não há logo)
const IGNORAR = new Set("super supermercado supermercados mercado farmacia farmacias drogaria drogarias banco de do da dos das e o a loja lojas grupo rede atacadista".split(" "));
const CORES_MONO = ["#E4572E", "#2B7FFF", "#17A673", "#8E5CF6", "#F29E1F", "#D63384", "#0EA5B7", "#5B6B8C"];
export function monograma(nome) {
  const ws = normalizar(nome).split(" ").filter(w => w && !IGNORAR.has(w));
  const base = ws.length ? ws : normalizar(nome).split(" ").filter(Boolean);
  const ini = ((base[0] || "?")[0] + (base[1] ? base[1][0] : "")).toUpperCase();
  let h = 0; for (const ch of normalizar(nome)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { ini, cor: CORES_MONO[h % CORES_MONO.length] };
}

/* ---------- parecido com: distância de edição (aceita uma letra trocada, faltando, sobrando ou invertida) ---------- */
function distancia(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let d0 = new Array(n + 1), d1 = new Array(n + 1), d2 = new Array(n + 1);
  for (let j = 0; j <= n; j++) d1[j] = j;
  for (let i = 1; i <= m; i++) {
    d2[0] = i; let menor = d2[0];
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d1[j] + 1, d2[j - 1] + 1, d1[j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d0[j - 2] + 1);
      d2[j] = v; if (v < menor) menor = v;
    }
    if (menor > max) return max + 1;
    [d0, d1, d2] = [d1, d2, d0];
  }
  return d1[n];
}
const tolerancia = len => (len <= 3 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3);
// palavras comuns que não podem virar marca por engano ("mercado" não é "Mercadão")
const COMUNS = new Set("mercado mercados supermercado supermercados super atacado atacadista atacadistas farmacia farmacias drogaria drogarias posto postos loja lojas casa conta contas banco cartao padaria restaurante lanchonete academia escola curso internet energia agua luz gas aluguel hiper mini mais menos gastei paguei comprei hoje ontem reais real pix caixa light nacional mundial formosa lider pinheiro planalto unidas movida decolar original natural".split(" "));

// Pontua o quanto o texto digitado combina com uma marca (0 a 100)
function pontuar(q, m) {
  const nome = normalizar(m.nome);
  const alvos = [nome, ...m.apelidos];
  let melhor = 0;
  const palavrasQ = q.split(" ").filter(w => w.length >= 3 && !COMUNS.has(w));
  for (const a of alvos) {
    if (!a) continue;
    let p = 0;
    if (a === q) p = 100;
    else if (a.startsWith(q) && q.length >= 2) p = 92 - Math.min(12, a.length - q.length);
    else if (q.length >= 2 && a.split(" ").some(w => w.startsWith(q))) p = 80;
    else if (a.length >= 4 && (" " + q + " ").includes(" " + a + " ")) p = 86; // "conta da copel" contém "copel"
    else {
      const tol = tolerancia(q.length);
      if (tol > 0) {
        const d = distancia(q, a, tol);
        if (d <= tol) p = 74 - d * 8;
        else if (q.length >= 4 && a.length > q.length) {
          const dp = distancia(q, a.slice(0, q.length), 1); // começo com erro: "carref" ~ "carrefour"
          if (dp <= 1) p = 64;
        }
      }
      if (!p) for (const w of palavrasQ) for (const wa of a.split(" ")) {
        if (wa.length < 5 || w.length < 5) continue;
        const tw = Math.max(1, tolerancia(Math.min(w.length, wa.length)) - 1); // palavra a palavra: mais rigoroso
        if (distancia(w, wa, tw) <= tw) p = Math.max(p, 58);
      }
    }
    if (p > melhor) melhor = p;
  }
  return melhor;
}

// Sugestões enquanto digita: as marcas mais parecidas, da mais provável para a menos
export function buscarMarcas(texto, limite = 6) {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  const res = [];
  for (const m of MARCAS) { const p = pontuar(q, m); if (p >= 55) res.push({ m, p }); }
  res.sort((a, b) => b.p - a.p || a.m.ordem - b.m.ordem);
  const vistos = new Set(); const out = [];
  for (const r of res) { if (vistos.has(r.m.id)) continue; vistos.add(r.m.id); out.push(r); if (out.length >= limite) break; }
  return out;
}

// Acha a marca citada numa frase ("gastei 30 no carrefuor"): primeiro pelo nome exato, depois tolerando erro de digitação
export function acharMarca(frase) {
  const t = " " + normalizar(frase) + " ";
  let melhor = null, pos = 1e9;
  for (const m of MARCAS) for (const re of m.re) {
    const r = t.match(re);
    if (r && r.index < pos) { pos = r.index; melhor = m; }
  }
  if (melhor) return melhor;
  // tolerante: compara cada palavra (e pares de palavras) com os nomes, ignorando palavras comuns
  const palavras = t.trim().split(" ").filter(w => w && !/^\d/.test(w));
  const pedacos = [];
  palavras.forEach((w, i) => { if (w.length >= 5 && !COMUNS.has(w)) pedacos.push(w); if (i < palavras.length - 1 && !COMUNS.has(w) && !COMUNS.has(palavras[i + 1])) pedacos.push(w + " " + palavras[i + 1]); });
  let achou = null, nota = 0;
  for (const p of pedacos) for (const m of MARCAS) {
    for (const a of [normalizar(m.nome), ...m.apelidos]) {
      if (a.length < 5 || COMUNS.has(a) || Math.abs(a.length - p.length) > 2) continue;
      const tol = a.length <= 7 ? 1 : 2;
      const d = distancia(p, a, tol);
      if (d <= tol && 10 - d > nota) { nota = 10 - d; achou = m; }
    }
  }
  return achou;
}

// Para empresas fora da lista: palpites de site a partir do nome ("Padaria Pão Quente" -> padariapaoquente.com.br)
export function palpitesDeSite(texto) {
  const q = normalizar(texto).replace(/\b(conta|da|do|de|na|no|em)\b/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 3) return [];
  const junto = q.replace(/\s+/g, ""), hifen = q.replace(/\s+/g, "-");
  const out = [`${junto}.com.br`, `${junto}.com`];
  if (hifen !== junto) out.push(`${hifen}.com.br`);
  return out.filter((s, i, a) => /^[a-z0-9-]+\.[a-z.]+$/.test(s) && a.indexOf(s) === i).slice(0, 3);
}
