import type { CertificateRenderInput } from '../../../domain/ports';
import { buildCertificateHtml, periodText } from './certificate.template';
import { escapeHtml } from './escape-html';
import { institutionInitials } from './insignia';
import { frameSvg, guillocheWavePaths } from './ornaments';

function makeInput(
  overrides: Partial<CertificateRenderInput['snapshot']['holder']> = {},
): CertificateRenderInput {
  return {
    snapshot: {
      holder: { name: 'Maria Clara Souza', cpf: '93541134780', ...overrides },
      course: {
        title: 'NestJS & <Hexagonal>',
        coordinator: 'Prof. Ricardo Menezes',
        workloadHours: 40,
        modules: [{ title: 'Módulo "único"', hours: 40 }],
      },
      period: { startDate: '2026-08-04', completionDate: '2026-09-11' },
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
    dataHash: 'a'.repeat(64),
    verificationUrl: 'http://localhost:4200/verificar/CERT-7K3F-9QX2-M8PD',
  };
}

const ASSETS = { fontFaces: '', qrSvg: '<svg class="qr-stub"></svg>' };

describe('buildCertificateHtml', () => {
  it('escapa todo dado vindo do usuário', () => {
    const html = buildCertificateHtml(
      makeInput({ name: '<img src=x onerror="alert(1)">' }),
      ASSETS,
    );

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('NestJS &amp; &lt;Hexagonal&gt;');
    expect(html).toContain('Módulo &quot;único&quot;');
  });

  it('preenche os dados do certificado com formatos brasileiros', () => {
    const html = buildCertificateHtml(makeInput(), ASSETS);

    expect(html).toContain('935.411.347-80');
    expect(html).toContain('realizado de 4 de agosto a 11 de setembro de 2026');
    expect(html).toContain('São Paulo, 11 de setembro de 2026.');
    expect(html).toContain('Registro nº 2026.000418 · Livro 03 · Folha 018');
    expect(html).toContain('localhost:4200/verificar');
    expect(html).toContain('11/09/2026 14:32 (Brasília)');
    expect(html.match(/qr-stub/g)).toHaveLength(2);
  });

  it('não gera coordenadas inválidas nos SVGs', () => {
    const html = buildCertificateHtml(makeInput(), ASSETS);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('ornamentos e textos auxiliares', () => {
  it('gera uma onda por fase na faixa guilloché', () => {
    const paths = guillocheWavePaths({
      outerInset: 8,
      innerInset: 16,
      waves: 6,
      wavelength: 7,
      step: 1,
    });
    expect(paths).toHaveLength(6);
    expect(paths.every((d) => d.startsWith('M'))).toBe(true);
    expect(frameSvg({ watermark: false })).not.toContain(
      'stroke-opacity="0.12"',
    );
  });

  it.each([
    ['Academia Horizonte', 'AH'],
    ['Instituto de Tecnologia da Informação', 'ITI'],
    ['escola', 'E'],
  ])('iniciais de %p', (name, initials) => {
    expect(institutionInitials(name)).toBe(initials);
  });

  it('descreve o período com e sem data de início', () => {
    expect(periodText(null, '2026-09-11')).toBe(
      'concluído em 11 de setembro de 2026',
    );
    expect(periodText('2025-12-01', '2026-02-10')).toBe(
      'realizado de 1 de dezembro de 2025 a 10 de fevereiro de 2026',
    );
  });

  it('escapeHtml cobre os cinco caracteres especiais', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
