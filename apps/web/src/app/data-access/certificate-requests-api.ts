import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  ApproveCertificateRequestBody,
  CertificateRequestStatus,
  CertificateRequestView,
  MyCertificateRequestView,
  MyCertificateView,
} from '@cert-docs/shared';
import type { Observable } from 'rxjs';
import { API_URL } from '../core/api/api-config';

const REQUESTS_URL = `${API_URL}/certificate-requests`;

/** Mesmos limites da API para o motivo de recusa ou revogação. */
export const REASON_LENGTH = { min: 10, max: 500 } as const;

@Injectable({ providedIn: 'root' })
export class CertificateRequestsApi {
  private readonly http = inject(HttpClient);

  /** Aluno solicita o certificado de um curso. */
  request(courseId: string): Observable<MyCertificateRequestView> {
    return this.http.post<MyCertificateRequestView>(REQUESTS_URL, { courseId });
  }

  /** Pedidos do usuário logado, mais recentes primeiro. */
  mine(): Observable<MyCertificateRequestView[]> {
    return this.http.get<MyCertificateRequestView[]>(
      `${API_URL}/me/certificate-requests`,
    );
  }

  /** Fila do ADMIN, mais antigos primeiro. */
  list(
    status?: CertificateRequestStatus,
  ): Observable<CertificateRequestView[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<CertificateRequestView[]>(REQUESTS_URL, { params });
  }

  /** Aprova e emite o certificado. As datas vão no formato AAAA-MM-DD. */
  approve(
    id: string,
    body: ApproveCertificateRequestBody,
  ): Observable<MyCertificateView> {
    return this.http.post<MyCertificateView>(
      `${REQUESTS_URL}/${encodeURIComponent(id)}/approve`,
      body,
    );
  }

  reject(id: string, reason: string): Observable<void> {
    return this.http.post<void>(
      `${REQUESTS_URL}/${encodeURIComponent(id)}/reject`,
      {
        reason: reason.trim(),
      },
    );
  }
}
