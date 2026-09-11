import { Role } from '@cert-docs/shared';

const encode = (value: object): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    '',
  );
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/** JWT de teste com assinatura falsa (o front não valida assinatura). */
export function makeToken(
  overrides: Partial<{
    sub: string;
    email: string;
    role: string;
    exp: number;
  }> = {},
): string {
  const payload = {
    sub: 'user-1',
    email: 'maria@example.com',
    role: Role.USER,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.assinatura`;
}

export const STORAGE_KEY = 'cert-docs.access-token';
