/** Cada livro de registro tem 200 folhas, uma por certificado. */
export const SHEETS_PER_BOOK = 200;

/** Registro sequencial por ano, no padrão dos diplomas: nº 2026.000418, livro 3, folha 18. */
export class Registry {
  constructor(
    readonly year: number,
    readonly sequence: number,
  ) {
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new RangeError('A sequência do registro começa em 1');
    }
  }

  get book(): number {
    return Math.ceil(this.sequence / SHEETS_PER_BOOK);
  }

  get sheet(): number {
    return ((this.sequence - 1) % SHEETS_PER_BOOK) + 1;
  }

  /** 2026.000418 */
  formatted(): string {
    return `${this.year}.${String(this.sequence).padStart(6, '0')}`;
  }
}
