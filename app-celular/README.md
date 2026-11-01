# Avina no celular

O app do Avina para iPhone e Android, feito com Expo (SDK 58). O plano completo está em [PLANO.md](PLANO.md).

## Como funciona

O app tem **tudo o que o site tem**, porque leva dentro o próprio Avina do site (`../src`), e põe por cima os
recursos do celular.

- **A cópia do Avina:** `npm run build:celular` (na pasta de cima) monta o site num HTML só
  (`../vite.celular.config.js` e `../scripts/montar-celular.mjs`) em `assets/site/`. Ela vai dentro do app e abre até
  sem internet. Esse arquivo é gerado: o `ligar-celular.sh` e a compilação na nuvem (EAS) montam de novo.
- **Atualiza sozinho:** cada publicação do site também sai em `app.avina.com.br/celular/`. O app baixa a versão nova
  e abre com ela depois (`src/lib/site.ts`). Correção no site chega ao app sem esperar a loja.
- **O motor:** `src/components/camada-web.tsx` abre o HTML numa WebView como se fosse `https://app.avina.com.br/`,
  então login, nuvem e servidor funcionam igual ao site. Ela fica sempre montada, atrás das telas nativas, e vem para
  a frente no login e nas áreas que ainda não têm tela nativa (consultório, loja). Links de fora abrem fora.
- **As telas nativas** (`src/app/`): Início com cartões que a pessoa escolhe (`/widgets`), Atividades, detalhe e
  anotar lançamento, chat da Bolinha, Bancos (Open Finance), Perfil, gastos por categoria, posto mais barato e Contas
  fixas (`/contas`, com o detalhe `/conta/[id]` e a edição `/conta/editar`). Contas fixas, Transporte e Nossa casa só
  abrem nativas quando o site diz que atende (`Estado.recursos`); senão, os atalhos abrem no site.
  Elas leem o retrato dos dados que o site manda e pedem as ações ao site (`src/lib/motor.ts`: `useEstado`,
  `pedirSite`, `abrirNoSite`). Peças de tela em `src/components/ui`, gráficos em `src/components/graficos`.
- **Prévia no navegador:** os arquivos `*.web.ts(x)` trocam a WebView por dados de exemplo
  (`src/lib/exemplo.web.ts`), para ver as telas nativas no navegador e tirar prints (`npx expo export --platform web`).
- **A ponte:** `src/lib/ponte.ts` (lado do app) e `../src/app-nativo.js` (lado do site). O site pede ao celular:
  vibrar, avisos, Face ID, confirmar, abrir uma tela nativa. A ponte também troca a localização, o Compartilhar
  e os arquivos baixados pelos do celular.
- **No site, `noApp`** (de `../src/app-nativo.js`) liga o que muda dentro do app:
  - Sem preço, plano para escolher, pagamento ou código de acesso (regra da Apple e do Google).
  - Avisos agendados no próprio celular.
  - Bloqueio do app no Perfil.
  - Pedido de permissão antes de usar a IA.

  Fora do app, `noApp` é falso e o site segue igual.
- **Recursos nativos:**
  - Face ID e capa de privacidade: `src/components/trava.tsx` e `src/lib/trava.ts`.
  - Avisos: `src/lib/avisos.ts`.
  - Tela nativa do posto mais barato: `src/app/postos.tsx`, que usa a lógica do site por `@site/postos.js`.
  - Abertura animada (o nome "avina" se desenhando, igual ao PWA): `src/components/abertura.tsx`.

## Testar

- No celular: `bash ligar-celular.sh --tunnel` (na pasta de cima) e leia o QR code com o Expo Go. Se o Expo Go
  estiver logado numa conta, o computador precisa estar logado na mesma (`npx expo login`).
- No computador, antes de dar como pronto, dentro desta pasta:
  - `npx tsc --noEmit`
  - `npx eslint src`
  - `npx expo-doctor`
  - `npx expo export --platform ios --platform android`
- O site dentro do app dá para testar no navegador: abra `assets/site/avina.html` como se fosse
  `https://app.avina.com.br/` e defina um `window.AvinaApp` falso antes de carregar.
