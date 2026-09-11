import type {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { isValidCpf, normalizeCpf } from '@cert-docs/shared';

/**
 * Valida o CPF com o mesmo algoritmo da API (vem da libs/shared).
 * Campo vazio passa: obrigatoriedade é papel do Validators.required.
 */
export const cpfValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  return isValidCpf(value) ? null : { cpf: true };
};

/**
 * Máscara progressiva enquanto a pessoa digita: "5299822" → "529.982.2".
 * Ignora qualquer caractere que não seja dígito e limita a 11 dígitos.
 */
export function maskCpfInput(value: string): string {
  const digits = normalizeCpf(value).slice(0, 11);
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 11),
  ];

  let masked = parts[0];
  if (parts[1]) masked += `.${parts[1]}`;
  if (parts[2]) masked += `.${parts[2]}`;
  if (parts[3]) masked += `-${parts[3]}`;
  return masked;
}
