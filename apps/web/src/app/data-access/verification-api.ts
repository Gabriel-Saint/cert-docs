import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  FileCheckResult,
  PublicCertificateVerification,
} from '@cert-docs/shared';
import type { Observable } from 'rxjs';
import { API_URL } from '../core/api/api-config';

const PUBLIC_URL = `${API_URL}/public/certificates`;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const CODE_BODY = /^[0-9A-HJKMNP-TV-Z]{12}$/;

/**
 * Normaliza o que a pessoa digitou ou colou: aceita minúsculas, espaços, hífens,
 * o link completo de verificação e as confusões O→0 e I/L→1 (mesma regra da API).
 * Retorna CERT-XXXX-XXXX-XXXX ou null se não for um código possível.
 */
export function normalizeVerificationCode(input: string): string | null {
  const fromUrl = input.trim().split('/').filter(Boolean).pop() ?? '';
  let body = fromUrl.toUpperCase().replace(/[\s-]/g, '');
  if (body.length === 16 && body.startsWith('CERT')) body = body.slice(4);
  body = body.replace(/O/g, '0').replace(/[IL]/g, '1');

  if (!CODE_BODY.test(body)) return null;
  return `CERT-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
}

/** Verificação pública de certificados: não usa login. */
@Injectable({ providedIn: 'root' })
export class VerificationApi {
  private readonly http = inject(HttpClient);

  verify(code: string): Observable<PublicCertificateVerification> {
    return this.http.get<PublicCertificateVerification>(
      `${PUBLIC_URL}/${encodeURIComponent(code)}`,
    );
  }

  /** Envia o PDF para conferir se é exatamente o arquivo emitido. O arquivo não é guardado. */
  checkFile(
    code: string,
    file: Blob,
    fileName = 'certificado.pdf',
  ): Observable<FileCheckResult> {
    const form = new FormData();
    form.append('file', file, fileName);
    return this.http.post<FileCheckResult>(
      `${PUBLIC_URL}/${encodeURIComponent(code)}/file-check`,
      form,
    );
  }
}
