// Prévia no navegador: não há Face ID nem SecureStore. O bloqueio fica sempre desligado (a capa da Trava some
// na hora) e ligar responde que não deu, como num aparelho sem rosto nem digital cadastrados.
const ouvintes = new Set<(ligado: boolean) => void>();

export const travaLigada = async () => false;
export const aoMudarTrava = (f: (ligado: boolean) => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

export async function estadoTrava() {
  return { disponivel: false, ligado: false, nome: 'Face ID' };
}

export async function autenticar(_motivo = 'Desbloquear o Avina') {
  return true;
}

export async function ligarTrava(_ligar: boolean): Promise<{ disponivel: boolean; ligado: boolean; nome: string }> {
  throw new Error('indisponivel');
}
