import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { TokenPayload, TokenPort } from '../../domain/ports';

/** Requisito 3.5: expiração máxima de 24 horas. */
export const JWT_EXPIRES_IN = '24h';

@Injectable()
export class JwtTokenAdapter implements TokenPort {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: TokenPayload): Promise<string> {
    return this.jwt.signAsync({ ...payload });
  }
}
