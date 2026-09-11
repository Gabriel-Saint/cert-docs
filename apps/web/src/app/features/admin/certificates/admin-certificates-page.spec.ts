import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  AdminCertificatesPage,
  SEARCH_DEBOUNCE_MS,
} from './admin-certificates-page';

const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 20 };

describe('AdminCertificatesPage — filtro em tempo real', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [AdminCertificatesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AdminCertificatesPage);
    const httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
    httpMock.expectOne((r) => r.url === '/api/certificates').flush(EMPTY_PAGE);
    TestBed.tick();
    return { root: fixture.nativeElement as HTMLElement, httpMock };
  }

  const historyRequests = (httpMock: HttpTestingController): TestRequest[] =>
    httpMock.match((r) => r.url === '/api/certificates');

  function typeInto(root: HTMLElement, selector: string, value: string) {
    const input = root.querySelector<HTMLInputElement>(selector);
    if (!input) throw new Error(`Campo ${selector} não encontrado`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('pesquisa uma vez só depois que a digitação para', async () => {
    const { root, httpMock } = setup();

    typeInto(root, '#history-q', 'j');
    typeInto(root, '#history-q', 'jo');
    typeInto(root, '#history-q', 'joao ');
    TestBed.tick();
    expect(historyRequests(httpMock)).toHaveLength(0);

    await wait(SEARCH_DEBOUNCE_MS + 50);
    TestBed.tick();

    const requests = historyRequests(httpMock);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.params.get('q')).toBe('joao');
    expect(requests[0].request.params.get('page')).toBe('1');
    requests[0].flush(EMPTY_PAGE);
  });

  it('filtra na hora quando a data muda, sem esperar', () => {
    const { root, httpMock } = setup();

    typeInto(root, '#history-from', '2026-09-01');
    TestBed.tick();

    const requests = historyRequests(httpMock);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.params.get('from')).toBe('2026-09-01');
    requests[0].flush(EMPTY_PAGE);
  });

  it('não repete a busca quando o texto final é o mesmo', async () => {
    const { root, httpMock } = setup();

    typeInto(root, '#history-q', 'ana');
    typeInto(root, '#history-q', '');
    await wait(SEARCH_DEBOUNCE_MS + 50);
    TestBed.tick();

    expect(historyRequests(httpMock)).toHaveLength(0);
  });
});
