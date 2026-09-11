import type { Role } from '@cpf-pdf/shared';

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface TokenPort {
  sign(payload: TokenPayload): Promise<string>;
}
