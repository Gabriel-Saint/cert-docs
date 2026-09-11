import {
  calculateCheckDigit,
  formatCpf,
  isValidCpf,
  maskCpf,
  normalizeCpf,
  partialCpf,
} from './cpf.utils.js';

describe('cpf utils', () => {
  describe('normalizeCpf', () => {
    it('remove pontuação e espaços', () => {
      expect(normalizeCpf(' 529.982.247-25 ')).toBe('52998224725');
    });
  });

  describe('isValidCpf', () => {
    it.each(['52998224725', '529.982.247-25', '111.444.777-35'])(
      'aceita CPF válido %s',
      (cpf) => {
        expect(isValidCpf(cpf)).toBe(true);
      },
    );

    it.each([
      ['dígito verificador errado', '52998224724'],
      ['menos de 11 dígitos', '5299822472'],
      ['mais de 11 dígitos', '529982247250'],
      ['vazio', ''],
      ['letras', 'abc.def.ghi-jk'],
    ])('rejeita CPF com %s', (_, cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    });

    it.each(Array.from({ length: 10 }, (_, d) => String(d).repeat(11)))(
      'rejeita sequência de dígitos iguais %s',
      (cpf) => {
        expect(isValidCpf(cpf)).toBe(false);
      },
    );
  });

  describe('calculateCheckDigit', () => {
    it('calcula os dois verificadores de 529.982.247-25', () => {
      const digits = '52998224725'.split('').map(Number);
      expect(calculateCheckDigit(digits, 9)).toBe(2);
      expect(calculateCheckDigit(digits, 10)).toBe(5);
    });
  });

  describe('formatação', () => {
    it('formatCpf aplica o padrão XXX.XXX.XXX-XX', () => {
      expect(formatCpf('52998224725')).toBe('529.982.247-25');
    });

    it('maskCpf esconde os dígitos do meio', () => {
      expect(maskCpf('529.982.247-25')).toBe('529.***.***-25');
    });

    it('partialCpf mantém só os 3 primeiros e os 2 últimos dígitos', () => {
      expect(partialCpf('52998224725')).toBe('529-25');
    });
  });
});
