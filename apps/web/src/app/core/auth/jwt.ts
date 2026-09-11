import { Role } from '@cert-docs/shared';

/** Dados que a API coloca no token (sub, email, role) mais as datas do próprio JWT. */
export interface Session {
  userId: string;
  email: string;
  role: Role;
  /** Expiração em milissegundos desde a época Unix. */
  expiresAt: number;
}

const ROLES = new Set<string>(Object.values(Role));

/**
 * Lê o payload do JWT sem validar a assinatura (quem valida é a API).
 * Retorna null para token ausente, malformado ou com payload inesperado.
 */
export function decodeSession(token: string | null): Session | null {
  if (!token) return null;

  const [, payloadPart] = token.split('.');
  if (!payloadPart) return null;

  try {
    const payload: unknown = JSON.parse(decodeBase64Url(payloadPart));
    if (!isTokenPayload(payload)) return null;
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role as Role,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

export function isSessionExpired(session: Session, now = Date.now()): boolean {
  return session.expiresAt <= now;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  );
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

function isTokenPayload(value: unknown): value is TokenPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload['sub'] === 'string' &&
    typeof payload['email'] === 'string' &&
    typeof payload['role'] === 'string' &&
    ROLES.has(payload['role']) &&
    typeof payload['exp'] === 'number'
  );
}
