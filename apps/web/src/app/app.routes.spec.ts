import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from './core/auth/auth-service';
import { appRoutes } from './app.routes';

describe('rotas da verificação de certificado', () => {
  async function open(url: string, authenticated = false): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    if (authenticated) {
      const restoring = TestBed.inject(AuthService).restoreSession();
      TestBed.inject(HttpTestingController)
        .expectOne('/api/auth/session')
        .flush({
          userId: 'user-1',
          email: 'maria@example.com',
          role: 'USER',
          expiresAt: Date.now() + 60_000,
        });
      await restoring;
    }
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return harness.fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('visitante vê a página pública, sem o menu', async () => {
    const page = await open('/verificar');

    expect(page.querySelector('app-verify-search-page')).not.toBeNull();
    expect(page.querySelector('app-public-header')).not.toBeNull();
    expect(page.querySelector('app-shell')).toBeNull();
  });

  it('logado abre a mesma página dentro do menu', async () => {
    const page = await open('/verificar', true);

    expect(
      page.querySelector('app-shell app-verify-search-page'),
    ).not.toBeNull();
    expect(page.querySelector('app-public-header')).toBeNull();
  });

  it('link do QR Code também abre dentro do menu para quem está logado', async () => {
    const page = await open('/verificar/CERT-7K3F-9QX2-M8PD', true);

    expect(
      page.querySelector('app-shell app-verify-result-page'),
    ).not.toBeNull();
    expect(page.querySelector('app-public-header')).toBeNull();
  });
});
