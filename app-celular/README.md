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
- **A tela:** `src/app/index.tsx` abre o HTML numa WebView como se fosse `https://app.avina.com.br/`, então login,
  nuvem e servidor funcionam igual ao site. Links de fora abrem fora (WhatsApp, mapa, navegador do app).
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

## Testar

- No celular: `bash ligar-celular.sh` (na pasta de cima) e leia o QR code com o Expo Go.
- No computador, antes de dar como pronto, dentro desta pasta:
  - `npx tsc --noEmit`
  - `npx eslint src`
  - `npx expo-doctor`
  - `npx expo export --platform ios --platform android`
- O site dentro do app dá para testar no navegador: abra `assets/site/avina.html` como se fosse
  `https://app.avina.com.br/` e defina um `window.AvinaApp` falso antes de carregar.
