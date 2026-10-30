// Bloqueio do app com Face ID (ou digital). A escolha fica guardada no celular (SecureStore), e quem liga e desliga
// é o Perfil do Avina (Perfil → Bloqueio do app), pela ponte. A tela de bloqueio fica em components/trava.tsx.
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const K = 'avina-trava';
const ouvintes = new Set<(ligado: boolean) => void>();

export const travaLigada = async () => (await SecureStore.getItemAsync(K)) === '1';
export const aoMudarTrava = (f: (ligado: boolean) => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

export async function estadoTrava() {
  const [hw, cadastrado, tipos, ligado] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    travaLigada(),
  ]);
  const rosto = tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const nome = Platform.OS === 'ios' ? (rosto ? 'Face ID' : 'Touch ID') : (rosto && !tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ? 'o rosto' : 'a digital');
  return { disponivel: hw && cadastrado, ligado, nome };
}

export async function autenticar(motivo = 'Desbloquear o Avina') {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: motivo, cancelLabel: 'Cancelar', fallbackLabel: 'Usar o código' });
  return r.success;
}

export async function ligarTrava(ligar: boolean) {
  // para ligar ou desligar, confirma que é a pessoa dona do celular
  if (!(await autenticar(ligar ? 'Ligar o bloqueio do Avina' : 'Desligar o bloqueio do Avina'))) throw new Error('cancelou');
  await SecureStore.setItemAsync(K, ligar ? '1' : '0');
  ouvintes.forEach((f) => f(ligar));
  return estadoTrava();
}
