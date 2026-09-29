import {
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
  HttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Role } from '@cert-docs/shared';
import { STORAGE_KEY } from '../../testing/tokens';
import {
  authGuard,
  guestGuard,
  HOME_ROUTE,
  roleGuard,
  safeReturnUrl,
} from './auth-guards';
import { authInterceptor, LOGIN_ROUTE } from './auth-interceptor';
import { AuthService } from './auth-service';
import { isSessionExpired } from './jwt';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  });
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpClient),
    httpMock: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

describe('isSessionExpired', () => {
  it('considera a sessão expirada a partir do instante fornecido', () => {
    const session = {
      userId: 'user-1',
      email: 'maria@example.com',
      role: Role.USER,
      expiresAt: 1_000_000,
    };
    expect(isSessionExpired(session, 1_000_000)).toBe(true);
    expect(isSessionExpired(session, 999_999)).toBe(false);
  });
});

describe('AuthService', () => {
  const session = (overrides: Record<string, unknown> = {}) => ({
    userId: 'user-1',
    email: 'maria@example.com',
    role: Role.USER,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('login envia a preferência e expõe a sessão sem guardar o token', () => {
    const { auth, httpMock } = setup();
    const returnedSession = session({ role: Role.ADMIN });
    let email = '';

    auth
      .login({ email: 'admin@example.com', password: 'admin12345' }, true)
      .subscribe((s) => (email = s.email));
    const req = httpMock.expectOne('/api/auth/session/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'admin@example.com',
      password: 'admin12345',
      rememberMe: true,
    });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(returnedSession);

    expect(email).toBe('maria@example.com');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdmin()).toBe(true);
    expect(auth.session()).toEqual(returnedSession);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restaura a sessão validada pelo servidor', async () => {
    const { auth, httpMock } = setup();
    const restored = session();
    const restoring = auth.restoreSession();
    const request = httpMock.expectOne('/api/auth/session');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(restored);
    await restoring;

    expect(auth.hasValidSession()).toBe(true);
    expect(auth.session()).toEqual(restored);
  });

  it('inicia sem sessão quando o cookie não é aceito pela API', async () => {
    const { auth, httpMock } = setup();
    const restoring = auth.restoreSession();
    httpMock
      .expectOne('/api/auth/session')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await restoring;

    expect(auth.isAuthenticated()).toBe(false);
  });

  it('encerra a sessão em memória quando o JWT expira', () => {
    vi.useFakeTimers();
    const { auth, httpMock } = setup();
    auth.login({ email: 'maria@example.com', password: 'senha12345' }).subscribe();
    httpMock
      .expectOne('/api/auth/session/login')
      .flush(session({ expiresAt: Date.now() + 60_000 }));

    expect(auth.isAuthenticated()).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(auth.isAuthenticated()).toBe(false);
    httpMock
      .expectOne('/api/auth/session')
      .flush(null, { status: 204, statusText: 'No Content' });
  });

  it('rejeita resposta de login com sessão inválida', () => {
    const { auth, httpMock } = setup();
    let failed = false;

    auth
      .login({ email: 'a@a.com', password: 'x' })
      .subscribe({ error: () => (failed = true) });
    httpMock
      .expectOne('/api/auth/session/login')
      .flush({ ...session(), role: 'ROOT' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('logout limpa a sessão local e remove o cookie no servidor', () => {
    const { auth, httpMock } = setup();
    auth.login({ email: 'maria@example.com', password: 'senha12345' }).subscribe();
    httpMock.expectOne('/api/auth/session/login').flush(session());

    auth.logout();
    const request = httpMock.expectOne('/api/auth/session');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(auth.session()).toBeNull();
  });
});

describe('authInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('envia credenciais só para a API sem expor o JWT em Authorization', () => {
    const { http, httpMock } = setup();

    http.get('/api/documents').subscribe();
    http.post('/api/auth/session/login', {}).subscribe();
    http.get('/api/public/certificates/CERT-0000-0000-0000').subscribe();
    http.get('https://outro-site.com/api/dados').subscribe();

    const protectedRequest = httpMock.expectOne('/api/documents').request;
    expect(protectedRequest.withCredentials).toBe(true);
    expect(protectedRequest.headers.has('Authorization')).toBe(false);
    const loginRequest = httpMock.expectOne('/api/auth/session/login').request;
    expect(loginRequest.withCredentials).toBe(true);
    expect(loginRequest.headers.has('Authorization')).toBe(false);
    expect(
      httpMock
        .expectOne('/api/public/certificates/CERT-0000-0000-0000')
        .request.headers.has('Authorization'),
    ).toBe(false);
    expect(
      httpMock.expectOne('https://outro-site.com/api/dados').request
        .withCredentials,
    ).toBe(false);
  });

  it('401 em rota protegida encerra a sessão e leva ao login com returnUrl', () => {
    const { auth, http, httpMock, router } = setup();
    vi.spyOn(router, 'url', 'get').mockReturnValue('/meus-certificados');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let received: unknown;

    http
      .get('/api/me/certificates')
      .subscribe({ error: (e) => (received = e) });
    httpMock
      .expectOne('/api/me/certificates')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    httpMock
      .expectOne('/api/auth/session')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(navigate).toHaveBeenCalledWith([LOGIN_ROUTE], {
      queryParams: { returnUrl: '/meus-certificados' },
    });
    expect(received).toBeInstanceOf(HttpErrorResponse);
  });

  it('401 no login não redireciona: o formulário mostra "credenciais inválidas"', () => {
    const { http, httpMock, router } = setup();
    const navigate = vi.spyOn(router, 'navigate');

    http.post('/api/auth/session/login', {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne('/api/auth/session/login')
      .flush(
        { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('guards', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = (url: string) => ({ url }) as RouterStateSnapshot;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('authGuard libera sessão válida e manda para o login sem ela', async () => {
    const { router } = setup();
    const denied = TestBed.runInInjectionContext(() =>
      authGuard(route, state('/cursos')),
    );
    expect(router.serializeUrl(denied as UrlTree)).toBe(
      '/entrar?returnUrl=%2Fcursos',
    );

    TestBed.resetTestingModule();
    const { auth, httpMock } = setup();
    const restoring = auth.restoreSession();
    httpMock.expectOne('/api/auth/session').flush({
      userId: 'user-1',
      email: 'maria@example.com',
      role: Role.USER,
      expiresAt: Date.now() + 60_000,
    });
    await restoring;
    expect(
      TestBed.runInInjectionContext(() => authGuard(route, state('/cursos'))),
    ).toBe(true);
  });

  it('guestGuard tira quem já está logado das telas de entrada', async () => {
    const { auth, httpMock, router } = setup();
    const restoring = auth.restoreSession();
    httpMock.expectOne('/api/auth/session').flush({
      userId: 'user-1',
      email: 'maria@example.com',
      role: Role.USER,
      expiresAt: Date.now() + 60_000,
    });
    await restoring;
    const result = TestBed.runInInjectionContext(() =>
      guestGuard(route, state(LOGIN_ROUTE)),
    );
    expect(router.serializeUrl(result as UrlTree)).toBe(HOME_ROUTE);
  });

  it('roleGuard só libera as roles permitidas', async () => {
    const { auth, httpMock, router } = setup();
    const restoring = auth.restoreSession();
    httpMock.expectOne('/api/auth/session').flush({
      userId: 'user-1',
      email: 'maria@example.com',
      role: Role.USER,
      expiresAt: Date.now() + 60_000,
    });
    await restoring;
    const adminOnly = roleGuard(Role.ADMIN);
    const result = TestBed.runInInjectionContext(() =>
      adminOnly(route, state('/admin/pedidos')),
    );
    expect(router.serializeUrl(result as UrlTree)).toBe(HOME_ROUTE);

    const anyRole = roleGuard(Role.USER, Role.ADMIN);
    expect(
      TestBed.runInInjectionContext(() => anyRole(route, state('/cursos'))),
    ).toBe(true);
  });

  it.each([
    ['/cursos?x=1', '/cursos?x=1'],
    ['https://site-malicioso.com', HOME_ROUTE],
    ['//site-malicioso.com', HOME_ROUTE],
    ['/entrar', HOME_ROUTE],
    [null, HOME_ROUTE],
  ])('safeReturnUrl(%p) → %p', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});
