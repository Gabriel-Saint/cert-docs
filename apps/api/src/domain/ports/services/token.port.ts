import type { Role } from '@cert-docs/shared';

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  exp?: number;
}

export interface TokenPort {
  sign(payload: TokenPayload): Promise<string>;
}
