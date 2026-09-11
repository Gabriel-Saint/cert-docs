import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { map } from 'rxjs';
import { LOGIN_ROUTE } from '../core/auth/auth-interceptor';
import { AuthService } from '../core/auth/auth-service';
import { ROLE_LABEL } from '../shared/ui/labels';

interface NavItem {
  label: string;
  icon: string;
  link: string;
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Documentos', icon: 'description', link: '/documentos' },
  { label: 'Cursos', icon: 'school', link: '/cursos' },
  {
    label: 'Meus certificados',
    icon: 'workspace_premium',
    link: '/meus-certificados',
  },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Pedidos', icon: 'inbox', link: '/admin/pedidos' },
  {
    label: 'Certificados emitidos',
    icon: 'history_edu',
    link: '/admin/certificados',
  },
  { label: 'Cursos', icon: 'menu_book', link: '/admin/cursos' },
  { label: 'Documentos', icon: 'folder', link: '/admin/documentos' },
  { label: 'Usuários', icon: 'group', link: '/admin/usuarios' },
];

/** Estrutura das páginas logadas: barra superior e menu lateral (fixo no desktop, gaveta no celular). */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  template: `
    <mat-toolbar class="toolbar">
      @if (isHandset()) {
        <button
          mat-icon-button
          type="button"
          aria-label="Abrir menu"
          (click)="sidenav.toggle()"
        >
          <mat-icon>menu</mat-icon>
        </button>
      }
      <a class="brand" routerLink="/documentos">CertDocs</a>
      <span class="spacer"></span>
      <button
        mat-button
        type="button"
        [matMenuTriggerFor]="userMenu"
        aria-label="Menu da conta"
      >
        <mat-icon>account_circle</mat-icon>
        @if (!isHandset()) {
          <span>{{ auth.session()?.email }}</span>
        }
      </button>
      <mat-menu #userMenu="matMenu">
        <div class="account" mat-menu-item disabled>
          <span>{{ auth.session()?.email }}</span>
          <small>{{ roleLabel() }}</small>
        </div>
        <button mat-menu-item type="button" (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>Sair</span>
        </button>
      </mat-menu>
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav
        #sidenav
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="!isHandset()"
        class="sidenav"
      >
        <mat-nav-list>
          @for (item of studentNav; track item.link) {
            <a
              mat-list-item
              [routerLink]="item.link"
              routerLinkActive="active"
              #rla="routerLinkActive"
              [activated]="rla.isActive"
              (click)="closeOnHandset()"
            >
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
          @if (auth.isAdmin()) {
            <h3 matSubheader>Administração</h3>
            @for (item of adminNav; track item.link) {
              <a
                mat-list-item
                [routerLink]="item.link"
                routerLinkActive="active"
                #rla="routerLinkActive"
                [activated]="rla.isActive"
                (click)="closeOnHandset()"
              >
                <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                <span matListItemTitle>{{ item.label }}</span>
              </a>
            }
          }
          <h3 matSubheader>Público</h3>
          <a mat-list-item routerLink="/verificar" (click)="closeOnHandset()">
            <mat-icon matListItemIcon>verified</mat-icon>
            <span matListItemTitle>Verificar certificado</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <main>
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      gap: 8px;
    }
    .brand {
      color: inherit;
      text-decoration: none;
      font: var(--mat-sys-title-large);
    }
    .spacer {
      flex: 1;
    }
    .container {
      flex: 1;
    }
    .sidenav {
      width: 260px;
    }
    .account {
      display: grid;
      line-height: 1.3;
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly sidenav = viewChild.required<MatSidenav>('sidenav');
  protected readonly studentNav = STUDENT_NAV;
  protected readonly adminNav = ADMIN_NAV;

  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly roleLabel = () => {
    const role = this.auth.session()?.role;
    return role ? ROLE_LABEL[role] : '';
  };

  constructor() {
    // Quando a sessão acaba (expirou ou saiu em outra aba), volta para o login
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        void this.router.navigate([LOGIN_ROUTE], {
          queryParams: { returnUrl: this.router.url },
        });
      }
    });
  }

  protected closeOnHandset(): void {
    if (this.isHandset()) void this.sidenav().close();
  }

  protected logout(): void {
    this.auth.logout();
  }
}
