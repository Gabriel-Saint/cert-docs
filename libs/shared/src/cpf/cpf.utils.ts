const CPF_LENGTH = 11;

/** Remove tudo que não for dígito. */
export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Valida o CPF pelo algoritmo oficial (módulo 11).
 * Aceita com ou sem formatação.
 */
export function isValidCpf(raw: string): boolean {
  const cpf = normalizeCpf(raw);
  if (cpf.length !== CPF_LENGTH || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  return (
    calculateCheckDigit(digits, 9) === digits[9] &&
    calculateCheckDigit(digits, 10) === digits[10]
  );
}

/**
 * Calcula o dígito verificador a partir dos `length` primeiros dígitos.
 * Pesos: de `length + 1` até 2 (10..2 no primeiro, 11..2 no segundo).
 */
export function calculateCheckDigit(digits: number[], length: number): number {
  const sum = digits
    .slice(0, length)
    .reduce((acc, digit, index) => acc + digit * (length + 1 - index), 0);
  return ((sum * 10) % 11) % 10;
}

/** 52998224725 -> 529.982.247-25 */
export function formatCpf(raw: string): string {
  return normalizeCpf(raw).replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4',
  );
}

/** 52998224725 -> 529.***.***-25 */
export function maskCpf(raw: string): string {
  const cpf = normalizeCpf(raw);
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
}

/** 52998224725 -> 529-25 (usado no nome do arquivo do PDF) */
export function partialCpf(raw: string): string {
  const cpf = normalizeCpf(raw);
  return `${cpf.slice(0, 3)}-${cpf.slice(9)}`;
}
