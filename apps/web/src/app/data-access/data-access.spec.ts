import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FileSaver } from '../core/files/file-saver';
import { CertificateRequestsApi } from './certificate-requests-api';
import { CertificatesApi, historyParams } from './certificates-api';
import { CoursesApi, totalWorkload } from './courses-api';
import { DocumentsApi } from './documents-api';
import { UsersApi } from './users-api';
import { normalizeVerificationCode, VerificationApi } from './verification-api';

describe('APIs do front', () => {
  let httpMock: HttpTestingController;
  const fileSaver = { saveResponse: vi.fn(() => 'arquivo.pdf') };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FileSaver, useValue: fileSaver },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fileSaver.saveResponse.mockClear();
  });

  afterEach(() => httpMock.verify());

  it('DocumentsApi chama as rotas de documentos e salva o PDF', () => {
    const api = TestBed.inject(DocumentsApi);

    api.list().subscribe();
    api.get('doc 1').subscribe();
    api.create({ title: 'T', content: 'C' }).subscribe();
    api.update('d1', { title: 'Novo' }).subscribe();
    api.remove('d1').subscribe();
    let savedAs = '';
    api.downloadPdf('d1').subscribe((name) => (savedAs = name));

    httpMock.expectOne({ method: 'GET', url: '/api/documents' }).flush([]);
    httpMock
      .expectOne({ method: 'GET', url: '/api/documents/doc%201' })
      .flush({});
    expect(
      httpMock.expectOne({ method: 'POST', url: '/api/documents' }).request
        .body,
    ).toEqual({ title: 'T', content: 'C' });
    expect(
      httpMock.expectOne({ method: 'PATCH', url: '/api/documents/d1' }).request
        .body,
    ).toEqual({ title: 'Novo' });
    httpMock
      .expectOne({ method: 'DELETE', url: '/api/documents/d1' })
      .flush(null);

    const pdf = httpMock.expectOne({
      method: 'GET',
      url: '/api/documents/d1/pdf',
    });
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['%PDF']));
    expect(savedAs).toBe('arquivo.pdf');
    expect(fileSaver.saveResponse).toHaveBeenCalledWith(
      expect.anything(),
      'documento-d1.pdf',
    );
  });

  it('UsersApi e CoursesApi', () => {
    TestBed.inject(UsersApi).list().subscribe();
    const courses = TestBed.inject(CoursesApi);
    courses.list().subscribe();
    courses
      .create({
        title: 'Curso',
        coordinator: 'Prof',
        modules: [{ title: 'M1', hours: 4 }],
      })
      .subscribe();
    courses.update('c1', { modules: [{ title: 'M2', hours: 2 }] }).subscribe();
    courses.deactivate('c1').subscribe();

    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush([]);
    httpMock.expectOne({ method: 'GET', url: '/api/courses' }).flush([]);
    httpMock.expectOne({ method: 'POST', url: '/api/courses' }).flush({});
    httpMock.expectOne({ method: 'PATCH', url: '/api/courses/c1' }).flush({});
    httpMock
      .expectOne({ method: 'DELETE', url: '/api/courses/c1' })
      .flush(null);
  });

  it('totalWorkload soma só horas válidas enquanto o formulário é preenchido', () => {
    expect(totalWorkload([{ hours: 6 }, { hours: 8 }])).toBe(14);
    expect(
      totalWorkload([{ hours: 6 }, {}, { hours: -2 }, { hours: 1.5 }]),
    ).toBe(6);
  });

  it('CertificateRequestsApi: pedido, fila com filtro, aprovação e recusa', () => {
    const api = TestBed.inject(CertificateRequestsApi);

    api.request('seed-curso-nestjs').subscribe();
    api.mine().subscribe();
    api.list().subscribe();
    api.list('PENDING').subscribe();
    api
      .approve('r1', { startDate: '2026-08-04', completionDate: '2026-09-11' })
      .subscribe();
    api.reject('r1', '  Falta entregar o projeto.  ').subscribe();

    expect(
      httpMock.expectOne({ method: 'POST', url: '/api/certificate-requests' })
        .request.body,
    ).toEqual({
      courseId: 'seed-curso-nestjs',
    });
    httpMock.expectOne('/api/me/certificate-requests').flush([]);
    httpMock
      .expectOne(
        (req) =>
          req.url === '/api/certificate-requests' &&
          req.method === 'GET' &&
          !req.params.has('status'),
      )
      .flush([]);
    httpMock.expectOne('/api/certificate-requests?status=PENDING').flush([]);
    expect(
      httpMock.expectOne('/api/certificate-requests/r1/approve').request.body,
    ).toEqual({
      startDate: '2026-08-04',
      completionDate: '2026-09-11',
    });
    expect(
      httpMock.expectOne('/api/certificate-requests/r1/reject').request.body,
    ).toEqual({
      reason: 'Falta entregar o projeto.',
    });
  });

  it('CertificatesApi: meus, histórico sem filtros vazios, detalhe, download e revogação', () => {
    const api = TestBed.inject(CertificatesApi);

    api.mine().subscribe();
    api
      .history({
        q: '  maria ',
        status: undefined,
        page: 2,
        from: '',
        pageSize: 20,
      })
      .subscribe();
    api.detail('c1').subscribe();
    api.downloadPdf('c1').subscribe();
    api.revoke('c1', 'Emitido para o curso errado.').subscribe();

    httpMock.expectOne('/api/me/certificates').flush([]);
    const history = httpMock.expectOne(
      (req) => req.url === '/api/certificates' && req.method === 'GET',
    );
    expect(history.request.params.keys().sort()).toEqual([
      'page',
      'pageSize',
      'q',
    ]);
    expect(history.request.params.get('q')).toBe('maria');
    history.flush({ items: [], total: 0, page: 2, pageSize: 20 });
    httpMock.expectOne('/api/certificates/c1').flush({});
    httpMock.expectOne('/api/certificates/c1/pdf').flush(new Blob(['%PDF']));
    expect(fileSaver.saveResponse).toHaveBeenCalledWith(
      expect.anything(),
      'certificado-c1.pdf',
    );
    expect(
      httpMock.expectOne('/api/certificates/c1/revoke').request.body,
    ).toEqual({
      reason: 'Emitido para o curso errado.',
    });
    expect(historyParams({}).keys()).toEqual([]);
  });

  it('VerificationApi envia o PDF como multipart', () => {
    const api = TestBed.inject(VerificationApi);
    api.verify('CERT-7K3F-9QX2-M8PD').subscribe();
    api
      .checkFile('CERT-7K3F-9QX2-M8PD', new Blob(['%PDF']), 'meu.pdf')
      .subscribe();

    httpMock
      .expectOne('/api/public/certificates/CERT-7K3F-9QX2-M8PD')
      .flush({});
    const upload = httpMock.expectOne(
      '/api/public/certificates/CERT-7K3F-9QX2-M8PD/file-check',
    );
    const body = upload.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('meu.pdf');
    upload.flush({ matches: true });
  });

  it.each([
    ['CERT-7K3F-9QX2-M8PD', 'CERT-7K3F-9QX2-M8PD'],
    ['cert 7k3f 9qx2 m8pd', 'CERT-7K3F-9QX2-M8PD'],
    ['7K3F9QX2M8PD', 'CERT-7K3F-9QX2-M8PD'],
    [
      'http://localhost:4200/verificar/CERT-7K3F-9QX2-M8PD',
      'CERT-7K3F-9QX2-M8PD',
    ],
    ['CERT-7K3F-9QX2-M8PO', 'CERT-7K3F-9QX2-M8P0'],
    ['CERT-7K3F', null],
    ['CERT-7K3F-9QX2-M8PU', null],
    ['', null],
  ])('normalizeVerificationCode(%p) → %p', (input, expected) => {
    expect(normalizeVerificationCode(input)).toBe(expected);
  });
});
