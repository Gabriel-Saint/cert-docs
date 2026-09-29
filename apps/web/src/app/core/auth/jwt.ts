import type { AuthSession } from '@cert-docs/shared';

export type Session = AuthSession;

export function isSessionExpired(session: Session, now = Date.now()): boolean {
  return session.expiresAt <= now;
}
