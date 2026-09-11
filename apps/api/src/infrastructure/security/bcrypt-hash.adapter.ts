import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { HashPort } from '../../domain/ports';

const SALT_ROUNDS = 10;

/** bcryptjs (JS puro): mesmo algoritmo do bcrypt, sem build nativo no Windows/Alpine. */
@Injectable()
export class BcryptHashAdapter implements HashPort {
  hash(plain: string): Promise<string> {
    return hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }
}
