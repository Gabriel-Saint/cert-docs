import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: parâmetros de rota chegam direto como input() nos componentes
    provideRouter(appRoutes, withComponentInputBinding()),
    // Token JWT nas chamadas à API e saída automática quando a sessão expira
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
