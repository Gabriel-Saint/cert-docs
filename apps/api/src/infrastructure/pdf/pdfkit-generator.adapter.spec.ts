import fc from 'fast-check';
import { extractPdfPages } from '../../testing/pdf-text';
import { PdfKitGeneratorAdapter } from './pdfkit-generator.adapter';

// O texto não pode ser buscado direto no buffer: o PDFKit comprime os streams
// e codifica o texto. Por isso extraímos com pdf-parse.

function countOccurrences(text: string, search: string): number {
  return text.split(search).length - 1;
}

const PARAGRAPH =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud.';

describe('PdfKitGeneratorAdapter', () => {
  const adapter = new PdfKitGeneratorAdapter();

  // Property 1: PDF contém exatamente o CPF do usuário solicitante
  it('carimba o CPF e o nome do usuário, e nenhum outro CPF', async () => {
    const buffer = await adapter.generate({
      title: 'Apostila',
      content: 'Conteúdo curto',
      userCpf: '529.982.247-25',
      userName: 'João Silva',
    });

    const [page] = extractPdfPages(buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(page).toContain('CPF: 529.982.247-25 | João Silva');
    expect(page).not.toContain('111.444.777-35');
  });

  // Property 10: Carimbo em todas as páginas, sem páginas extras
  it('coloca o carimbo 2 vezes em cada página e nunca gera página só com carimbo', async () => {
    const stamp = 'CPF: 111.444.777-35 | Maria';

    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 60 }), async (paragraphs) => {
        const content = Array.from(
          { length: paragraphs },
          () => PARAGRAPH,
        ).join('\n\n');
        const buffer = await adapter.generate({
          title: 'Material',
          content,
          userCpf: '111.444.777-35',
          userName: 'Maria',
        });

        const pages = extractPdfPages(buffer);
        for (const text of pages) {
          expect(countOccurrences(text, stamp)).toBe(2);
          expect(text.split(stamp).join('').trim().length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 12 },
    );
  }, 60_000);
});
