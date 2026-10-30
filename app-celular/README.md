# Avina no celular

O app nativo do Avina para iPhone e Android, feito com Expo (SDK 58). O plano completo está em [PLANO.md](PLANO.md).

- **Testar no celular:** na pasta de cima, `bash ligar-celular.sh`, depois leia o QR code com o Expo Go.
- **Telas:** `src/app/` (cada arquivo é uma tela; as abas ficam em `src/components/app-tabs.tsx`).
- **Lógica do site:** importada de `../src` com `@site/...` (por exemplo `@site/postos.js`). O `metro.config.js`
  faz esses arquivos usarem o React e as bibliotecas daqui.
- **Antes de dar como pronto:** `npx tsc --noEmit` e `npx expo-doctor`.
