# Agenda do Consultório

App para profissionais da saúde mental (pensado para quem tem TDAH): agenda que se repete sozinha, cálculo de sublocação, cobrança automática por pacote, lembretes, modo Pessoal para os gastos da casa e muito mais. Feito com **Vite + React** e pronto para virar **PWA** (instala na tela inicial do celular e abre sem internet).

---

## Jeito mais fácil: só pelo terminal (Linux)

Não precisa de VS Code nem de outro editor. Abra o terminal dentro desta pasta e rode:

```bash
bash instalar.sh     # instala o Node (se faltar), as dependências e abre o app
bash publicar.sh     # sobe para o seu GitHub e publica no GitHub Pages
bash servidor-avisos/instalar-avisos.sh   # liga os avisos com o app fechado (uma vez só)
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
├── servidor-avisos/         ← servidor que manda os avisos com o app fechado (Cloudflare, grátis)
└── src/
    ├── main.jsx             ← liga o app, as fontes e o service worker
    ├── styles.css           ← todas as cores, tamanhos e o visual (claro, escuro e vidro)
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

**Ainda é demonstração:**
- **Login e dados ficam só no aparelho** (no `localStorage` do navegador). Trocar de celular ou limpar os dados do navegador apaga tudo, e a senha não tem proteção de verdade.

### Avisos com o app fechado (servidor-avisos)
O iPhone congela o app quando ele sai da tela, então quem avisa na hora certa é um servidorzinho grátis na Cloudflare. Ele recebe só a lista dos próximos avisos (horário + texto, sem nome de paciente por padrão) e dispara cada um no minuto certo, pelo padrão Web Push.

```bash
bash servidor-avisos/instalar-avisos.sh
```

O comando abre o navegador para você entrar na Cloudflare (crie a conta grátis se não tiver), publica o servidor e avisa o GitHub do endereço. Depois, no celular: abra o app pelo ícone → Ajustes → Avisos → **Ligar avisos com o app fechado** → Permitir. No iPhone precisa do iOS 16.4 ou mais novo e do app instalado na tela inicial. As chaves ficam em `servidor-avisos/.chaves.json`, que nunca vai para o GitHub (não apague: sem elas os aparelhos precisam ligar os avisos de novo).

### Falar (em qualquer tela)
Toque no microfone da barra de baixo e fale. Um degradê colorido sobe do pé da tela e tudo aparece ali embaixo, sem abrir janela. Usa o reconhecimento de voz do próprio aparelho, sem servidor.

- Gastos e entradas: "gastei 30 no uber", "comprei 120 na amazon e 54 e 90 no ifood", "recebi 200 de pix".
- Consultório: "Felipe veio", "Felipe veio e pagou", "a Ana faltou", "Júlia pagou", "remarca o Pedro pra quinta às 15h".
- Empresas conhecidas (Uber, 99, iFood, Netflix, Amazon, mercados, farmácias, postos, bancos...) entram com o nome certo, a categoria certa e a logo oficial, que vem do ícone do próprio site da empresa e fica guardada no aparelho. A lista fica em `MARCAS`, no `App.jsx`.
- Se o aparelho não liberar o reconhecimento (acontece em alguns iPhones com o app instalado), o app abre o teclado: toque no microfone do teclado e fale.

### Cara de app
- Tela de abertura própria no iPhone, sem zoom de pinça, sem seleção de texto nos botões, toque que afunda, troca de tela animada e painéis que fecham arrastando para baixo.
- No Android, o Chrome instala como app de verdade (aparece na lista de apps e a opção é "Desinstalar"), com fotos do app na janela de instalação.
- No iPhone, segurar o ícone sempre mostra "Remover Favorito": é o texto que o iOS usa para todo app instalado pelo Safari, e nenhum site consegue mudar.

### Próximo passo recomendado: Supabase (plano gratuito)
1. **Login de verdade** com e-mail e senha (Supabase Auth).
2. **Dados na nuvem**, sincronizados entre celular e computador, com cada conta vendo só os próprios dados (Row Level Security).

Nomes de pacientes, frequência de terapia e pagamentos são **dados pessoais sensíveis** pela LGPD. Antes de outras pessoas usarem o app, vale ter o login de verdade, os dados protegidos e uma política de privacidade simples.

---

## 6. Comandos úteis

| Comando | Para quê |
|---|---|
| `npm install` | instala as dependências |
| `npm run dev` | modo de desenvolvimento, recarrega a cada alteração |
| `npm run build` | gera a versão final em `dist/` |
| `npm run preview` | abre a versão final localmente |
