// Prévia no navegador (npx expo export --platform web): o mesmo que lib/ambiente.ts, sem o SQLite.
// O navegador já tem localStorage de fábrica; o resto que a lógica do site espera fica igual.
import { inflateSync } from 'fflate';

// As planilhas da ANP são .xlsx (zip): o site descompacta com DecompressionStream, aqui com o fflate (igual ao celular)
(globalThis as { inflarZip?: (d: Uint8Array) => Uint8Array }).inflarZip = (d) => inflateSync(d);

// O mesmo servidor do site (src/App.jsx, AVISOS_URL_PADRAO)
export const SERVIDOR = 'https://agenda-avisos.alvena.workers.dev';
