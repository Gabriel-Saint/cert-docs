import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import type {
  CourseView,
  MyCertificateRequestView,
  MyCertificateView,
} from '@cert-docs/shared';
import { makeToken } from '../testing/tokens';
import { LoginPage } from './auth/login-page';
import { CourseFormDialog } from './admin/courses/course-form-dialog';
import { certificateStateFor } from './courses/certificate-state';

const course = { id: 'course-1', title: 'Angular' };

function request(
  overrides: Partial<MyCertificateRequestView>,
): MyCertificateRequestView {
  return {
    id: 'req-1',
    course,
    status: 'PENDING',
    requestedAt: '2026-09-01T10:00:00.000Z',
    reviewedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

function certificate(overrides: Partial<MyCertificateView>): MyCertificateView {
  return {
    id: 'cert-1',
    code: 'ABCD-EFGH-JKMN',
    course,
    status: 'VALID',
    issuedAt: '2026-09-02T10:00:00.000Z',
    verificationUrl: 'http://localhost:4200/verificar/ABCD-EFGH-JKMN',
    ...overrides,
  };
}

function typeInto(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Campo ${selector} não encontrado`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function clickButton(root: HTMLElement, label: string): void {
  const button = Array.from(root.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label),
  );
  if (!button) throw new Error(`Botão "${label}" não encontrado`);
  button.click();
}

describe('certificateStateFor', () => {
  it('permite solicitar quando não há pedido nem certificado', () => {
    expect(certificateStateFor(course.id, [], [])).toEqual({
      kind: 'available',
      lastRejection: null,
    });
  });

  it('mostra o pedido em análise', () => {
    const pending = request({});
    expect(certificateStateFor(course.id, [pending], [])).toEqual({
      kind: 'pending',
      request: pending,
    });
  });

  it('certificado válido tem prioridade sobre pedidos', () => {
    const valid = certificate({});
    const state = certificateStateFor(course.id, [request({})], [valid]);
    expect(state).toEqual({ kind: 'issued', certificate: valid });
  });

  it('certificado revogado volta a permitir solicitação', () => {
    const state = certificateStateFor(
      course.id,
      [request({ status: 'APPROVED' })],
      [certificate({ status: 'REVOKED' })],
    );
    expect(state).toEqual({ kind: 'available', lastRejection: null });
  });

  it('expõe a recusa mais recente para mostrar o motivo', () => {
    const rejected = request({
      id: 'req-2',
      status: 'REJECTED',
      rejectionReason: 'Carga horária incompleta',
    });
    const older = request({ id: 'req-1', status: 'REJECTED' });
    expect(certificateStateFor(course.id, [rejected, older], [])).toEqual({
      kind: 'available',
      lastRejection: rejected,
    });
  });

  it('ignora pedidos de outros cursos', () => {
    const other = request({ course: { id: 'course-2', title: 'Nest' } });
    expect(certificateStateFor(course.id, [other], []).kind).toBe('available');
  });
});

describe('LoginPage', () => {
  async function setup(returnUrl?: string) {
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(LoginPage);
    if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    return {
      fixture,
      root: fixture.nativeElement as HTMLElement,
      httpMock: TestBed.inject(HttpTestingController),
      navigate,
    };
  }

  afterEach(() => localStorage.clear());

  it('não chama a API com o formulário inválido', async () => {
    const { root, httpMock, fixture } = await setup();
    clickButton(root, 'Entrar');
    await fixture.whenStable();
    httpMock.expectNone('/api/auth/login');
    expect(root.textContent).toContain('Informe o email.');
  });

  it('entra e volta para a página pedida', async () => {
    const { root, httpMock, navigate } = await setup('/meus-certificados');
    typeInto(root, '#login-email', 'maria@example.com');
    typeInto(root, '#login-password', 'segredo123');
    clickButton(root, 'Entrar');

    const call = httpMock.expectOne('/api/auth/login');
    expect(call.request.body).toEqual({
      email: 'maria@example.com',
      password: 'segredo123',
    });
    call.flush({ accessToken: makeToken() });

    expect(navigate).toHaveBeenCalledWith('/meus-certificados');
  });

  it('mostra o erro da API, mantém o email e limpa a senha', async () => {
    const { root, httpMock, fixture, navigate } = await setup();
    typeInto(root, '#login-email', 'maria@example.com');
    typeInto(root, '#login-password', 'errada');
    clickButton(root, 'Entrar');

    httpMock.expectOne('/api/auth/login').flush(
      {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou senha inválidos',
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    await vi.waitFor(() =>
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'Email ou senha inválidos',
      ),
    );
    await fixture.whenStable();

    expect(root.querySelector<HTMLInputElement>('#login-email')?.value).toBe(
      'maria@example.com',
    );
    expect(root.querySelector<HTMLInputElement>('#login-password')?.value).toBe(
      '',
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('CourseFormDialog', () => {
  async function setup(data: CourseView | null) {
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [CourseFormDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(CourseFormDialog);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement, dialogRef };
  }

  const submit = (root: HTMLElement) =>
    root.querySelector('form')?.dispatchEvent(new Event('submit'));

  it('soma a carga horária dos módulos e fecha com o corpo da API', async () => {
    const { root, fixture, dialogRef } = await setup(null);
    typeInto(root, '#course-title', '  Angular Avançado ');
    typeInto(root, '#course-coordinator', 'Profa. Ana Lima');
    typeInto(root, '#module-title-0', 'Signals');
    typeInto(root, '#module-hours-0', '20');
    clickButton(root, 'Adicionar módulo');
    await fixture.whenStable();
    typeInto(root, '#module-title-1', 'SSR');
    typeInto(root, '#module-hours-1', '12');
    await fixture.whenStable();

    expect(root.textContent).toContain('Total: 32 horas');

    submit(root);
    expect(dialogRef.close).toHaveBeenCalledWith({
      title: 'Angular Avançado',
      coordinator: 'Profa. Ana Lima',
      modules: [
        { title: 'Signals', hours: 20 },
        { title: 'SSR', hours: 12 },
      ],
    });
  });

  it('reordena módulos ao editar um curso existente', async () => {
    const { root, fixture, dialogRef } = await setup({
      id: 'course-1',
      title: 'Nest',
      description: 'Backend',
      coordinator: 'Carlos',
      workloadHours: 30,
      modules: [
        { title: 'Módulos', hours: 10 },
        { title: 'Guards', hours: 20 },
      ],
    });
    root
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Mover módulo para baixo"]',
      )
      ?.click();
    await fixture.whenStable();

    submit(root);
    expect(dialogRef.close).toHaveBeenCalledWith({
      title: 'Nest',
      coordinator: 'Carlos',
      description: 'Backend',
      modules: [
        { title: 'Guards', hours: 20 },
        { title: 'Módulos', hours: 10 },
      ],
    });
  });

  it('não fecha com módulo sem horas válidas', async () => {
    const { root, fixture, dialogRef } = await setup(null);
    typeInto(root, '#course-title', 'Angular');
    typeInto(root, '#course-coordinator', 'Ana');
    typeInto(root, '#module-title-0', 'Intro');
    typeInto(root, '#module-hours-0', '0');

    submit(root);
    await fixture.whenStable();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Cada módulo precisa de título');
  });
});
