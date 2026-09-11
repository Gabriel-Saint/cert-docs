import { PAGE_HEIGHT_MM, PAGE_WIDTH_MM, PALETTE, U } from './palette';

/** Converte a unidade do protótipo (1% da largura) em milímetros. */
const u = (value: number): string => `${(value * U).toFixed(3)}mm`;

/**
 * Sem box-shadow, filter ou blur: esses efeitos são rasterizados pelo Chromium no PDF.
 * Gradientes, bordas, SVG e texto continuam vetoriais.
 */
export const CERTIFICATE_STYLES = `
@page { size: ${PAGE_WIDTH_MM}mm ${PAGE_HEIGHT_MM}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: ${PALETTE.navy}; }

.page {
  position: relative; width: ${PAGE_WIDTH_MM}mm; height: ${PAGE_HEIGHT_MM}mm; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 45%, ${PALETTE.paper} 55%, ${PALETTE.paperEdge} 100%);
  break-after: page;
}
.page:last-child { break-after: auto; }
.frame { position: absolute; inset: 0; width: 100%; height: 100%; }

/* ---------- Frente ---------- */
.front-body {
  position: absolute; inset: ${u(7.2)} ${u(8.4)} ${u(7.3)};
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  text-align: center;
}
.brand { display: flex; flex-direction: column; align-items: center; gap: ${u(0.5)}; }
.brand svg { width: ${u(5.4)}; height: ${u(5.4)}; display: block; }
.brand-name {
  font-family: 'Cinzel', serif; font-weight: 700; font-size: ${u(1.25)};
  letter-spacing: 0.32em; text-transform: uppercase;
}
.titles { display: flex; flex-direction: column; align-items: center; gap: ${u(0.2)}; }
.title { font-family: 'Cinzel', serif; font-weight: 700; font-size: ${u(5.3)}; line-height: 1; letter-spacing: 0.08em; }
.subtitle {
  font-family: 'Cinzel', serif; font-weight: 500; font-size: ${u(1.35)};
  letter-spacing: 0.42em; text-transform: uppercase; color: ${PALETTE.goldDeep};
  display: flex; align-items: center; gap: ${u(1.2)};
}
.subtitle::before, .subtitle::after {
  content: ""; width: ${u(6)}; height: ${u(0.12)};
  background: linear-gradient(90deg, rgba(176, 141, 60, 0), ${PALETTE.gold});
}
.subtitle::after { transform: scaleX(-1); }
.lead { font-family: 'EB Garamond', serif; font-style: italic; font-size: ${u(1.75)}; }
.name-wrap { width: 100%; display: flex; justify-content: center; }
.name {
  font-family: 'Pinyon Script', cursive; font-size: ${u(5.6)}; line-height: 1.05; white-space: nowrap;
  padding: 0 ${u(3)} ${u(0.4)}; border-bottom: ${u(0.12)} solid ${PALETTE.gold};
}
.text {
  margin: 0; font-family: 'EB Garamond', serif; font-size: ${u(1.62)}; line-height: 1.55;
  max-width: ${u(64)}; color: ${PALETTE.bodyText}; text-wrap: balance;
}
.text strong { font-weight: 500; color: ${PALETTE.navy}; }
.when { font-family: 'EB Garamond', serif; font-size: ${u(1.45)}; color: ${PALETTE.bodyText}; }

.sign-row { width: 100%; display: grid; grid-template-columns: 1fr ${u(13)} 1fr; align-items: end; gap: ${u(3)}; }
.signature { display: flex; flex-direction: column; align-items: center; gap: ${u(0.3)}; }
.signature .ink {
  font-family: 'Pinyon Script', cursive; font-size: ${u(3.2)}; line-height: 1; color: ${PALETTE.inkBlue};
  transform: rotate(-4deg) translateY(${u(0.6)}); white-space: nowrap;
}
.signature .rule { width: ${u(22)}; height: ${u(0.1)}; background: ${PALETTE.navy}; }
.signature .who { font-family: 'Cinzel', serif; font-weight: 700; font-size: ${u(1.1)}; letter-spacing: 0.08em; }
.signature .role { font-family: 'EB Garamond', serif; font-style: italic; font-size: ${u(1.2)}; color: ${PALETTE.mutedText}; }
.seal { width: ${u(13)}; margin-bottom: ${u(-2.2)}; }
.seal svg { width: 100%; height: auto; display: block; }

.footer-row {
  width: 100%; display: flex; justify-content: space-between; align-items: flex-end; gap: ${u(2)};
  font-family: 'IBM Plex Mono', monospace; font-size: ${u(0.95)}; color: ${PALETTE.footerText}; letter-spacing: 0.02em;
}
.registry { text-align: left; line-height: 1.5; }
.verify { display: flex; align-items: center; gap: ${u(1)}; text-align: right; line-height: 1.5; }
.verify .code { font-weight: 500; color: ${PALETTE.navy}; font-size: ${u(1.1)}; letter-spacing: 0.06em; }
.qr { width: ${u(5.6)}; height: ${u(5.6)}; padding: ${u(0.3)}; border: ${u(0.08)} solid ${PALETTE.gold}; background: ${PALETTE.paper}; }
.qr svg { width: 100%; height: 100%; display: block; }

/* ---------- Verso ---------- */
.back-body {
  position: absolute; inset: ${u(7.6)} ${u(8.6)} ${u(7.6)};
  display: grid; grid-template-columns: 1.35fr 1fr; grid-template-rows: auto 1fr auto; gap: ${u(2.4)} ${u(4)};
}
.back-head {
  grid-column: 1 / -1; display: flex; align-items: baseline; justify-content: space-between; gap: ${u(3)};
  border-bottom: ${u(0.12)} solid ${PALETTE.gold}; padding-bottom: ${u(1)};
}
.back-head h2 { margin: 0; font-family: 'Cinzel', serif; font-weight: 700; font-size: ${u(2.3)}; letter-spacing: 0.12em; white-space: nowrap; }
.back-head span { font-family: 'EB Garamond', serif; font-style: italic; font-size: ${u(1.4)}; color: ${PALETTE.mutedText}; text-align: right; }

.syllabus { width: 100%; border-collapse: collapse; font-family: 'EB Garamond', serif; font-size: ${u(1.5)}; color: ${PALETTE.bodyText}; align-self: start; }
.syllabus th {
  text-align: left; font-family: 'Cinzel', serif; font-size: ${u(1)}; letter-spacing: 0.18em; text-transform: uppercase;
  color: ${PALETTE.goldDeep}; padding: 0 0 ${u(0.8)}; font-weight: 700;
}
.syllabus th:last-child, .syllabus td:last-child { text-align: right; white-space: nowrap; }
.syllabus td { padding: ${u(0.75)} 0; border-bottom: ${u(0.08)} solid rgba(176, 141, 60, 0.35); font-variant-numeric: tabular-nums; }
.syllabus td:first-child { padding-right: ${u(2)}; }
.syllabus tfoot td { border-bottom: 0; padding-top: ${u(1.1)}; font-weight: 500; color: ${PALETTE.navy}; }
.syllabus tfoot td:first-child { font-family: 'Cinzel', serif; font-size: ${u(1.1)}; letter-spacing: 0.18em; text-transform: uppercase; }
.syllabus.dense { font-size: ${u(1.3)}; }
.syllabus.dense td { padding: ${u(0.45)} 0; }

.auth {
  align-self: start; border: ${u(0.12)} solid ${PALETTE.gold}; padding: ${u(2.2)};
  display: grid; gap: ${u(1.4)}; justify-items: center; text-align: center; background: rgba(255, 252, 244, 0.6);
}
.auth h3 { margin: 0; font-family: 'Cinzel', serif; font-weight: 700; font-size: ${u(1.3)}; letter-spacing: 0.22em; text-transform: uppercase; }
.auth .qr { width: ${u(12)}; height: ${u(12)}; padding: ${u(0.6)}; }
.auth .code { font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: ${u(1.5)}; letter-spacing: 0.08em; }
.auth dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: ${u(0.5)} ${u(1.2)}; text-align: left; font-size: ${u(1.05)}; width: 100%; }
.auth dt {
  font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: ${PALETTE.goldDeep}; font-size: ${u(0.9)}; padding-top: ${u(0.15)};
}
.auth dd { margin: 0; font-family: 'IBM Plex Mono', monospace; color: ${PALETTE.bodyText}; }
.auth dd.hash { font-size: ${u(0.92)}; letter-spacing: 0.02em; }
.auth p { margin: 0; font-family: 'EB Garamond', serif; font-size: ${u(1.25)}; line-height: 1.45; color: ${PALETTE.mutedText}; }
.back-foot {
  grid-column: 1 / -1; display: flex; justify-content: space-between; gap: ${u(2)};
  font-family: 'IBM Plex Mono', monospace; font-size: ${u(0.95)}; color: ${PALETTE.footerText};
  border-top: ${u(0.08)} solid rgba(176, 141, 60, 0.45); padding-top: ${u(1)};
}
`;
