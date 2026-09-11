/**
 * Ornamentos vetoriais da moldura. Tudo é gerado como SVG (nunca Canvas),
 * para o PDF continuar 100% vetorial: nítido em qualquer zoom.
 */
import { PAGE_HEIGHT_MM, PAGE_WIDTH_MM, PALETTE, U } from './palette';

/** Arredonda para 2 casas: reduz o tamanho do SVG sem perda visível. */
export const fmt = (value: number): string =>
  (Math.round(value * 100) / 100).toString();

/** Polígono em estrela (usado no brasão, na roseta serrilhada e no centro do selo). */
export function starPoints(
  cx: number,
  cy: number,
  points: number,
  outerRadius: number,
  innerRadius: number,
  rotation = -Math.PI / 2,
): string {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotation + (Math.PI * i) / points;
    return `${fmt(cx + radius * Math.cos(angle))},${fmt(cy + radius * Math.sin(angle))}`;
  }).join(' ');
}

/** Hipotrocoide (a curva do espirógrafo): rosáceas da marca d'água e dos cantos. */
export function hypotrochoidPath(options: {
  cx: number;
  cy: number;
  R: number;
  r: number;
  d: number;
  scale: number;
  turns: number;
  steps?: number;
}): string {
  const { cx, cy, R, r, d, scale, turns, steps = 1400 } = options;
  let path = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    path += `${i ? 'L' : 'M'}${fmt(cx + x * scale)} ${fmt(cy + y * scale)}`;
  }
  return path;
}

/**
 * Faixa guilloché: ondas senoidais defasadas percorrendo o perímetro da folha.
 * Cada onda vira um path; o entrelaçamento vem da diferença de fase.
 */
export function guillocheWavePaths(options: {
  outerInset: number;
  innerInset: number;
  waves: number;
  wavelength: number;
  step: number;
}): string[] {
  const mid = (options.outerInset + options.innerInset) / 2;
  const amplitude = ((options.innerInset - options.outerInset) / 2) * 0.82;
  const x0 = mid;
  const y0 = mid;
  const x1 = PAGE_WIDTH_MM - mid;
  const y1 = PAGE_HEIGHT_MM - mid;
  const width = x1 - x0;
  const height = y1 - y0;
  const perimeter = 2 * (width + height);
  const cycles = Math.round(perimeter / options.wavelength);
  const steps = Math.ceil(perimeter / options.step);

  /** Ponto no perímetro e a normal apontando para dentro da folha. */
  const pointAt = (s: number): [number, number, number, number] => {
    if (s < width) return [x0 + s, y0, 0, 1];
    if (s < width + height) return [x1, y0 + (s - width), -1, 0];
    if (s < 2 * width + height) return [x1 - (s - width - height), y1, 0, -1];
    return [x0, y1 - (s - 2 * width - height), 1, 0];
  };

  return Array.from({ length: options.waves }, (_, wave) => {
    const phase = (wave * Math.PI * 2) / options.waves;
    let path = '';
    for (let k = 0; k <= steps; k++) {
      const s = (k / steps) * perimeter;
      const [x, y, nx, ny] = pointAt(s);
      const offset =
        amplitude * Math.sin((2 * Math.PI * cycles * s) / perimeter + phase);
      path += `${k ? 'L' : 'M'}${fmt(x + nx * offset)} ${fmt(y + ny * offset)}`;
    }
    return path;
  });
}

/** Moldura completa da folha: filetes, faixa guilloché, rosáceas nos cantos e marca d'água opcional. */
export function frameSvg(options: { watermark: boolean }): string {
  const outerInset = 2.6 * U;
  const innerInset = 5.4 * U;
  const mid = (outerInset + innerInset) / 2;

  const rect = (inset: number, stroke: string, width: number) =>
    `<rect x="${fmt(inset)}" y="${fmt(inset)}" width="${fmt(PAGE_WIDTH_MM - 2 * inset)}" height="${fmt(PAGE_HEIGHT_MM - 2 * inset)}" fill="none" stroke="${stroke}" stroke-width="${fmt(width)}"/>`;

  const waves = guillocheWavePaths({
    outerInset,
    innerInset,
    waves: 6,
    wavelength: 2.4 * U,
    step: 0.3 * U,
  })
    .map((d, i) =>
      i % 2
        ? `<path d="${d}" fill="none" stroke="${PALETTE.navy}" stroke-opacity="0.45" stroke-width="${fmt(0.06 * U)}"/>`
        : `<path d="${d}" fill="none" stroke="${PALETTE.gold}" stroke-opacity="0.75" stroke-width="${fmt(0.06 * U)}"/>`,
    )
    .join('');

  const corners = [
    [mid, mid],
    [PAGE_WIDTH_MM - mid, mid],
    [PAGE_WIDTH_MM - mid, PAGE_HEIGHT_MM - mid],
    [mid, PAGE_HEIGHT_MM - mid],
  ]
    .map(
      ([cx, cy]) =>
        // O círculo cor de papel cobre a emenda das ondas nos cantos
        `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(2.3 * U)}" fill="${PALETTE.paper}" stroke="${PALETTE.navy}" stroke-width="${fmt(0.1 * U)}"/>` +
        `<path d="${hypotrochoidPath({ cx, cy, R: 5, r: 2, d: 2.6, scale: 0.36 * U, turns: 2, steps: 360 })}" fill="none" stroke="${PALETTE.gold}" stroke-width="${fmt(0.06 * U)}"/>`,
    )
    .join('');

  const watermark = options.watermark
    ? `<path d="${hypotrochoidPath({ cx: PAGE_WIDTH_MM / 2, cy: PAGE_HEIGHT_MM / 2, R: 7, r: 3, d: 4.6, scale: 2.6 * U, turns: 3 })}" fill="none" stroke="${PALETTE.gold}" stroke-opacity="0.12" stroke-width="${fmt(0.05 * U)}"/>` +
      `<path d="${hypotrochoidPath({ cx: PAGE_WIDTH_MM / 2, cy: PAGE_HEIGHT_MM / 2, R: 11, r: 4, d: 3.2, scale: 2.2 * U, turns: 4 })}" fill="none" stroke="${PALETTE.navy}" stroke-opacity="0.06" stroke-width="${fmt(0.05 * U)}"/>`
    : '';

  return (
    `<svg class="frame" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_WIDTH_MM} ${PAGE_HEIGHT_MM}" aria-hidden="true">` +
    watermark +
    rect(outerInset - 0.5 * U, PALETTE.navy, 0.22 * U) +
    waves +
    rect(innerInset + 0.5 * U, PALETTE.navy, 0.1 * U) +
    rect(innerInset + 0.9 * U, PALETTE.gold, 0.08 * U) +
    corners +
    `</svg>`
  );
}
