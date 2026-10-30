// Onde a pessoa está: só "enquanto usa o app" (o "sempre" o Google e a Apple não deixam passar sem um bom motivo)
import * as Location from 'expo-location';

export type Lugar = { lat: number; lon: number };

export async function lugarAgora(): Promise<Lugar | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    // o último lugar conhecido (até 10 min) responde na hora; sem ele, pergunta ao GPS
    const ultimo = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60e3, requiredAccuracy: 3000 });
    const p = ultimo ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: p.coords.latitude, lon: p.coords.longitude };
  } catch {
    return null;
  }
}
