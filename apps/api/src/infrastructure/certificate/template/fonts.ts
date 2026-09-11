import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

interface FontFile {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  file: string;
}

/** Fontes dos pacotes @fontsource: nada é baixado da internet na hora de renderizar. */
const FONT_FILES: FontFile[] = [
  {
    family: 'Cinzel',
    weight: 500,
    style: 'normal',
    file: '@fontsource/cinzel/files/cinzel-latin-500-normal.woff2',
  },
  {
    family: 'Cinzel',
    weight: 700,
    style: 'normal',
    file: '@fontsource/cinzel/files/cinzel-latin-700-normal.woff2',
  },
  {
    family: 'EB Garamond',
    weight: 400,
    style: 'normal',
    file: '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2',
  },
  {
    family: 'EB Garamond',
    weight: 500,
    style: 'normal',
    file: '@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff2',
  },
  {
    family: 'EB Garamond',
    weight: 400,
    style: 'italic',
    file: '@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2',
  },
  {
    family: 'Pinyon Script',
    weight: 400,
    style: 'normal',
    file: '@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff2',
  },
  {
    family: 'IBM Plex Mono',
    weight: 400,
    style: 'normal',
    file: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
  },
  {
    family: 'IBM Plex Mono',
    weight: 500,
    style: 'normal',
    file: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
  },
];

let cachedFontFaces: string | undefined;

/**
 * Regras @font-face com as fontes embutidas como data URI.
 * A resolução parte do diretório atual (e não do bundle), por isso funciona igual
 * no webpack, nos testes e no container.
 */
export function loadFontFaces(): string {
  if (cachedFontFaces) return cachedFontFaces;

  const resolveFrom = createRequire(join(process.cwd(), 'package.json'));
  cachedFontFaces = FONT_FILES.map((font) => {
    const base64 = readFileSync(resolveFrom.resolve(font.file)).toString(
      'base64',
    );
    return `@font-face{font-family:'${font.family}';font-style:${font.style};font-weight:${font.weight};font-display:block;src:url(data:font/woff2;base64,${base64}) format('woff2');}`;
  }).join('\n');

  return cachedFontFaces;
}
