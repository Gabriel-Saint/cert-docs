import { escapeHtml } from './escape-html';
import { PALETTE } from './palette';
import { starPoints } from './ornaments';

const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "Academia Horizonte" → "AH"; ignora conectivos como "de" e "da". */
export function institutionInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter((word) => word && !CONNECTORS.has(word.toLowerCase()))
    .map((word) => word[0].toUpperCase());
  return initials.slice(0, 3).join('') || '·';
}

/** Brasão circular com estrela de oito pontas e as iniciais da instituição. */
export function emblemSvg(institutionName: string): string {
  const initials = escapeHtml(institutionInitials(institutionName));
  const fontSize = initials.length > 2 ? 16 : 20;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">` +
    `<circle cx="50" cy="50" r="47" fill="none" stroke="${PALETTE.navy}" stroke-width="2.5"/>` +
    `<circle cx="50" cy="50" r="41" fill="none" stroke="${PALETTE.gold}" stroke-width="1.5"/>` +
    `<polygon points="${starPoints(50, 50, 8, 36, 30)}" fill="${PALETTE.gold}"/>` +
    `<text x="50" y="57" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="${fontSize}" fill="${PALETTE.navy}">${initials}</text>` +
    `</svg>`
  );
}

/**
 * Selo de diploma: roseta serrilhada dourada, texto circular, estrela ao centro e duas fitas.
 * O texto circular é esticado ou comprimido (textLength) para fechar a volta com qualquer nome.
 */
export function sealSvg(options: {
  institutionName: string;
  year: number;
}): string {
  const ringText = escapeHtml(
    `CERTIFICADO AUTÊNTICO · ${options.institutionName.toUpperCase()} · `,
  );
  const ringCircumference = 2 * Math.PI * 60;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="seal-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2dc92"/><stop offset="0.45" stop-color="#c9a44c"/><stop offset="1" stop-color="#8a6a24"/></linearGradient>` +
    `<linearGradient id="seal-gold-inner" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9cf7c"/><stop offset="1" stop-color="#a27e30"/></linearGradient>` +
    `<path id="seal-ring" d="M100,100 m-60,0 a60,60 0 1,1 120,0 a60,60 0 1,1 -120,0"/>` +
    `</defs>` +
    // fitas
    `<polygon points="78,150 58,246 76,232 92,248 104,158" fill="${PALETTE.wine}"/>` +
    `<polygon points="122,150 142,246 124,232 108,248 96,158" fill="${PALETTE.wineLight}"/>` +
    `<polyline points="78,150 58,246 76,232 92,248" fill="none" stroke="#c9a44c" stroke-width="2"/>` +
    `<polyline points="122,150 142,246 124,232 108,248" fill="none" stroke="#c9a44c" stroke-width="2"/>` +
    // roseta
    `<polygon points="${starPoints(100, 100, 40, 92, 83)}" fill="url(#seal-gold)" stroke="${PALETTE.goldShadow}" stroke-width="0.8"/>` +
    `<circle cx="100" cy="100" r="76" fill="none" stroke="${PALETTE.goldShadow}" stroke-width="1.5"/>` +
    `<circle cx="100" cy="100" r="72" fill="url(#seal-gold-inner)"/>` +
    `<circle cx="100" cy="100" r="47" fill="none" stroke="${PALETTE.goldShadow}" stroke-width="1.2"/>` +
    `<text font-family="Cinzel, serif" font-weight="700" font-size="10.5" fill="${PALETTE.goldEngraving}">` +
    `<textPath href="#seal-ring" textLength="${(ringCircumference * 0.97).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${ringText}</textPath>` +
    `</text>` +
    `<polygon points="${starPoints(100, 96, 5, 30, 12.5)}" fill="#fbf1cf" stroke="${PALETTE.goldShadow}" stroke-width="1.5"/>` +
    `<text x="100" y="138" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="11" letter-spacing="2" fill="${PALETTE.goldEngraving}">${options.year}</text>` +
    `</svg>`
  );
}
