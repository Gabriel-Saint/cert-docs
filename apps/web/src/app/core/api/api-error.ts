import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';

/** Erro pronto para exibir: mensagem em português e, quando houver, detalhes por campo. */
export interface ApiError {
  status: number;
  /** Código de negócio da API (ex.: EMAIL_OR_CPF_IN_USE), quando existir. */
  code: string | null;
  message: string;
  details: string[];
}

const FALLBACK_MESSAGES: Partial<Record<number, string>> = {
  0: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  [HttpStatusCode.BadRequest]: 'Confira os dados informados.',
  [HttpStatusCode.Unauthorized]: 'Sua sessão expirou. Entre novamente.',
  [HttpStatusCode.Forbidden]: 'Você não tem permissão para esta ação.',
  [HttpStatusCode.NotFound]: 'Não encontramos o que você procurou.',
  [HttpStatusCode.PayloadTooLarge]: 'O arquivo é maior que o limite de 5 MB.',
  [HttpStatusCode.TooManyRequests]:
    'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.',
};

const UNEXPECTED =
  'Algo deu errado do nosso lado. Tente novamente em instantes.';

/**
 * Converte qualquer erro de requisição num ApiError.
 * - Erros de negócio da API já vêm com mensagem em português e são usados como estão.
 * - Erros de validação (lista de campos) viram uma mensagem geral + detalhes.
 */
export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, code: null, message: UNEXPECTED, details: [] };
  }

  const body = asRecord(error.error);
  const code = typeof body?.['code'] === 'string' ? body['code'] : null;
  const rawMessage = body?.['message'];
  const details = Array.isArray(rawMessage)
    ? rawMessage.filter((item): item is string => typeof item === 'string')
    : [];

  const fallback = FALLBACK_MESSAGES[error.status] ?? UNEXPECTED;

  // Mensagens de erro de negócio (com code) são escritas para o usuário final
  const message =
    code && typeof rawMessage === 'string' && rawMessage.trim()
      ? rawMessage
      : fallback;

  return { status: error.status, code, message, details };
}

/**
 * Igual ao toApiError, mas também entende erros de downloads (responseType: 'blob'),
 * em que o corpo do erro chega como Blob e precisa ser lido antes.
 */
export async function readApiError(error: unknown): Promise<ApiError> {
  if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
    try {
      const parsed: unknown = JSON.parse(await readBlobText(error.error));
      return toApiError(
        new HttpErrorResponse({
          error: parsed,
          status: error.status,
          statusText: error.statusText,
          url: error.url ?? undefined,
        }),
      );
    } catch {
      return toApiError(
        new HttpErrorResponse({
          status: error.status,
          statusText: error.statusText,
        }),
      );
    }
  }
  return toApiError(error);
}

/** Blob.text() com fallback para FileReader (ambientes sem a API moderna). */
function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !(value instanceof Blob)
    ? (value as Record<string, unknown>)
    : null;
}
