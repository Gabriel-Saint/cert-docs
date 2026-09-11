import { Injectable } from '@angular/core';

const TOKEN_KEY = 'cert-docs.access-token';

/**
 * Guarda o token no localStorage. Qualquer falha de acesso (modo privado, storage bloqueado)
 * vira "sem token", para o app nunca quebrar por causa do armazenamento.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  read(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  write(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Sem storage o login vale só enquanto a página estiver aberta
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nada a limpar
    }
  }
}
