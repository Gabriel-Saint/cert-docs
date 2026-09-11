import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { type ApiError, readApiError } from '../../core/api/api-error';

/** Avisos rápidos no rodapé da tela, com mensagens já traduzidas para o usuário. */
@Injectable({ providedIn: 'root' })
export class Notify {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 4000 });
  }

  /** Mostra o erro e devolve o ApiError para a tela decidir se faz algo a mais. */
  async error(error: unknown): Promise<ApiError> {
    const apiError = await readApiError(error);
    this.snackBar.open(apiError.message, 'Fechar', { duration: 7000 });
    return apiError;
  }
}

/**
 * O resource do Angular embrulha erros que não são `Error` (como HttpErrorResponse).
 * Esta função devolve o erro original para ser convertido em mensagem.
 */
export function unwrapResourceError(error: unknown): unknown {
  if (error instanceof HttpErrorResponse) return error;
  const cause = (error as { cause?: unknown } | undefined)?.cause;
  return cause ?? error;
}
