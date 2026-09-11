import { inject } from '@angular/core';
import type { Route } from '@angular/router';
import { Role } from '@cert-docs/shared';
import {
  authGuard,
  guestGuard,
  HOME_ROUTE,
  roleGuard,
} from './core/auth/auth-guards';
import { AuthService } from './core/auth/auth-service';

/** Logados não casam com a versão pública e seguem para a mesma página dentro do menu. */
const visitorOnly = () => !inject(AuthService).isAuthenticated();

const loadVerifySearchPage = () =>
  import('./features/verification/verify-search-page').then(
    (m) => m.VerifySearchPage,
  );

const loadVerifyResultPage = () =>
  import('./features/verification/verify-result-page').then(
    (m) => m.VerifyResultPage,
  );

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: HOME_ROUTE.slice(1) },

  // ---------- Visitantes ----------
  {
    path: 'entrar',
    title: 'Entrar · CertDocs',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'cadastro',
    title: 'Criar conta · CertDocs',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register-page').then((m) => m.RegisterPage),
  },

  // ---------- Público (o QR Code dos certificados aponta para cá) ----------
  {
    path: 'verificar',
    title: 'Verificar certificado · CertDocs',
    canMatch: [visitorOnly],
    data: { publicLayout: true },
    loadComponent: loadVerifySearchPage,
  },
  {
    path: 'verificar/:code',
    title: 'Verificação de certificado · CertDocs',
    canMatch: [visitorOnly],
    data: { publicLayout: true },
    loadComponent: loadVerifyResultPage,
  },

  // ---------- Área logada ----------
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'documentos',
        title: 'Documentos · CertDocs',
        loadComponent: () =>
          import('./features/documents/documents-page').then(
            (m) => m.DocumentsPage,
          ),
      },
      {
        path: 'cursos',
        title: 'Cursos · CertDocs',
        loadComponent: () =>
          import('./features/courses/courses-page').then((m) => m.CoursesPage),
      },
      {
        path: 'meus-certificados',
        title: 'Meus certificados · CertDocs',
        loadComponent: () =>
          import('./features/my-certificates/my-certificates-page').then(
            (m) => m.MyCertificatesPage,
          ),
      },
      {
        path: 'verificar',
        title: 'Verificar certificado · CertDocs',
        loadComponent: loadVerifySearchPage,
      },
      {
        path: 'verificar/:code',
        title: 'Verificação de certificado · CertDocs',
        loadComponent: loadVerifyResultPage,
      },
      {
        path: 'admin',
        canActivate: [roleGuard(Role.ADMIN)],
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.adminRoutes),
      },
    ],
  },

  { path: '**', redirectTo: HOME_ROUTE.slice(1) },
];
