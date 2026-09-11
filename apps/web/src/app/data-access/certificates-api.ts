import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CertificateDetailView,
  CertificateHistoryItem,
  CertificateHistoryQuery,
  MyCertificateView,
  Page,
} from '@cert-docs/shared';
import { map, type Observable } from 'rxjs';
import { API_URL } from '../core/api/api-config';
import { FileSaver } from '../core/files/file-saver';

const CERTIFICATES_URL = `${API_URL}/certificates`;

/** Remove filtros vazios para não mandar `?q=&status=` na URL. */
export function historyParams(query: CertificateHistoryQuery): HttpParams {
  return Object.entries(query).reduce((params, [key, value]) => {
    if (value === undefined || value === null) return params;
    const text = String(value).trim();
    return text ? params.set(key, text) : params;
  }, new HttpParams());
}

@Injectable({ providedIn: 'root' })
export class CertificatesApi {
  private readonly http = inject(HttpClient);
  private readonly fileSaver = inject(FileSaver);

  mine(): Observable<MyCertificateView[]> {
    return this.http.get<MyCertificateView[]>(`${API_URL}/me/certificates`);
  }

  /** Histórico do ADMIN, paginado. */
  history(
    query: CertificateHistoryQuery = {},
  ): Observable<Page<CertificateHistoryItem>> {
    return this.http.get<Page<CertificateHistoryItem>>(CERTIFICATES_URL, {
      params: historyParams(query),
    });
  }

  detail(id: string): Observable<CertificateDetailView> {
    return this.http.get<CertificateDetailView>(
      `${CERTIFICATES_URL}/${encodeURIComponent(id)}`,
    );
  }

  /** Baixa o PDF guardado na emissão e salva no computador. Emite o nome do arquivo. */
  downloadPdf(id: string): Observable<string> {
    return this.http
      .get(`${CERTIFICATES_URL}/${encodeURIComponent(id)}/pdf`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) =>
          this.fileSaver.saveResponse(response, `certificado-${id}.pdf`),
        ),
      );
  }

  revoke(id: string, reason: string): Observable<void> {
    return this.http.post<void>(
      `${CERTIFICATES_URL}/${encodeURIComponent(id)}/revoke`,
      {
        reason: reason.trim(),
      },
    );
  }
}
