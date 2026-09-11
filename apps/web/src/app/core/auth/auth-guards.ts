import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import type { Role } from '@cert-docs/shared';
import { LOGIN_ROUTE } from './auth-interceptor';
import { AuthService } from './auth-service';

/** Para onde vai quem já está logado e abre o login, ou quem não tem permissão. */
export const HOME_ROUTE = '/documentos';

/** Exige sessão válida; sem ela, vai para o login e volta para a página pedida depois. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasValidSession()) return true;

  auth.logout();
  return router.createUrlTree([LOGIN_ROUTE], {
    queryParams: { returnUrl: state.url },
  });
};

/** Login e cadastro: quem já está logado não precisa ver essas telas. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.hasValidSession() ? inject(Router).parseUrl(HOME_ROUTE) : true;
};

/** Exige uma das roles. Use sempre depois do authGuard. */
export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const role = inject(AuthService).session()?.role;
    return role && roles.includes(role)
      ? true
      : inject(Router).parseUrl(HOME_ROUTE);
  };

/** Só aceita returnUrl interno, para o login não virar redirecionamento para sites externos. */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//'))
    return HOME_ROUTE;
  return value.startsWith(LOGIN_ROUTE) ? HOME_ROUTE : value;
}
