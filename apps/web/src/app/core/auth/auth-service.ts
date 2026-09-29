import { HttpClient } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  type AuthSession,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
  Role,
} from '@cert-docs/shared';
import { firstValueFrom, map, timeout, type Observable } from 'rxjs';
import { API_URL } from '../api/api-config';
import { isSessionExpired } from './jwt';
import { TokenStorage } from './token-storage';

export type Session = AuthSession;

/** setTimeout aceita no máximo ~24,8 dias; o token da API expira em 24 horas. */
const MAX_TIMER_MS = 2_147_483_647;
const SESSION_RESTORE_TIMEOUT_MS = 5_000;

/** Estado da sessão em signals: telas e guards reagem a login, logout e expiração. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TokenStorage);
  private readonly sessionState = signal<Session | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.session()?.role === Role.ADMIN);

  constructor() {
    this.storage.clear();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));
  }

  login(credentials: LoginRequest, rememberMe = false): Observable<Session> {
    return this.http
      .post<Session>(`${API_URL}/auth/session/login`, {
        ...credentials,
        rememberMe,
      })
      .pipe(map((session) => this.startSession(session)));
  }

  register(data: RegisterRequest): Observable<PublicUser> {
    return this.http.post<PublicUser>(`${API_URL}/auth/register`, data);
  }

  logout(): void {
    clearTimeout(this.expiryTimer);
    this.storage.clear();
    this.sessionState.set(null);
    this.http.delete<void>(`${API_URL}/auth/session`).subscribe({
      error: () => undefined,
    });
  }

  async restoreSession(): Promise<void> {
    try {
      const session = await firstValueFrom(
        this.http
          .get<Session>(`${API_URL}/auth/session`)
          .pipe(timeout({ first: SESSION_RESTORE_TIMEOUT_MS })),
      );
      this.startSession(session);
    } catch {
      this.sessionState.set(null);
    }
  }

  /** Consultado na hora da navegação: um computed não reavalia sozinho quando o tempo passa. */
  hasValidSession(now = Date.now()): boolean {
    const session = this.session();
    return session !== null && !isSessionExpired(session, now);
  }

  private startSession(session: Session): Session {
    if (
      !session.userId ||
      !session.email ||
      !Object.values(Role).includes(session.role) ||
      !Number.isFinite(session.expiresAt) ||
      isSessionExpired(session)
    ) {
      this.sessionState.set(null);
      throw new Error('A API devolveu uma sessão inválida ou já expirada');
    }
    this.sessionState.set(session);
    this.scheduleExpiry(session);
    return session;
  }

  /** Encerra a sessão sozinha quando o token expira, sem esperar a próxima requisição. */
  private scheduleExpiry(session: Session): void {
    clearTimeout(this.expiryTimer);
    const remaining = Math.min(session.expiresAt - Date.now(), MAX_TIMER_MS);
    this.expiryTimer = setTimeout(() => this.logout(), Math.max(remaining, 0));
  }
}
