import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: parâmetros de rota chegam direto como input() nos componentes
    provideRouter(appRoutes, withComponentInputBinding()),
    // Interceptors (token JWT, tratamento de 401) entram na etapa de lógica
    provideHttpClient(withFetch()),
  ],
};
