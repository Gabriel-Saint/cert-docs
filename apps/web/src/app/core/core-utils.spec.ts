import {
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { readApiError, toApiError } from './api/api-error';
import { FileSaver, fileNameFromDisposition } from './files/file-saver';
import { cpfValidator, maskCpfInput } from './forms/cpf-field';

const httpError = (status: number, error: unknown = null) =>
  new HttpErrorResponse({ status, error, statusText: 'erro' });

describe('toApiError', () => {
  it('usa a mensagem de negócio da API quando há code', () => {
    expect(
      toApiError(
        httpError(409, {
          statusCode: 409,
          code: 'EMAIL_OR_CPF_IN_USE',
          message: 'Email ou CPF já cadastrado',
        }),
      ),
    ).toEqual({
      status: 409,
      code: 'EMAIL_OR_CPF_IN_USE',
      message: 'Email ou CPF já cadastrado',
      details: [],
    });
  });

  it('transforma erro de validação em mensagem geral com detalhes', () => {
    const result = toApiError(
      httpError(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: ['name must be longer than or equal to 2 characters'],
      }),
    );
    expect(result.message).toBe('Confira os dados informados.');
    expect(result.details).toEqual([
      'name must be longer than or equal to 2 characters',
    ]);
  });

  it.each([
    [0, 'Não foi possível conectar'],
    [403, 'não tem permissão'],
    [413, '5 MB'],
    [429, 'Aguarde um minuto'],
    [500, 'Algo deu errado'],
    [502, 'Algo deu errado'],
  ])('status %i sem code usa mensagem amigável', (status, fragment) => {
    expect(
      toApiError(httpError(status, { message: 'Internal server error' }))
        .message,
    ).toContain(fragment);
  });

  it('erro que não é HTTP vira mensagem genérica', () => {
    expect(toApiError(new Error('boom')).message).toContain('Algo deu errado');
  });

  it('lê o corpo do erro de downloads (Blob)', async () => {
    const blob = new Blob(
      [
        JSON.stringify({
          code: 'CERTIFICATE_NOT_FOUND',
          message: 'Certificado não encontrado',
        }),
      ],
      {
        type: 'application/json',
      },
    );
    const result = await readApiError(httpError(404, blob));
    expect(result).toMatchObject({
      code: 'CERTIFICATE_NOT_FOUND',
      message: 'Certificado não encontrado',
    });

    const broken = await readApiError(httpError(404, new Blob(['<html>'])));
    expect(broken.message).toBe('Não encontramos o que você procurou.');
  });
});

describe('arquivos', () => {
  it.each([
    [
      'attachment; filename="certificado-CERT-7K3F-9QX2-M8PD.pdf"',
      'certificado-CERT-7K3F-9QX2-M8PD.pdf',
    ],
    ["attachment; filename*=UTF-8''certid%C3%A3o.pdf", 'certidão.pdf'],
    ['attachment; filename=documento.pdf', 'documento.pdf'],
    ['attachment; filename="../../etc/passwd"', '.._.._etc_passwd'],
    ['inline', null],
    [null, null],
  ])('fileNameFromDisposition(%p) → %p', (header, expected) => {
    expect(fileNameFromDisposition(header)).toBe(expected);
  });

  it('salva usando o nome do cabeçalho e cai para o nome padrão sem ele', () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const saver = TestBed.inject(FileSaver);

    const withHeader = new HttpResponse({
      body: new Blob(['%PDF']),
      headers: new HttpHeaders({
        'Content-Disposition': 'attachment; filename="documento-1-529-25.pdf"',
      }),
    });
    expect(saver.saveResponse(withHeader, 'padrao.pdf')).toBe(
      'documento-1-529-25.pdf',
    );
    expect(
      saver.saveResponse(
        new HttpResponse({ body: new Blob(['%PDF']) }),
        'padrao.pdf',
      ),
    ).toBe('padrao.pdf');
    expect(click).toHaveBeenCalledTimes(2);
    expect(() =>
      saver.saveResponse(new HttpResponse<Blob>({ body: null }), 'x.pdf'),
    ).toThrow();
  });
});

describe('campo de CPF', () => {
  it.each([
    ['', null],
    ['529.982.247-25', null],
    ['52998224725', null],
    ['529.982.247-24', { cpf: true }],
    ['111.111.111-11', { cpf: true }],
  ])('cpfValidator(%p) → %p', (value, expected) => {
    expect(cpfValidator(new FormControl(value))).toEqual(expected);
  });

  it.each([
    ['5', '5'],
    ['5299', '529.9'],
    ['5299822', '529.982.2'],
    ['52998224725', '529.982.247-25'],
    ['529.982.247-2599', '529.982.247-25'],
    ['abc529xyz982', '529.982'],
  ])('maskCpfInput(%p) → %p', (input, expected) => {
    expect(maskCpfInput(input)).toBe(expected);
  });
});
