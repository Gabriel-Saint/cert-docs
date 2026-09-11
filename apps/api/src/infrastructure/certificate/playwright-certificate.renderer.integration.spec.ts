/**
 * Integração real com o Chromium (Playwright). Roda em `nx run api:test-integration`.
 * Pré-requisito: `npx playwright install --only-shell chromium`.
 */
import fc from 'fast-check';
import type { CertificateRenderInput } from '../../domain/ports';
import { extractPdfPages } from '../../testing/pdf-text';
import { PlaywrightCertificateRenderer } from './playwright-certificate.renderer';

function makeInput(holderName: string): CertificateRenderInput {
  return {
    snapshot: {
      holder: { name: holderName, cpf: '93541134780' },
      course: {
        title: 'NestJS com Arquitetura Hexagonal',
        coordinator: 'Prof. Ricardo Menezes',
        workloadHours: 40,
        modules: Array.from({ length: 12 }, (_, i) => ({
          title: `Módulo ${i + 1}: tópico avançado de arquitetura`,
          hours: i === 11 ? 7 : 3,
        })),
      },
      period: { startDate: null, completionDate: '2026-09-11' },
      institution: {
        name: 'Academia Horizonte',
        city: 'São Paulo',
        director: 'Dra. Helena Duarte',
        directorRole: 'Diretora Acadêmica',
      },
      issuedAt: '2026-09-11T17:32:00.000Z',
    },
    code: 'CERT-7K3F-9QX2-M8PD',
    registry: { number: '2026.000418', book: 3, sheet: 18 },
    dataHash:
      '9f2c71e04b8a3d56c1e7f09a2b4d68e3a5c7190f3e2d8b64a1c05f7e9d3b2a41',
    verificationUrl: 'http://localhost:4200/verificar/CERT-7K3F-9QX2-M8PD',
  };
}

/**
 * O extrator de texto às vezes insere espaços entre glifos com kerning (ex.: "D’ Ávila"),
 * então a comparação ignora espaços. Letras faltando ou cortadas continuam sendo detectadas.
 */
const normalize = (text: string) => text.replace(/\s+/g, '');

describe('PlaywrightCertificateRenderer (integração)', () => {
  const renderer = new PlaywrightCertificateRenderer();

  afterAll(() => renderer.onModuleDestroy());

  // Property 10: PDF contém os dados certos e é vetorial
  it('gera 2 páginas com o nome exato, código e curso, sem imagens rasterizadas', async () => {
    const nameArb = fc
      .array(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyzÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç<&'.split(''),
        ),
        { minLength: 2, maxLength: 24 },
      )
      .map((chars) => chars.join(''))
      .chain((first) =>
        fc
          .constantFrom('Souza', 'D’Ávila', 'Conceição', 'Silva & Filhos')
          .map((last) => `${first} ${last}`),
      );

    await fc.assert(
      fc.asyncProperty(nameArb, async (name) => {
        const pdf = await renderer.render(makeInput(name));
        const pages = extractPdfPages(pdf);

        expect(pages).toHaveLength(2);
        expect(normalize(pages[0])).toContain(normalize(name));
        expect(normalize(pages[0])).toContain('CERT-7K3F-9QX2-M8PD');
        expect(normalize(pages[0])).toContain(
          normalize('NestJS com Arquitetura Hexagonal'),
        );
        expect(normalize(pages[1])).toContain(
          normalize('Módulo 12: tópico avançado de arquitetura'),
        );
        expect(pdf.includes('/Subtype /Image')).toBe(false);
      }),
      { numRuns: 6 },
    );
  }, 120_000);

  it('reduz o nome longo para caber sem quebrar a página', async () => {
    const longName =
      'Maria Eduarda dos Santos Albuquerque de Oliveira Cavalcanti Figueiredo Nascimento Bragança';
    const pages = extractPdfPages(await renderer.render(makeInput(longName)));

    expect(pages).toHaveLength(2);
    expect(normalize(pages[0])).toContain(normalize(longName));
  }, 60_000);
});
