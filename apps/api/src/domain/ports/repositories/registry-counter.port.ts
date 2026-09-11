export interface RegistryCounterPort {
  /**
   * Próxima sequência do ano. Deve rodar dentro da transação da emissão:
   * se ela falhar, o número volta e a numeração não fica com buracos.
   */
  next(year: number): Promise<number>;
}
