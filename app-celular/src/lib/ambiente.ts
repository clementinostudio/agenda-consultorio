// O que a lógica do site (../src/*.js) espera encontrar e o celular não tem de fábrica.
// Este arquivo é o primeiro import do app (src/app/_layout.tsx).
import 'expo-sqlite/localStorage/install'; // localStorage guardado no SQLite do aparelho
import { inflateSync } from 'fflate';

// As planilhas da ANP são .xlsx (zip): o site descompacta com DecompressionStream, o celular com o fflate
(globalThis as { inflarZip?: (d: Uint8Array) => Uint8Array }).inflarZip = (d) => inflateSync(d);

// O mesmo servidor do site (src/App.jsx, AVISOS_URL_PADRAO)
export const SERVIDOR = 'https://agenda-avisos.alvena.workers.dev';
