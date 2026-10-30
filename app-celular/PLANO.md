# Avina no celular: o plano

App nativo para iPhone e Android, feito com Expo (SDK 58). Usa o mesmo login, os mesmos dados (Supabase) e o mesmo
servidor do site. O site (PWA) continua igual e recebe as melhorias que fizerem sentido lá também.

- Pasta: `app-celular/` (este repositório). Telas em `src/app/` (Expo Router).
- **Tudo o que o site tem, no app:** o app leva dentro o próprio Avina do site (montado num HTML só, que abre até sem
  internet) e põe por cima os recursos do celular. Corrigiu no site, corrigiu no app: cada publicação do site também
  sai em `app.avina.com.br/celular/` e o app se atualiza sozinho, sem esperar a loja. Detalhes no [README](README.md).
- As telas que ganham versão nativa (mais bonita e mais rápida) vão sendo trocadas uma a uma, começando pelo posto
  mais barato. O resto continua igual ao site até ganhar a sua.

## Onde estamos (30/10/2026)

- **Pronto:**
  - **Tudo do site dentro do app:** consultório, pessoal, loja, casa, transporte, Bolinha, Perfil e o mesmo login e
    os mesmos dados da nuvem.
  - **Face ID ou digital** para abrir (Perfil → Bloqueio do app). A tela fica escondida na lista de apps abertos.
  - **Avisos do próprio celular:** sessão, contas e resumo do dia, agendados no aparelho e funcionando sem internet.
  - **Vibração nativa, localização do celular, Compartilhar do celular** (o PDF do recibo vai direto para o WhatsApp
    ou para Arquivos) e links abrindo nos apps certos.
  - **Posto mais barato** em tela nativa, aberto pelo botão do Transporte.
  - **Regras das lojas aplicadas no app:**
    - Sem preço, plano para escolher, pagamento ou código.
    - Pedido de permissão antes de usar a IA.
    - "Excluir minha conta" no Perfil e a página `app.avina.com.br/excluir-conta/` (pedida pelo Google).
- **Testado:**
  - A cópia do site no navegador, como o app abre, nos dois modos: dentro do app e o PWA normal, que segue igual.
  - Tipos, lint e diagnóstico do Expo.
  - Montagem para iPhone e Android.
- **Falta testar num celular de verdade:** rode `bash ligar-celular.sh` e abra com o Expo Go.
- **Próximo:** barra de abas nativa com Liquid Glass, mais telas nativas (Início, agenda, gasto rápido), câmera
  nativa para QR e boleto e, com a conta da Apple, os widgets e a Ilha Dinâmica.

---

## 1. Para a Apple e o Google aprovarem de primeira

### 1.1 Pagamento: a regra que mais reprova app

O que as regras dizem hoje (outubro de 2026):

- **Apple 3.1.1**: liberar recursos pagos dentro do app exige a compra da Apple. **Código de acesso também é proibido**
  ("license keys"), então o "Tenho um código" não pode aparecer no app.
- **Apple 3.1.3(f)**: libera apps grátis que só dão acesso a um serviço pago na web, mas só para VoIP, armazenamento
  em nuvem, e-mail e hospedagem. O Avina não está nessa lista.
- **Brasil, desde 18/06/2026** (acordo da Apple com o Cade): é permitido colocar um link para pagar no site, **mas a
  Apple cobra comissão** sobre as vendas feitas por esse link (as fontes falam em cerca de 15%, ou 10% para quem
  fatura pouco), e a compra pela Apple tem que aparecer ao lado. Ou seja, o link para o site **não é grátis**.
- **Google Play**: o caminho é parecido, com links externos pagando taxa.

**Estratégia recomendada: o app como acesso ao Avina**

- O app é grátis. O plano grátis funciona inteiro nele: criar conta, 3 pacientes, 30 lançamentos por mês, casa, loja
  grátis.
- Quem assina no site entra no app e já usa o Pro, porque o plano vem da conta.
- **No app não existe**: preço, botão de assinar, link para pagar, código de acesso, nem frase do tipo "assine no
  site". A tela de plano só mostra a situação: "Pro Consultório · ativo até 12/12".
- Mensagens de limite são neutras: "O plano grátis tem até 3 pacientes ativos". Não falam em "assine".
- Quem assina pelo site não paga nenhuma taxa à Apple nem ao Google.

**Risco, sem rodeio:** a Apple pode pedir a compra pela Apple usando a regra 3.1.3(b). Muitos apps de trabalho passam
assim (Slack, Basecamp), mas não há garantia.

**Plano B, já previsto no código:** se pedirem, ligamos a assinatura pela loja **só dentro do app**, com o mesmo
preço. Apple e Google ficam com 15% apenas dessas vendas (programa de pequenas empresas). O site continua sem taxa.

No Google Play, app que só dá acesso ao que foi comprado fora é aceito, desde que não tenha link nem botão de compra.

### 1.2 O resto da lista da Apple e do Google

| Regra | Como o app cumpre |
|---|---|
| Excluir a conta dentro do app (Apple 5.1.1(v)) | Perfil → Excluir conta (cancela a assinatura antes, como no site). |
| Página de exclusão fora do app (Google) | Feita: `app.avina.com.br/excluir-conta/` (sai com a próxima publicação do site). |
| Login social exige "Entrar com a Apple" (4.8) | Só e-mail e senha: não precisa. Se um dia entrar o Google, entra a Apple junto. |
| IA de terceiros (5.1.2(i)) | Feito: antes da primeira vez (Bolinha, fala, foto de nota), o app avisa que vai para a IA da Cloudflare e pede "Permitir". |
| Não ser "um site dentro de um app" (4.2) | O Avina vai dentro do app (abre sem internet; não carrega o site da internet) e tem o que o site não tem: Face ID, avisos do aparelho, vibração, Compartilhar e tela nativa do posto. Antes de enviar: barra de abas nativa com Liquid Glass e mais telas nativas, para o revisor ver um app de celular de verdade. |
| Permissões | Só "enquanto usa o app" para a localização (o "sempre" o Google quase sempre recusa). Câmera, fotos, microfone e Face ID são pedidos na hora do uso, com texto claro em português. |
| Privacidade | A política já existe no site. Eu preparo as respostas dos "rótulos de privacidade" (Apple) e da "Segurança dos dados" (Google). |
| Conta para o revisor | Uma conta de teste com dados de exemplo e o Pro liberado, informada nas notas da revisão. |
| Criptografia | Só HTTPS: `ITSAppUsesNonExemptEncryption = false`, sem documentação extra. |
| Onde distribuir | Só no Brasil no começo. A União Europeia exige endereço e telefone públicos (DSA). |
| Google, conta pessoal nova | **Teste fechado com 12 pessoas por 14 dias seguidos** antes de publicar. Conta de empresa (CNPJ + D-U-N-S) não precisa. |
| Para todos | Ícone, prints de tela, textos da loja, classificação etária e link de suporte (WhatsApp). |

---

## 2. Custos

| O quê | Quanto | Para quê |
|---|---|---|
| Apple Developer | US$ 99 por ano | Instalar a versão de teste no iPhone, widgets, push, TestFlight e publicar |
| Google Play | US$ 25, uma vez só | Publicar no Android |
| Expo e EAS (compilar na nuvem) | Grátis | O Windows não compila app de iPhone. O EAS compila na nuvem, e o plano grátis tem um número limitado de compilações por mês. |
| Bibliotecas e APIs (Nota Paraná, ANP, CEP, clima...) | Grátis | |

Até pagar a Apple, dá para testar quase tudo no **Expo Go** (iPhone) e num APK no Android. Widgets e Ilha Dinâmica
só funcionam na versão compilada.

---

## 3. Visual

A base vem das referências que você mandou:

- Cartões pretos bem arredondados, números grandes e texto de apoio em cinza.
- Anéis de progresso (como o "PAI"), barrinhas por dia (como o "Energy Forecast"), chips e um botão de ação claro.
- **Liquid Glass** nativo no iPhone (iOS 26) na barra de abas, nos botões flutuantes e nas folhas. No Android, o
  Material com desfoque.
- Tema escuro e claro, com a cor de cada área: consultório, pessoal e loja.
- Animações com Reanimated: números que contam, anéis que enchem, cartões que entram em cascata, puxar para atualizar
  e vibração leve a cada toque.
- Fontes: as mesmas do app no site, Sora nos títulos e números e Manrope no texto.

---

## 4. Widgets (tela inicial, tela de bloqueio e Ilha Dinâmica)

Feitos com `expo-widgets`, que funciona no iPhone e no Android. Cada widget lê um resumo que o app grava sempre que
algo muda.

**Consultório**
- **Próxima sessão** (pequeno e médio): paciente, horário, "em 15 min" e, no médio, os botões "Chegou" e "Faltou"
  (interativos, iOS 17+). Inspirado no "Upcoming event".
- **Hoje no consultório** (médio): anel de sessões feitas do total, quanto entra hoje e quem falta pagar.
- **Recebido no mês** (médio): o valor grande e barrinhas por semana, como o "Energy Forecast".
- **Sessão em andamento (Live Activity)**: contagem dos 50 minutos na Ilha Dinâmica e na tela de bloqueio, com a barra
  enchendo, como o "Cybertruck charging".

**Pessoal**
- **Hoje · 30 out** (médio): gasto do dia, a próxima conta e anéis de cada categoria contra o teto, como o "PAI".
- **Próxima conta** (pequeno): nome, valor e "vence em 2 dias" (vermelho quando atrasada).
- **Combustível** (pequeno): etanol ou gasolina e o posto mais barato perto.
- **Lista de compras** (médio): os itens que faltam; tocar marca como comprado.
- **Saldo no banco** (Open Finance, quando estiver liberado para todos).

**Loja**
- **Caixa de hoje** (médio): vendas do dia, ticket médio e barrinhas por hora.
- **O que falta** (pequeno): os itens a repor.

**Tela de bloqueio** (circular e retangular): próxima sessão e gasto do dia.

---

## 5. Recursos do celular

- **Face ID e digital** para abrir o app (liga em Perfil). Ao trocar de app, a tela fica borrada para esconder
  valores e pacientes.
- **Localização** (só enquanto usa): posto mais barato, mercado mais barato e clima.
- **Câmera nativa**: QR da NFC-e, código de barras do boleto e foto de recibo.
- **"Abrir com Avina"**: PDF de fatura, boleto ou extrato vindo do WhatsApp ou do e-mail.
- **Avisos**: lembrete de sessão e de conta (no aparelho) e push do servidor.
- **Calendário e Contatos do iPhone**: exportar sessões e cadastrar paciente a partir de um contato, pedindo permissão
  só na hora.
- **Siri e Atalhos**: "Quanto gastei este mês?" (fase final).
- **Sem internet**: a mesma fila do site; salva no aparelho e envia quando a internet voltar.

---

## 6. Etapas

| Fase | O que entra |
|---|---|
| 0. Base | Projeto, visual, abas com vidro, login, Face ID, sincronização, Início com números reais e posto mais barato |
| 1. Pessoal | Gastos, contas, caixinhas, transporte, casa e lista de compras, câmera da nota |
| 2. Consultório | Agenda, pacientes, sessões, cobranças, recibos, link de agendamento |
| 3. Loja | Caixa, gastos, o que falta e resumo |
| 4. Widgets | Todos os widgets, a Live Activity da sessão e os avisos |
| 5. Lojas de apps | Contas Apple e Google, ícone, prints, textos, privacidade, teste fechado (12 pessoas por 14 dias), TestFlight e envio |

Cada fase termina testada e com commit. O site ganha junto o que fizer sentido (o posto mais barato já está lá).

---

## 7. O que preciso de você

1. **Conta Apple Developer** (US$ 99/ano, como pessoa física, com o seu nome) e **Google Play** (US$ 25), quando
   chegar a hora de testar widgets e publicar.
2. **Conta Expo** (grátis, expo.dev), para compilar na nuvem.
3. **12 pessoas com Gmail** para o teste fechado do Android.
4. Confirmar a estratégia de pagamento (seção 1.1) e se topa o plano B caso a Apple peça.
5. O nome na loja: "Avina" e um subtítulo, por exemplo "Agenda, consultório e dinheiro".
