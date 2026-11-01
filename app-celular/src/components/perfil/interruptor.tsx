// O interruptor do sistema (Switch) nas cores do Avina: trilho azul quando ligado, grafite quando desligado.
import { Switch } from 'react-native';

import { useCores } from '@/constants/theme';

// no navegador da prévia (react-native-web), a bolinha ligada tem cor própria; no celular, vale thumbColor
const BOLINHA_WEB = { activeThumbColor: '#FFFFFF' } as object;

export function Interruptor({ valor, aoMudar, rotulo, desativado }: { valor: boolean; aoMudar: (v: boolean) => void; rotulo: string; desativado?: boolean }) {
  const c = useCores();
  return (
    <Switch
      value={valor}
      onValueChange={aoMudar}
      disabled={desativado}
      trackColor={{ false: c.cartao3, true: c.azul }}
      ios_backgroundColor={c.cartao3}
      thumbColor="#FFFFFF"
      accessibilityLabel={rotulo}
      {...BOLINHA_WEB}
    />
  );
}
