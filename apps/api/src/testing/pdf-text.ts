import { spawnSync } from 'node:child_process';

/**
 * O pdf-parse (pdfjs) usa import dinâmico, que o Jest não suporta sem
 * --experimental-vm-modules. Por isso a extração roda num processo Node separado.
 */
const EXTRACT_SCRIPT = `
const { PDFParse } = require('pdf-parse');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', async () => {
  const parser = new PDFParse({ data: Buffer.from(input, 'base64') });
  try {
    const result = await parser.getText();
    process.stdout.write(JSON.stringify(result.pages.map((page) => page.text)));
  } finally {
    await parser.destroy();
  }
});
`;

/** Retorna o texto de cada página do PDF. */
export function extractPdfPages(buffer: Buffer): string[] {
  const result = spawnSync(process.execPath, ['-e', EXTRACT_SCRIPT], {
    input: buffer.toString('base64'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(`Falha ao extrair texto do PDF: ${result.stderr}`);
  }
  return JSON.parse(result.stdout) as string[];
}
