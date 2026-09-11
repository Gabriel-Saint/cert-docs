import { HttpClient } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  type LoginRequest,
  type LoginResponse,
  type PublicUser,
  type RegisterRequest,
  Role,
} from '@cert-docs/shared';
import { map, type Observable } from 'rxjs';
import { API_URL } from '../api/api-config';
import { decodeSession, isSessionExpired, type Session } from './jwt';
import { TokenStorage } from './token-storage';

/** setTimeout aceita no máximo ~24,8 dias; o token da API expira em 24 horas. */
const MAX_TIMER_MS = 2_147_483_647;

/** Estado da sessão em signals: telas e guards reagem a login, logout e expiração. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TokenStorage);
  private readonly tokenState = signal<string | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly token = this.tokenState.asReadonly();
  readonly session = computed<Session | null>(() =>
    decodeSession(this.tokenState()),
  );
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.session()?.role === Role.ADMIN);

  constructor() {
    this.restore(this.storage.read());
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));
  }

  login(credentials: LoginRequest): Observable<Session> {
    return this.http
      .post<LoginResponse>(`${API_URL}/auth/login`, credentials)
      .pipe(map(({ accessToken }) => this.startSession(accessToken)));
  }

  register(data: RegisterRequest): Observable<PublicUser> {
    return this.http.post<PublicUser>(`${API_URL}/auth/register`, data);
  }

  logout(): void {
    clearTimeout(this.expiryTimer);
    this.storage.clear();
    this.tokenState.set(null);
  }

  /** Consultado na hora da navegação: um computed não reavalia sozinho quando o tempo passa. */
  hasValidSession(now = Date.now()): boolean {
    const session = this.session();
    return session !== null && !isSessionExpired(session, now);
  }

  private startSession(token: string): Session {
    const session = decodeSession(token);
    if (!session || isSessionExpired(session)) {
      this.logout();
      throw new Error('A API devolveu um token inválido ou já expirado');
    }
    this.storage.write(token);
    this.tokenState.set(token);
    this.scheduleExpiry(session);
    return session;
  }

  private restore(token: string | null): void {
    const session = decodeSession(token);
    if (!token || !session || isSessionExpired(session)) {
      // Token velho ou corrompido não fica esquecido no navegador
      if (token) this.storage.clear();
      return;
    }
    this.tokenState.set(token);
    this.scheduleExpiry(session);
  }

  /** Encerra a sessão sozinha quando o token expira, sem esperar a próxima requisição. */
  private scheduleExpiry(session: Session): void {
    clearTimeout(this.expiryTimer);
    const remaining = Math.min(session.expiresAt - Date.now(), MAX_TIMER_MS);
    this.expiryTimer = setTimeout(() => this.logout(), Math.max(remaining, 0));
  }
}
