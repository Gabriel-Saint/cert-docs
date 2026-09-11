import { randomBytes } from 'node:crypto';
import type { ClockPort, RandomPort } from '../../domain/ports';

export class CryptoRandomAdapter implements RandomPort {
  bytes(length: number): Uint8Array {
    return randomBytes(length);
  }
}

export class SystemClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }
}
