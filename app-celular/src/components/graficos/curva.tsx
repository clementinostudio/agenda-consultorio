// Contas dos gráficos (sem tela): a curva suave que passa pelos pontos sem "inventar" picos, o comprimento dela
// (para o traço se desenhar) e os arcos da rosca e dos anéis.
import { useId } from 'react';

export type Ponto = { x: number; y: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

// Curva monotônica (Fritsch–Carlson): suave, mas nunca passa acima/abaixo dos valores de verdade
export function curvaSuave(p: Ponto[]): { d: string; comprimento: number } {
  const n = p.length;
  if (!n) return { d: '', comprimento: 0 };
  if (n === 1) return { d: `M${r2(p[0].x)} ${r2(p[0].y)}`, comprimento: 0 };
  const m: number[] = [], t: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { const dx = p[i + 1].x - p[i].x || 1e-6; m[i] = (p[i + 1].y - p[i].y) / dx; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${r2(p[0].x)} ${r2(p[0].y)}`, comprimento = 0;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1].x - p[i].x) / 3;
    const c1 = { x: p[i].x + h, y: p[i].y + t[i] * h }, c2 = { x: p[i + 1].x - h, y: p[i + 1].y - t[i + 1] * h };
    d += `C${r2(c1.x)} ${r2(c1.y)} ${r2(c2.x)} ${r2(c2.y)} ${r2(p[i + 1].x)} ${r2(p[i + 1].y)}`;
    comprimento += comprimentoBezier(p[i], c1, c2, p[i + 1]);
  }
  return { d, comprimento };
}

function comprimentoBezier(a: Ponto, b: Ponto, c: Ponto, d: Ponto) {
  let total = 0, px = a.x, py = a.y;
  for (let k = 1; k <= 10; k++) {
    const t = k / 10, u = 1 - t;
    const x = u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x;
    const y = u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y;
    total += Math.hypot(x - px, y - py); px = x; py = y;
  }
  return total;
}

// Arco de circunferência (ângulos em radianos, 0 = 3 horas, sentido horário)
export function arco(cx: number, cy: number, r: number, de: number, ate: number) {
  const x0 = cx + r * Math.cos(de), y0 = cy + r * Math.sin(de);
  const x1 = cx + r * Math.cos(ate), y1 = cy + r * Math.sin(ate);
  const grande = ate - de > Math.PI ? 1 : 0;
  return `M${r2(x0)} ${r2(y0)}A${r2(r)} ${r2(r)} 0 ${grande} 1 ${r2(x1)} ${r2(y1)}`;
}

// id único para os degradês do SVG (o useId do React tem caracteres que o url(#...) não aceita)
export function useIdSvg(prefixo: string) {
  return prefixo + useId().replace(/[^a-zA-Z0-9]/g, '');
}
