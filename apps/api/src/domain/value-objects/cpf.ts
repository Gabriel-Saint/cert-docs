import {
  formatCpf,
  isValidCpf,
  maskCpf,
  normalizeCpf,
  partialCpf,
} from '@cpf-pdf/shared';
import { InvalidCpfError } from '../errors';

export class Cpf {
  private constructor(private readonly value: string) {}

  /** Lança InvalidCpfError se o CPF não passar no algoritmo módulo 11. */
  static create(raw: string): Cpf {
    if (!isValidCpf(raw)) throw new InvalidCpfError();
    return new Cpf(normalizeCpf(raw));
  }

  /** 529.982.247-25 */
  formatted(): string {
    return formatCpf(this.value);
  }

  /** 529.***.***-25 */
  masked(): string {
    return maskCpf(this.value);
  }

  /** 529-25 */
  partial(): string {
    return partialCpf(this.value);
  }

  equals(other: Cpf): boolean {
    return this.value === other.value;
  }

  /** 52998224725 */
  toString(): string {
    return this.value;
  }
}
