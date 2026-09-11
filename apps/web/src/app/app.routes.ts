import type { Route } from '@angular/router';
import { Role } from '@cert-docs/shared';
import {
  authGuard,
  guestGuard,
  HOME_ROUTE,
  roleGuard,
} from './core/auth/auth-guards';

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
    loadComponent: () =>
      import('./features/verification/verify-search-page').then(
        (m) => m.VerifySearchPage,
      ),
  },
  {
    path: 'verificar/:code',
    title: 'Verificação de certificado · CertDocs',
    loadComponent: () =>
      import('./features/verification/verify-result-page').then(
        (m) => m.VerifyResultPage,
      ),
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
        path: 'admin',
        canActivate: [roleGuard(Role.ADMIN)],
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.adminRoutes),
      },
    ],
  },

  { path: '**', redirectTo: HOME_ROUTE.slice(1) },
];
