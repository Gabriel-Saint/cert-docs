import {
  HttpErrorResponse,
  type HttpInterceptorFn,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL, PUBLIC_API_PREFIXES } from '../api/api-config';
import { AuthService } from './auth-service';

export const LOGIN_ROUTE = '/entrar';

/**
 * - Envia cookies só para a própria API, nunca para outros domínios.
 * - O JWT HttpOnly não é lido nem copiado para um header Authorization.
 * - 401 numa rota protegida encerra a sessão; rotas de autenticação tratam o 401 localmente.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = request.url.startsWith(`${API_URL}/`);
  const isPublicRoute = PUBLIC_API_PREFIXES.some((prefix) =>
    request.url.startsWith(prefix),
  );
  const authorized = isApiRequest
    ? request.clone({ withCredentials: true })
    : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      const sessionRejected =
        error instanceof HttpErrorResponse &&
        error.status === HttpStatusCode.Unauthorized &&
        isApiRequest &&
        !isPublicRoute &&
        !request.url.includes('/auth/');

      if (sessionRejected) {
        auth.logout();
        const currentUrl = router.url;
        if (!currentUrl.startsWith(LOGIN_ROUTE)) {
          void router.navigate([LOGIN_ROUTE], {
            queryParams: { returnUrl: currentUrl },
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
