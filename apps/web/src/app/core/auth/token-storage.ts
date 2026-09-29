import { Injectable } from '@angular/core';

const TOKEN_KEY = 'cert-docs.access-token';

/** Remove tokens antigos após a migração para sessão web por cookie HttpOnly. */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // O outro armazenamento ainda pode ser limpo
    }
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nada a limpar
    }
  }
}
