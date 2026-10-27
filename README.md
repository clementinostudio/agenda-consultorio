# Alvena

App para profissionais da saúde mental (pensado para quem tem TDAH): agenda que se repete sozinha, cálculo de sublocação, cobrança automática por pacote, lembretes, modo Pessoal para os gastos da casa e muito mais. Feito com **Vite + React** e pronto para virar **PWA** (instala na tela inicial do celular e abre sem internet).

---

## Jeito mais fácil: só pelo terminal (Linux)

Não precisa de VS Code nem de outro editor. Abra o terminal dentro desta pasta e rode:

```bash
bash instalar.sh     # instala o Node (se faltar), as dependências e abre o app
bash publicar.sh     # sobe para o seu GitHub e publica no GitHub Pages
bash servidor-avisos/instalar-avisos.sh   # liga os avisos com o app fechado (uma vez só)
bash conectar-nuvem.sh   # liga o banco de dados na nuvem (Supabase), uma vez só
```

- O `instalar.sh` deixa o app rodando em `http://localhost:5173`. Para parar, aperte `Ctrl + C`.
- O `publicar.sh` pede para você entrar no GitHub uma vez (mostra um código para colar no navegador). Depois cria o repositório, liga o GitHub Pages e mostra o endereço final. Quando mudar alguma coisa no app, é só rodar `bash publicar.sh` de novo.

Para editar sem abrir nada pesado no computador, abra o repositório no GitHub e aperte a tecla **.** (ponto). Isso abre um editor no próprio navegador (github.dev). Edite, salve com "Commit" e o app se publica sozinho. Pelo terminal, `nano src/App.jsx` também serve para mudanças rápidas.

---

## 1. Rodar no seu computador

Precisa ter o **Node.js 20 ou mais novo** instalado ([nodejs.org](https://nodejs.org)).

```bash
npm install      # instala as dependências (só na primeira vez)
npm run dev      # abre o app em http://localhost:5173
```

O comando `npm run dev` também mostra um endereço de rede (algo como `http://192.168.0.10:5173`). Abrindo esse endereço no celular, **na mesma rede Wi-Fi**, você testa direto no aparelho.

Para gerar a versão final:

```bash
npm run build    # cria a pasta dist/ com o app pronto
npm run preview  # abre essa versão final para conferir (com o modo offline funcionando)
```

> O modo offline e a instalação só funcionam na versão final (`build` + `preview`) ou publicada. No `npm run dev` o service worker fica desligado de propósito, para não atrapalhar enquanto você edita.

---

## 2. Colocar no GitHub e publicar (GitHub Pages, de graça)

1. Crie um repositório novo no GitHub (por exemplo `agenda-consultorio`).
2. No terminal, dentro desta pasta:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/agenda-consultorio.git
   git push -u origin main
   ```
3. No GitHub, abra o repositório → **Settings → Pages** → em **Build and deployment**, escolha **Source: GitHub Actions**.
4. Pronto. A cada `git push` na branch `main`, o arquivo `.github/workflows/deploy.yml` gera e publica o app sozinho. O endereço fica assim:
   `https://SEU-USUARIO.github.io/agenda-consultorio/`

Acompanhe a publicação na aba **Actions** do repositório (leva uns 2 minutos).

### Prefere Vercel ou Netlify?
Importe o repositório no site deles. Configuração: comando de build `npm run build`, pasta de saída `dist`. Não precisa mudar mais nada.

---

## 3. Instalar no celular

- **Android (Chrome):** abra o endereço do app → aparece "Instalar app" (ou menu ⋮ → **Instalar app**). Também há um botão **Instalar na tela inicial** em Ajustes, dentro do app.
- **iPhone (Safari):** abra o endereço → botão **Compartilhar** → **Adicionar à Tela de Início**. No iPhone, as notificações do sistema só funcionam com o app instalado assim (iOS 16.4 ou mais novo).

Segurando o ícone do app no Android aparecem atalhos: **Anotar gasto falando**, **Só o agora** e **Fechar o dia**. Os mesmos atalhos funcionam por link: `…/#gasto`, `…/#agora`, `…/#fechar`, `…/#livres` (dá para usar na Siri ou no Atalhos do iPhone).

---

## 4. Onde mexer

```
agenda-consultorio/
├── index.html               ← título, cor da barra do celular
├── vite.config.js           ← nome do app, ícones, atalhos e regras do modo offline (PWA)
├── public/
│   ├── icons/               ← ícones do app (troque pelos seus, mesmos nomes e tamanhos)
│   └── fundos/              ← imagens de fundo (cada uma tem a versão "-mini" para a miniatura)
├── servidor-avisos/         ← avisos com o app fechado + IA (fala, perguntas, fotos), Cloudflare grátis
├── supabase/migrations/     ← o banco de dados na nuvem (tabelas e regras de segurança)
└── src/
    ├── main.jsx             ← liga o app, as fontes e o service worker
    ├── styles.css           ← todas as cores, tamanhos e o visual (claro, escuro e vidro)
    ├── nuvem.js             ← login de verdade e sincronização com o Supabase
    ├── boleto.js            ← entende código de barras e linha digitável de boleto
    ├── extrato.js           ← lê o OFX/CSV exportado pelos bancos
    ├── telas/ferramentas.jsx ← telas de ler boleto e importar extrato
    └── App.jsx              ← o app inteiro, separado em seções numeradas
```

Dentro do `src/App.jsx`, procure por `====` para pular entre as seções. As mais úteis:

| Seção | O que tem |
|---|---|
| **1. CONFIGURAÇÃO** | duração padrão da sessão, frequências, cores dos pacientes, categorias de gastos, profissões |
| **3. REGRAS DO CONSULTÓRIO** | cálculo da sublocação, cobrança por pacote, texto da mensagem de cobrança, frases do resumo |
| **4. REGRAS DO MODO PESSOAL** | contas fixas, resumo do mês |
| **4b. FERIADOS, CLIMA, VOZ E AVISOS** | feriados, Open-Meteo, frases que viram gasto ("gastei 32 na padaria"), som dos avisos |
| **5. DADOS DE EXEMPLO** | o que aparece no botão "Só quero ver como funciona" |

As cores ficam no topo do `src/styles.css`, em variáveis como `--accent` (azul principal), `--mint`, `--amber` e `--rose`. Mudando ali, muda o app todo, nos dois temas.

Para adicionar um fundo novo: coloque `meu-fundo.jpg` e `meu-fundo-mini.jpg` em `public/fundos/` e acrescente `["meu-fundo", "Nome que aparece"]` na lista `FUNDOS` do `App.jsx`.

---

## 5. O que já funciona e o que é demonstração

**Funciona de verdade:**
- Tudo do app: agenda, cobranças, modo Pessoal, perguntas iniciais, fundos com vidro, temas claro e escuro.
- Abrir sem internet depois de instalado.
- Clima pela [Open-Meteo](https://open-meteo.com) e feriados pela [BrasilAPI](https://brasilapi.com.br), ambas gratuitas e sem chave. Sem internet, os feriados são calculados no próprio app.
- Voz pelo reconhecimento do próprio aparelho (sem servidor). Se o aparelho não liberar, o app abre o ditado do teclado.
- Notificações do celular **com o app fechado** ("Sessão em 15 min", "A luz vence amanhã", resumo do dia, fechar o dia), depois de ligar o servidor de avisos (veja abaixo). Teste em Ajustes → Avisos → Testar em 10 s.
- **Falar um gasto pelo microfone da barra de baixo**: começa a ouvir no toque, para sozinho quando você termina, mostra ao vivo o que entendeu (valor, categoria, data) e salva sozinho em 3 segundos, com Desfazer. Entende várias coisas numa frase ("gastei 30 no mercado e 12 de uber").
- Número de pendências no ícone do app, toque leve (háptico) no iPhone, tela acesa no "Só o agora".
- Tela cheia no iPhone com o app instalado (sem faixa preta embaixo).
- Foto de perfil e até 10 fundos próprios, com recorte (arrastar e zoom). Os fundos ficam guardados no aparelho.
- Vibração nos toques (só Android: o iPhone não deixa sites vibrarem).
- Planilha .csv do mês para o contador.
- **Teto do mês por categoria** (Gastos → toque numa categoria): aviso no celular em 80% e quando passa do teto.
- **Ler boleto** (Contas → ícone de código de barras): pela câmera, por foto/print ou colando a linha digitável. Valor e vencimento saem do próprio código (os dígitos verificadores são conferidos), sem internet. Vira conta fixa (com o código guardado para copiar) ou gasto já pago.
- **Importar extrato** (Gastos → Importar extrato): OFX ou CSV do Nubank, Inter, Itaú, Bradesco, BB, Caixa, C6... O arquivo é lido no aparelho. Reconhece as lojas, aprende as categorias que você já usou e desmarca o que já está no app, pagamento de fatura e aplicações.
- **Foto do comprovante** (ícone de câmera no novo gasto): a IA lê valor, loja e data. No Android, o Alvena também aparece no **Compartilhar** de outros apps (foto de comprovante ou código de boleto).
- **Perguntar ao Alvena** pela Bolinha ou pelo teclado: "quanto gastei de Uber em outubro?", "quem está me devendo?", "quem eu atendo amanhã?". Dá para ouvir a resposta.
- **Resumo da semana** no domingo às 20h (Ajustes → Avisos).
- **Conversa com a Bolinha:** perguntas viram um chat; ela responde falando (com a voz mais natural do aparelho: Google no Android, "Natural" no Edge, "Melhorada" no iPhone) e, se você perguntou falando, já escuta a próxima pergunta. Lembra do contexto ("e em setembro?"). Toque num balão para ouvir de novo; o botão de som desliga a fala. "Obrigado" ou "tchau" encerram.
- **Clima de verdade** (Open-Meteo): temperatura de agora, sensação, umidade, chuva hora a hora, mínima e máxima. Toque no clima do Início para ver tudo e, se quiser, usar a localização do aparelho (mais preciso que a cidade). Sem internet, mostra a última previsão real com o horário; nunca números inventados.
- **Conquistas** (Perfil → Conquistas): 24 conquistas em 6 trilhas (rotina, consultório, metas, dinheiro da casa, app e segurança), com nível, cartão da próxima conquista no Início e comemoração com confete. Celebram a rotina, não a quantidade de atendimentos. As regras ficam em `src/conquistas.js`.
- **Painéis como app nativo:** o voltar do Android fecha o painel aberto (e não o app), a tela de trás recua um pouco, a barra de status escurece junto e segue o tema escolhido no app, e dá para arrastar o painel para baixo de qualquer ponto quando ele está no topo.
- **Transporte** (aba própria no menu de baixo do modo Pessoal, com o fundo personalizado como as outras; também abre ao tocar em Transporte, em Gastos): o seu veículo no topo (carro sedã, compacto, foto sua, moto, bike ou "sem veículo"), quanto saiu no mês e nos últimos 6 meses, separado em combustível, apps, ônibus e metrô, manutenção, peças e melhorias, estacionamento e pedágio, IPVA/seguro/multas. **Abastecer** (litros e km) calcula o consumo real e o custo por km; **Manutenção** guarda o histórico e avisa a próxima troca de óleo; calculadora de viagem; **preço médio da semana na sua cidade** (planilha oficial da ANP, lida no aparelho) com "etanol ou gasolina?"; **valor FIPE** do carro (API pública parallelum, grátis). A lógica fica em `src/transporte.js`.
- **Ilustrações 3D** (`public/ilustras/`): troféu = conquistas e metas, dinheiro = caixinhas, arquivo = organização, cadeados = privacidade, café = rotina leve e dia livre, iPad = o app em qualquer tela.

**Banco de dados na nuvem (Supabase):** depois de rodar `bash conectar-nuvem.sh`, o login é de verdade e os dados ficam sincronizados entre celular e computador (veja abaixo). Sem isso, tudo fica só no aparelho, como antes.

### Avisos com o app fechado (servidor-avisos)
O iPhone congela o app quando ele sai da tela, então quem avisa na hora certa é um servidorzinho grátis na Cloudflare. Ele recebe só a lista dos próximos avisos (horário + texto, sem nome de paciente por padrão) e dispara cada um no minuto certo, pelo padrão Web Push.

```bash
bash servidor-avisos/instalar-avisos.sh
```

O comando abre o navegador para você entrar na Cloudflare (crie a conta grátis se não tiver), publica o servidor e avisa o GitHub do endereço. Depois, no celular: abra o app pelo ícone → Ajustes → Avisos → **Ligar avisos com o app fechado** → Permitir. No iPhone precisa do iOS 16.4 ou mais novo e do app instalado na tela inicial. As chaves ficam em `servidor-avisos/.chaves.json`, que nunca vai para o GitHub (não apague: sem elas os aparelhos precisam ligar os avisos de novo).

No Windows, se o PowerShell não achar o `bash`, rode pelo Git Bash: `& "C:\Program Files\Git\bin\bash.exe" servidor-avisos/instalar-avisos.sh`. Conta nova da Cloudflare: na primeira vez, rode `npx wrangler deploy` dentro de `servidor-avisos/` e responda **y** para criar o subdomínio `workers.dev`. Para publicar o servidor depois de mudar o `src/index.js`: `cd servidor-avisos && npx wrangler deploy` (o endereço do app fica em `vars`, no `wrangler.jsonc`).

O mesmo servidor faz a IA do app (fala, perguntas e fotos): rotas `/transcrever`, `/entender`, `/perguntar` e `/ler-imagem`.

**Quanto custa: nada.** Tudo roda no plano grátis da Cloudflare:
- Workers: 100 mil pedidos por dia. Os avisos usam cerca de 1.500 (uma conferência por minuto).
- KV (onde ficam os avisos): mil gravações por dia. O app só grava quando a lista de avisos muda.
- Workers AI: 10 mil "neurônios" por dia. Na prática, algo como 3 horas de fala, ou centenas de frases entendidas, ou dezenas de perguntas e fotos por dia.
- Na conta grátis, a Cloudflare não cobra nada: quando a cota do dia acaba, a IA só para de responder até o dia seguinte (o app avisa e continua funcionando sem ela). Não cadastre cartão nem mude para o plano pago (Workers Paid) se quiser manter assim.
- O leitor de código de barras (zxing-wasm) é de código aberto (licença MIT) e vem junto com o app.

### Falar (em qualquer tela)
**Fala pelo servidor (o jeito mais confiável):** com o servidor de avisos instalado (`bash servidor-avisos/instalar-avisos.sh`), o próprio app grava o que você fala, percebe sozinho quando você parou, corta o silêncio e manda um áudio curtinho para o **seu** servidor na Cloudflare, que transcreve com o Whisper (Workers AI, dentro da cota grátis diária). Funciona igual no iPhone com o app instalado e no Android. O áudio não fica guardado; vão junto só os primeiros nomes dos pacientes e os nomes das lojas que você mais usa, para o Whisper acertar a grafia. Sem o servidor, o app usa o reconhecimento do próprio aparelho.

Como a fala ficou mais confiável:
- O barulho do ambiente é medido pelo menor volume (quem já começa falando não engana a medida) e acompanha o ambiente; o fim das palavras não é cortado.
- Frase curta ("gastei…") espera 2,1 s pela continuação; frase longa encerra com 1,5 s de silêncio.
- O áudio é convertido para 16 kHz com o conversor do próprio navegador (voz mais limpa para o Whisper), e o Whisper descarta o que não é voz (sem "Se inscreva no canal" inventado no silêncio).
- Se faltar um pedaço ("gastei no uber"), o microfone reabre sozinho uma vez para você completar. O microfone fica aberto mais 12 s depois de cada frase: completar não pede permissão de novo.
- Se a rede piscar, o envio tenta de novo sozinho.
- Quando o app não entende a frase sozinho (ou o resultado parece chute), a IA do seu servidor entende: "torrei 45 conto no boteco ontem", "dei vinte pila pro flanelinha e quinze na padoca". Perguntas viram resposta.
- "Cento e oitenta e dois e quarenta" agora é R$ 182,40 (antes virava 222).

Toque no microfone da barra de baixo e fale. Um degradê colorido sobe do pé da tela e tudo aparece ali embaixo, sem abrir janela. Usa o reconhecimento de voz do próprio aparelho, sem servidor.

- Gastos e entradas: "gastei 30 no uber", "comprei 120 na amazon e 54 e 90 no ifood", "recebi 200 de pix".
- Consultório: "Felipe veio", "Felipe veio e pagou", "a Ana faltou", "Júlia pagou", "remarca o Pedro pra quinta às 15h".
- Empresas conhecidas (Uber, 99, iFood, Netflix, Amazon, mercados, farmácias, postos, bancos...) entram com o nome certo, a categoria certa e a logo oficial, que vem do ícone do próprio site da empresa e fica guardada no aparelho. A lista fica em `MARCAS`, no `App.jsx`.
- Se o aparelho não liberar o reconhecimento (acontece em alguns iPhones com o app instalado), o app abre o teclado: toque no microfone do teclado e fale.
- Pode pausar no meio da frase. Toque na Bolinha para terminar na hora.
- Se faltar algo ("gastei no uber"), toque em **Completar falando** e diga só o que faltou ("30").
- Cada toque é uma tentativa nova: o microfone nunca fica travado. O teclado só entra quando o aparelho nega o microfone.
- Em Perfil → Aparência e fundo dá para desligar o **Efeito de vidro** (tudo fica sólido, a foto de fundo continua atrás).

### Página de apresentação (landing page)
Fica em `sobre/index.html` e é publicada junto com o app: `https://SEU-USUARIO.github.io/agenda-consultorio/sobre/`. Quem abre o endereço do app sem estar logado (pelo navegador) cai primeiro nela; quem já está logado ou abre pelo app instalado vai direto para o app. Os botões dela levam para `#criar` (criar conta), `#entrar` (entrar) e `#demo` (ver a demonstração). Os textos estão direto no HTML; o visual fica em `src/landing.css` e as animações (abas, acordeão, demonstração da fala, iPhone que inclina com o mouse) em `src/landing.js`, sem bibliotecas. As telas do app que aparecem dentro do iPhone ficam em `public/landing/`.

### Cara de app
- Bolinha, o mascote do microfone: uma bola minimalista com dois olhinhos que flutua, pisca, olha em volta, faz caras sozinha, reage à sua voz, fica feliz quando entende e confusa quando não entende.
- Barra de baixo preta, fixa e minimalista (sem vidro e sem sumir ao rolar): ícones com o nome embaixo e a Bolinha como botão de falar.
- Painéis abrem e fecham deslizando (também com um peteleco para baixo) e apagar qualquer coisa abre uma janela de confirmação clara, com Cancelar e a ação.
- Telas entram com fade e uma subida curta em cascata; ao falar, uma aurora de cores flui no pé da tela (no computador, passando por trás da barra lateral, com a Bolinha no canto).
- Puxe a tela para baixo no topo para recarregar (clima, feriados, avisos e versão nova do app).
- Vidro líquido no estilo do iOS 26: quase transparente, desfoque leve com saturação e brilho, linha finíssima e reflexos de luz nas quinas, sem granulado nem contorno grosso.
- Tela de abertura própria no iPhone, sem zoom de pinça, sem seleção de texto nos botões, toque que afunda, troca de tela animada e painéis que fecham arrastando para baixo.
- No Android, o Chrome instala como app de verdade (aparece na lista de apps e a opção é "Desinstalar"), com fotos do app na janela de instalação.
- No iPhone, segurar o ícone sempre mostra "Remover Favorito": é o texto que o iOS usa para todo app instalado pelo Safari, e nenhum site consegue mudar.

### Banco de dados na nuvem (Supabase, plano grátis)
```bash
bash conectar-nuvem.sh
```
O script pede o endereço e a chave **publishable** do projeto (Project Settings → API Keys), cria as tabelas, confere a conexão e guarda tudo em `.env.local` (que não vai para o GitHub). O endereço e a chave pública também vão para `.env.production`, que sobe para o GitHub: é com ele que o app publicado usa a nuvem (rode `bash publicar.sh`). Só a chave publishable pode ficar ali, nunca a secret.

Como funciona:
- **Login de verdade** (Supabase Auth), com "Esqueci a senha". Quem já tinha conta só no aparelho entra com a senha de sempre e os dados vão junto para a nuvem.
- **Funciona primeiro no aparelho:** abre na hora e salva sem internet. Cada mudança (um paciente, uma sessão, um gasto) sobe sozinha; sem internet, fica numa fila e sobe quando a conexão volta.
- **Tempo real:** o que muda no celular aparece no computador na hora.
- **Segurança:** Row Level Security em todas as tabelas, e cada conta só enxerga as próprias linhas. A chave que vai no app é a pública; a secreta nunca entra no app.
- Em Perfil aparece a situação ("Tudo salvo na nuvem", "Sem internet · 3 mudanças guardadas aqui") e o botão **Excluir minha conta**, que apaga login e dados de vez (LGPD).
- Ao sair da conta, a cópia do aparelho é apagada se tudo já estiver na nuvem.
- Os fundos de tela que você sobe ficam só no aparelho; o resto (inclusive foto de perfil) vai para a nuvem.

O banco fica em `supabase/migrations/` (tabelas `perfis` e `itens`), e a sincronização em `src/nuvem.js`.

**E-mails:** a conta é criada sem precisar confirmar e-mail (Confirm email desligado, junto com os endereços do app, em `supabase/config.toml`; para mandar de novo ao projeto: `npx supabase config push`). O envio de e-mail grátis do Supabase só chega para quem é da equipe do projeto, então o "Esqueci a senha" precisa de um SMTP próprio (Resend tem plano grátis) em Authentication → Emails → SMTP.

Nomes de pacientes, frequência de terapia e pagamentos são **dados pessoais sensíveis** pela LGPD. Antes de outras pessoas usarem o app, vale ter uma política de privacidade simples.

---

## 6. Comandos úteis

| Comando | Para quê |
|---|---|
| `npm install` | instala as dependências |
| `npm run dev` | modo de desenvolvimento, recarrega a cada alteração |
| `npm run build` | gera a versão final em `dist/` |
| `npm run preview` | abre a versão final localmente |
