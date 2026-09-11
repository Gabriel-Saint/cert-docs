import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { UserListItem } from '@cert-docs/shared';
import type { Observable } from 'rxjs';
import { API_URL } from '../core/api/api-config';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  /** Somente ADMIN. O CPF já vem mascarado da API. */
  list(): Observable<UserListItem[]> {
    return this.http.get<UserListItem[]>(`${API_URL}/users`);
  }
}
