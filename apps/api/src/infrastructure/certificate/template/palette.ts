/** Cores do certificado. O papel é um objeto físico: não muda com tema. */
export const PALETTE = {
  paper: '#fbf7ee',
  paperEdge: '#efe5cf',
  navy: '#1b2a4a',
  inkBlue: '#22335c',
  bodyText: '#2a3550',
  mutedText: '#3c4764',
  footerText: '#45506a',
  gold: '#b08d3c',
  goldLight: '#e2c878',
  goldDeep: '#6f521a',
  goldShadow: '#7a5b1c',
  goldEngraving: '#5c4413',
  wine: '#6e1c27',
  wineLight: '#86242f',
} as const;

/** Folha A4 em paisagem, em milímetros. */
export const PAGE_WIDTH_MM = 297;
export const PAGE_HEIGHT_MM = 210;

/**
 * Unidade de layout herdada do protótipo aprovado: 1% da largura da folha.
 * Mantém as proporções do protótipo no PDF.
 */
export const U = PAGE_WIDTH_MM / 100;
