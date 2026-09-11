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
 * - Envia o token só para a própria API, nunca para outros domínios.
 * - Rotas de login, cadastro e verificação pública não recebem token.
 * - 401 numa rota protegida = sessão expirada ou inválida: sai e volta para o login.
 *   401 no login = senha errada: o erro segue para o formulário tratar.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = request.url.startsWith(`${API_URL}/`);
  const isPublicRoute = PUBLIC_API_PREFIXES.some((prefix) =>
    request.url.startsWith(prefix),
  );
  const token = auth.token();

  const authorized =
    isApiRequest && !isPublicRoute && token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      const sessionRejected =
        error instanceof HttpErrorResponse &&
        error.status === HttpStatusCode.Unauthorized &&
        isApiRequest &&
        !isPublicRoute;

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
