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
import { makeToken, STORAGE_KEY } from '../../testing/tokens';
import {
  authGuard,
  guestGuard,
  HOME_ROUTE,
  roleGuard,
  safeReturnUrl,
} from './auth-guards';
import { authInterceptor, LOGIN_ROUTE } from './auth-interceptor';
import { AuthService } from './auth-service';
import { decodeSession, isSessionExpired } from './jwt';

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

const nowInSeconds = () => Math.floor(Date.now() / 1000);

describe('decodeSession', () => {
  it('lê sub, email, role e expiração, inclusive com acentos no payload', () => {
    const token = makeToken({
      sub: 'u-1',
      email: 'joão@exemplo.com',
      role: Role.ADMIN,
      exp: 2_000_000_000,
    });

    expect(decodeSession(token)).toEqual({
      userId: 'u-1',
      email: 'joão@exemplo.com',
      role: Role.ADMIN,
      expiresAt: 2_000_000_000_000,
    });
  });

  it.each([
    ['nulo', null],
    ['sem partes', 'abc'],
    ['payload que não é JSON', 'a.bm9wZQ.c'],
    ['role desconhecida', makeToken({ role: 'SUPERUSER' })],
  ])('retorna null para token %s', (_, token) => {
    expect(decodeSession(token)).toBeNull();
  });

  it('considera expirado a partir do instante exp', () => {
    const session = decodeSession(makeToken({ exp: 1000 }));
    expect(session && isSessionExpired(session, 1_000_000)).toBe(true);
    expect(session && isSessionExpired(session, 999_999)).toBe(false);
  });
});

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('login guarda o token e expõe a sessão em signals', () => {
    const { auth, http, httpMock } = setup();
    const token = makeToken({ role: Role.ADMIN });
    let email = '';

    auth
      .login({ email: 'admin@example.com', password: 'admin12345' })
      .subscribe((s) => (email = s.email));
    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ accessToken: token });

    expect(email).toBe('maria@example.com');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdmin()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(token);
    void http;
  });

  it('restaura sessão válida do storage e descarta token expirado ou corrompido', () => {
    localStorage.setItem(STORAGE_KEY, makeToken());
    expect(setup().auth.hasValidSession()).toBe(true);

    TestBed.resetTestingModule();
    localStorage.setItem(STORAGE_KEY, makeToken({ exp: nowInSeconds() - 10 }));
    expect(setup().auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    TestBed.resetTestingModule();
    localStorage.setItem(STORAGE_KEY, 'lixo');
    expect(setup().auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('encerra a sessão sozinha quando o token expira', () => {
    vi.useFakeTimers();
    localStorage.setItem(STORAGE_KEY, makeToken({ exp: nowInSeconds() + 60 }));
    const { auth } = setup();

    expect(auth.isAuthenticated()).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejeita resposta de login com token inválido sem criar sessão', () => {
    const { auth, httpMock } = setup();
    let failed = false;

    auth
      .login({ email: 'a@a.com', password: 'x' })
      .subscribe({ error: () => (failed = true) });
    httpMock.expectOne('/api/auth/login').flush({ accessToken: 'invalido' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('logout limpa token e storage', () => {
    localStorage.setItem(STORAGE_KEY, makeToken());
    const { auth } = setup();

    auth.logout();

    expect(auth.token()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('authInterceptor', () => {
  beforeEach(() => localStorage.clear());

  it('envia o token só para rotas protegidas da própria API', () => {
    localStorage.setItem(STORAGE_KEY, makeToken());
    const { http, httpMock } = setup();

    http.get('/api/documents').subscribe();
    http.post('/api/auth/login', {}).subscribe();
    http.get('/api/public/certificates/CERT-0000-0000-0000').subscribe();
    http.get('https://outro-site.com/api/dados').subscribe();

    expect(
      httpMock.expectOne('/api/documents').request.headers.get('Authorization'),
    ).toMatch(/^Bearer /);
    expect(
      httpMock
        .expectOne('/api/auth/login')
        .request.headers.has('Authorization'),
    ).toBe(false);
    expect(
      httpMock
        .expectOne('/api/public/certificates/CERT-0000-0000-0000')
        .request.headers.has('Authorization'),
    ).toBe(false);
    expect(
      httpMock
        .expectOne('https://outro-site.com/api/dados')
        .request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('401 em rota protegida encerra a sessão e leva ao login com returnUrl', () => {
    localStorage.setItem(STORAGE_KEY, makeToken());
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
    expect(navigate).toHaveBeenCalledWith([LOGIN_ROUTE], {
      queryParams: { returnUrl: '/meus-certificados' },
    });
    expect(received).toBeInstanceOf(HttpErrorResponse);
  });

  it('401 no login não redireciona: o formulário mostra "credenciais inválidas"', () => {
    const { http, httpMock, router } = setup();
    const navigate = vi.spyOn(router, 'navigate');

    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne('/api/auth/login')
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

  beforeEach(() => localStorage.clear());

  it('authGuard libera sessão válida e manda para o login sem ela', () => {
    const { router } = setup();
    const denied = TestBed.runInInjectionContext(() =>
      authGuard(route, state('/cursos')),
    );
    expect(router.serializeUrl(denied as UrlTree)).toBe(
      '/entrar?returnUrl=%2Fcursos',
    );

    TestBed.resetTestingModule();
    localStorage.setItem(STORAGE_KEY, makeToken());
    setup();
    expect(
      TestBed.runInInjectionContext(() => authGuard(route, state('/cursos'))),
    ).toBe(true);
  });

  it('guestGuard tira quem já está logado das telas de entrada', () => {
    localStorage.setItem(STORAGE_KEY, makeToken());
    const { router } = setup();
    const result = TestBed.runInInjectionContext(() =>
      guestGuard(route, state(LOGIN_ROUTE)),
    );
    expect(router.serializeUrl(result as UrlTree)).toBe(HOME_ROUTE);
  });

  it('roleGuard só libera as roles permitidas', () => {
    localStorage.setItem(STORAGE_KEY, makeToken({ role: Role.USER }));
    const { router } = setup();
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
