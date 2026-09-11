export interface RandomPort {
  /** Bytes criptograficamente seguros. */
  bytes(length: number): Uint8Array;
}
