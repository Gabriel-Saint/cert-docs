import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { TokenPayload } from '../../domain/ports';
import { SESSION_COOKIE_NAME } from '../../infrastructure/security/session-cookie';

function extractSessionCookie(request: Request): string | null {
  const cookie = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return cookie?.slice(SESSION_COOKIE_NAME.length + 1) || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractSessionCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** O retorno vira `request.user`. */
  validate(payload: TokenPayload): TokenPayload {
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
    };
  }
}
