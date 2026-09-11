import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CreateDocumentRequest,
  DocumentDetail,
  DocumentSummary,
  UpdateDocumentRequest,
} from '@cert-docs/shared';
import { map, type Observable } from 'rxjs';
import { API_URL } from '../core/api/api-config';
import { FileSaver } from '../core/files/file-saver';

const DOCUMENTS_URL = `${API_URL}/documents`;

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly http = inject(HttpClient);
  private readonly fileSaver = inject(FileSaver);

  list(): Observable<DocumentSummary[]> {
    return this.http.get<DocumentSummary[]>(DOCUMENTS_URL);
  }

  get(id: string): Observable<DocumentDetail> {
    return this.http.get<DocumentDetail>(
      `${DOCUMENTS_URL}/${encodeURIComponent(id)}`,
    );
  }

  /** Baixa o PDF com o CPF do usuário logado e salva no computador. Emite o nome do arquivo. */
  downloadPdf(id: string): Observable<string> {
    return this.http
      .get(`${DOCUMENTS_URL}/${encodeURIComponent(id)}/pdf`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) =>
          this.fileSaver.saveResponse(response, `documento-${id}.pdf`),
        ),
      );
  }

  create(data: CreateDocumentRequest): Observable<DocumentDetail> {
    return this.http.post<DocumentDetail>(DOCUMENTS_URL, data);
  }

  update(
    id: string,
    changes: UpdateDocumentRequest,
  ): Observable<DocumentDetail> {
    return this.http.patch<DocumentDetail>(
      `${DOCUMENTS_URL}/${encodeURIComponent(id)}`,
      changes,
    );
  }

  /** Soft delete: o documento some da listagem. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${DOCUMENTS_URL}/${encodeURIComponent(id)}`);
  }
}
