import fc from 'fast-check';
import { formatCpf, isValidCpf, maskCpf, partialCpf } from './cpf.utils.js';

/**
 * Oráculo independente da implementação: usa a formulação "clássica"
 * do módulo 11 (resto < 2 => 0, senão 11 - resto).
 */
function referenceCheckDigit(digits: number[]): number {
  const weightStart = digits.length + 1;
  const sum = digits.reduce((acc, d, i) => acc + d * (weightStart - i), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function referenceIsValid(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split('').map(Number);
  return (
    referenceCheckDigit(digits.slice(0, 9)) === digits[9] &&
    referenceCheckDigit(digits.slice(0, 10)) === digits[10]
  );
}

const digit = fc.integer({ min: 0, max: 9 });

/** 9 dígitos (não todos iguais) + os 2 verificadores calculados pelo oráculo. */
const validCpfArb = fc
  .array(digit, { minLength: 9, maxLength: 9 })
  .filter((base) => new Set(base).size > 1)
  .map((base) => {
    const withFirst = [...base, referenceCheckDigit(base)];
    return [...withFirst, referenceCheckDigit(withFirst)].join('');
  });

const anyElevenDigitsArb = fc
  .array(digit, { minLength: 11, maxLength: 11 })
  .map((d) => d.join(''));

describe('cpf utils — property tests', () => {
  // Property 2: Validação dos dígitos verificadores do CPF
  it('aceita todo CPF com verificadores corretos, com ou sem formatação', () => {
    fc.assert(
      fc.property(validCpfArb, (cpf) => {
        expect(isValidCpf(cpf)).toBe(true);
        expect(isValidCpf(formatCpf(cpf))).toBe(true);
      }),
    );
  });

  it('rejeita todo CPF com o último verificador alterado', () => {
    fc.assert(
      fc.property(validCpfArb, fc.integer({ min: 1, max: 9 }), (cpf, shift) => {
        const wrongDigit = (Number(cpf[10]) + shift) % 10;
        expect(isValidCpf(cpf.slice(0, 10) + wrongDigit)).toBe(false);
      }),
    );
  });

  it('concorda com o oráculo para qualquer sequência de 11 dígitos', () => {
    fc.assert(
      fc.property(fc.oneof(anyElevenDigitsArb, validCpfArb), (cpf) => {
        expect(isValidCpf(cpf)).toBe(referenceIsValid(cpf));
      }),
      { numRuns: 500 },
    );
  });

  // Property 3: CPF válido sempre produz formato correto
  it('formatCpf sempre produz XXX.XXX.XXX-XX', () => {
    fc.assert(
      fc.property(validCpfArb, (cpf) => {
        expect(formatCpf(cpf)).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
      }),
    );
  });

  // Property 11: CPF mascarado e parcial nunca expõem os dígitos do meio
  it('maskCpf e partialCpf expõem só os 3 primeiros e os 2 últimos dígitos', () => {
    fc.assert(
      fc.property(validCpfArb, (cpf) => {
        const visibleDigits = cpf.slice(0, 3) + cpf.slice(9);
        const masked = maskCpf(cpf);
        const partial = partialCpf(cpf);

        expect(masked).toMatch(/^\d{3}\.\*{3}\.\*{3}-\d{2}$/);
        expect(partial).toMatch(/^\d{3}-\d{2}$/);
        expect(masked.replace(/\D/g, '')).toBe(visibleDigits);
        expect(partial.replace(/\D/g, '')).toBe(visibleDigits);
      }),
    );
  });
});
