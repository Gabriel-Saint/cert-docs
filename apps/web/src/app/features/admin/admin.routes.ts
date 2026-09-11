import type { Route } from '@angular/router';

export const adminRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
  {
    path: 'pedidos',
    title: 'Pedidos de certificado · CertDocs',
    loadComponent: () =>
      import('./requests/admin-requests-page').then((m) => m.AdminRequestsPage),
  },
  {
    path: 'certificados',
    title: 'Certificados emitidos · CertDocs',
    loadComponent: () =>
      import('./certificates/admin-certificates-page').then(
        (m) => m.AdminCertificatesPage,
      ),
  },
  {
    path: 'cursos',
    title: 'Cursos · CertDocs',
    loadComponent: () =>
      import('./courses/admin-courses-page').then((m) => m.AdminCoursesPage),
  },
  {
    path: 'documentos',
    title: 'Documentos · CertDocs',
    loadComponent: () =>
      import('./documents/admin-documents-page').then(
        (m) => m.AdminDocumentsPage,
      ),
  },
  {
    path: 'usuarios',
    title: 'Usuários · CertDocs',
    loadComponent: () =>
      import('./users/admin-users-page').then((m) => m.AdminUsersPage),
  },
];
