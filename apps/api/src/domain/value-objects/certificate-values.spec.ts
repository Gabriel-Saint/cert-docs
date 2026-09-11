import fc from 'fast-check';
import {
  assertValidModules,
  MAX_COURSE_MODULES,
  workloadHours,
} from '../entities/course.entity';
import {
  InvalidCertificatePeriodError,
  InvalidCourseError,
  InvalidVerificationCodeError,
} from '../errors';
import {
  isoDateInBrasilia,
  isValidIsoDate,
  startOfDayInBrasilia,
  startOfNextDayInBrasilia,
  yearInBrasilia,
} from '../services/calendar';
import { canonicalize } from '../services/canonical-json';
import { CertificatePeriod } from './certificate-period';
import { Registry, SHEETS_PER_BOOK } from './registry';
import { VerificationCode } from './verification-code';

const bytesRandom = (bytes: number[]) => ({
  bytes: (length: number) => Uint8Array.from(bytes.slice(0, length)),
});

describe('VerificationCode', () => {
  const eightBytes = fc.array(fc.integer({ min: 0, max: 255 }), {
    minLength: 8,
    maxLength: 8,
  });

  // Property 1: Código de verificação bem formado e reversível
  it('gera 12 caracteres Crockford e volta igual por parse, em qualquer grafia aceita', () => {
    fc.assert(
      fc.property(eightBytes, (bytes) => {
        const code = VerificationCode.generate(bytesRandom(bytes));
        const formatted = code.formatted();

        expect(code.value).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
        expect(formatted).toMatch(/^CERT-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
        expect(VerificationCode.parse(formatted).value).toBe(code.value);
        expect(VerificationCode.parse(formatted.toLowerCase()).value).toBe(
          code.value,
        );
        expect(VerificationCode.parse(code.value).value).toBe(code.value);
        expect(
          VerificationCode.parse(
            code.value.replace(/0/g, 'O').replace(/1/g, 'I'),
          ).value,
        ).toBe(code.value);
      }),
    );
  });

  it('não confunde um código que começa com CERT com o prefixo', () => {
    expect(VerificationCode.parse('CERT7K3F9QX2').value).toBe('CERT7K3F9QX2');
  });

  it.each([
    '',
    'CERT-7K3F',
    'CERT-7K3F-9QX2-M8PU',
    'ABCDEFGHIJKLMNOP',
    '<script>',
  ])('rejeita %p', (raw) => {
    expect(() => VerificationCode.parse(raw)).toThrow(
      InvalidVerificationCodeError,
    );
  });
});

describe('Registry', () => {
  // Parte da Property 5: fórmulas de livro e folha
  it('distribui 200 folhas por livro, sem folha zero nem acima de 200', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (sequence) => {
        const registry = new Registry(2026, sequence);

        expect(registry.sheet).toBeGreaterThanOrEqual(1);
        expect(registry.sheet).toBeLessThanOrEqual(SHEETS_PER_BOOK);
        expect((registry.book - 1) * SHEETS_PER_BOOK + registry.sheet).toBe(
          sequence,
        );
      }),
    );
  });

  it('formata com seis dígitos', () => {
    const registry = new Registry(2026, 418);
    expect(registry.formatted()).toBe('2026.000418');
    expect([registry.book, registry.sheet]).toEqual([3, 18]);
    expect(new Registry(2026, 200).sheet).toBe(200);
    expect(new Registry(2026, 201).book).toBe(2);
  });

  it('não aceita sequência menor que 1', () => {
    expect(() => new Registry(2026, 0)).toThrow(RangeError);
  });
});

describe('canonicalize', () => {
  // Property 2: JSON canônico independe da ordem das chaves
  it('gera a mesma string para qualquer ordem de chaves, em qualquer nível', () => {
    const shuffleKeys = (value: unknown, seed: number): unknown => {
      if (Array.isArray(value))
        return value.map((item) => shuffleKeys(item, seed));
      if (value && typeof value === 'object') {
        const entries = Object.entries(value);
        const rotated = entries
          .slice(seed % (entries.length || 1))
          .concat(entries.slice(0, seed % (entries.length || 1)));
        return Object.fromEntries(
          rotated.reverse().map(([k, v]) => [k, shuffleKeys(v, seed + 1)]),
        );
      }
      return value;
    };

    fc.assert(
      fc.property(fc.object(), fc.nat(), (value, seed) => {
        expect(canonicalize(shuffleKeys(value, seed))).toBe(
          canonicalize(value),
        );
      }),
    );
  });

  it('ordena chaves, ignora undefined e serializa datas em ISO', () => {
    expect(
      canonicalize({ b: 1, a: { d: undefined, c: [2, null] }, e: new Date(0) }),
    ).toBe('{"a":{"c":[2,null]},"b":1,"e":"1970-01-01T00:00:00.000Z"}');
  });
});

describe('CertificatePeriod e calendário', () => {
  it('aceita período válido e sem data de início', () => {
    const period = CertificatePeriod.create(
      undefined,
      '2026-09-11',
      '2026-09-11',
    );
    expect(period.startDate).toBeNull();
    expect(
      CertificatePeriod.create('2026-08-04', '2026-09-11', '2026-09-11')
        .startDate,
    ).toBe('2026-08-04');
  });

  it.each([
    ['conclusão futura', null, '2026-09-12'],
    ['início depois da conclusão', '2026-09-11', '2026-09-10'],
    ['data inexistente', null, '2026-02-30'],
    ['formato errado', null, '11/09/2026'],
  ])('rejeita %s', (_, start, completion) => {
    expect(() =>
      CertificatePeriod.create(start, completion, '2026-09-11'),
    ).toThrow(InvalidCertificatePeriodError);
  });

  it('usa o fuso de Brasília para data e ano', () => {
    const almostNewYearInBrasilia = new Date('2027-01-01T02:30:00Z');
    expect(isoDateInBrasilia(almostNewYearInBrasilia)).toBe('2026-12-31');
    expect(yearInBrasilia(almostNewYearInBrasilia)).toBe(2026);
    expect(startOfDayInBrasilia('2026-09-11').toISOString()).toBe(
      '2026-09-11T03:00:00.000Z',
    );
    expect(startOfNextDayInBrasilia('2026-09-11').toISOString()).toBe(
      '2026-09-12T03:00:00.000Z',
    );
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
  });
});

describe('Módulos do curso', () => {
  const moduleArb = fc.record({
    title: fc
      .string({ minLength: 1, maxLength: 40 })
      .filter((t) => t.trim().length > 0),
    hours: fc.integer({ min: 1, max: 999 }),
  });

  // Property 9: Carga horária é a soma dos módulos
  it('carga horária é sempre a soma das horas', () => {
    fc.assert(
      fc.property(
        fc.array(moduleArb, { minLength: 1, maxLength: MAX_COURSE_MODULES }),
        (modules) => {
          expect(() => assertValidModules(modules)).not.toThrow();
          expect(workloadHours(modules)).toBe(
            modules.reduce((sum, m) => sum + m.hours, 0),
          );
        },
      ),
    );
  });

  it.each([
    ['sem módulos', []],
    [
      'módulos demais',
      Array.from({ length: 13 }, () => ({ title: 'M', hours: 1 })),
    ],
    ['horas zeradas', [{ title: 'M', hours: 0 }]],
    ['horas fracionadas', [{ title: 'M', hours: 1.5 }]],
    ['título em branco', [{ title: '   ', hours: 2 }]],
  ])('rejeita %s', (_, modules) => {
    expect(() => assertValidModules(modules)).toThrow(InvalidCourseError);
  });
});
