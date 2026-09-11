import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appRoutes } from './app.routes';
import { makeToken, STORAGE_KEY } from './testing/tokens';

describe('rotas da verificação de certificado', () => {
  async function open(url: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return harness.fixture.nativeElement as HTMLElement;
  }

  afterEach(() => localStorage.clear());

  it('visitante vê a página pública, sem o menu', async () => {
    const page = await open('/verificar');

    expect(page.querySelector('app-verify-search-page')).not.toBeNull();
    expect(page.querySelector('app-public-header')).not.toBeNull();
    expect(page.querySelector('app-shell')).toBeNull();
  });

  it('logado abre a mesma página dentro do menu', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken());
    const page = await open('/verificar');

    expect(
      page.querySelector('app-shell app-verify-search-page'),
    ).not.toBeNull();
    expect(page.querySelector('app-public-header')).toBeNull();
  });

  it('link do QR Code também abre dentro do menu para quem está logado', async () => {
    localStorage.setItem(STORAGE_KEY, makeToken());
    const page = await open('/verificar/CERT-7K3F-9QX2-M8PD');

    expect(
      page.querySelector('app-shell app-verify-result-page'),
    ).not.toBeNull();
    expect(page.querySelector('app-public-header')).toBeNull();
  });
});
