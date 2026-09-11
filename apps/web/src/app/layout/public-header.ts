import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth-service';

/** Cabeçalho das páginas abertas (verificação pública). */
@Component({
  selector: 'app-public-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatToolbarModule, MatButtonModule, RouterLink],
  template: `
    <mat-toolbar>
      <a class="brand" routerLink="/verificar">CertDocs</a>
      <span class="spacer"></span>
      @if (auth.isAuthenticated()) {
        <a mat-button routerLink="/documentos">Ir para o sistema</a>
      } @else {
        <a mat-button routerLink="/entrar">Entrar</a>
      }
    </mat-toolbar>
  `,
  styles: `
    .brand {
      color: inherit;
      text-decoration: none;
      font: var(--mat-sys-title-large);
    }
    .spacer {
      flex: 1;
    }
  `,
})
export class PublicHeader {
  protected readonly auth = inject(AuthService);
}
