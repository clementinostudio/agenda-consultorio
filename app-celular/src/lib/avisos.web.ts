// Prévia no navegador: o expo-notifications não agenda nada no navegador. Mesmos nomes de lib/avisos.ts, respondendo
// como um aparelho que negou os avisos (as telas mostram o caminho "avisos desligados" e nada quebra).
export type Aviso = { t: number; titulo: string; corpo: string; tag?: string };
export type Permissao = 'ok' | 'permissao' | 'negado';

export async function permissao(_pedir: boolean): Promise<Permissao> {
  return 'negado';
}

export async function agendar(_avisos: Aviso[]): Promise<number> {
  throw new Error('permissao');
}

export const cancelar = async () => {};

export async function mostrar(_titulo: string, _corpo: string, _pedir: boolean, _atrasoMs = 0): Promise<string> {
  return 'negado';
}
