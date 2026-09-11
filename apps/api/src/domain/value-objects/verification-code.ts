import { InvalidVerificationCodeError } from '../errors';
import type { RandomPort } from '../ports/services/random.port';

/** Crockford Base32: sem I, L, O e U, para evitar confusão na leitura e digitação. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12;
const VALID_CODE = /^[0-9A-HJKMNP-TV-Z]{12}$/;

/** Código único impresso no certificado: CERT-7K3F-9QX2-M8PD (60 bits aleatórios). */
export class VerificationCode {
  private constructor(readonly value: string) {}

  static generate(random: RandomPort): VerificationCode {
    let bits = 0n;
    for (const byte of random.bytes(8)) bits = (bits << 8n) | BigInt(byte);

    let value = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      value = ALPHABET[Number(bits & 31n)] + value;
      bits >>= 5n;
    }
    return new VerificationCode(value);
  }

  /** Aceita minúsculas, hífens, espaços e as confusões comuns O→0 e I/L→1. */
  static parse(raw: string): VerificationCode {
    let cleaned = raw.toUpperCase().replace(/[\s-]/g, '');
    // Só remove o prefixo quando ele está presente: o corpo do código também pode começar com "CERT"
    if (cleaned.length === CODE_LENGTH + 4 && cleaned.startsWith('CERT')) {
      cleaned = cleaned.slice(4);
    }
    cleaned = cleaned.replace(/O/g, '0').replace(/[IL]/g, '1');

    if (!VALID_CODE.test(cleaned)) throw new InvalidVerificationCodeError();
    return new VerificationCode(cleaned);
  }

  /** CERT-7K3F-9QX2-M8PD */
  formatted(): string {
    const v = this.value;
    return `CERT-${v.slice(0, 4)}-${v.slice(4, 8)}-${v.slice(8)}`;
  }
}
