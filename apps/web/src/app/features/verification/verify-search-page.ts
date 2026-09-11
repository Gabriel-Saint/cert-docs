import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { normalizeVerificationCode } from '../../data-access/verification-api';
import { PublicHeader } from '../../layout/public-header';

@Component({
  selector: 'app-verify-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PublicHeader,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <app-public-header />
    <section class="page narrow">
      <header>
        <h1>Verificar certificado</h1>
        <p class="muted">
          Digite o código impresso no certificado (ex.: CERT-7K3F-9QX2-M8PD) ou
          cole o link do QR Code.
        </p>
      </header>

      <mat-card appearance="outlined">
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="search()" novalidate>
            <mat-form-field class="full-width">
              <mat-label>Código de verificação</mat-label>
              <input
                matInput
                id="verification-code"
                formControlName="code"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
              />
              @if (invalidCode()) {
                <mat-hint class="error"
                  >Código incompleto ou com caracteres inválidos. Confira e
                  tente de novo.</mat-hint
                >
              }
            </mat-form-field>
            <button mat-flat-button type="submit" class="submit">
              <mat-icon>search</mat-icon>
              Verificar
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: `
    .narrow {
      max-width: 640px;
    }
    h1 {
      margin: 0 0 4px;
      font: var(--mat-sys-headline-small);
    }
    form {
      display: grid;
      gap: 8px;
    }
    .submit {
      min-height: 44px;
      justify-self: start;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class VerifySearchPage {
  private readonly router = inject(Router);
  protected readonly invalidCode = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    code: ['', Validators.required],
  });

  protected search(): void {
    const code = normalizeVerificationCode(this.form.controls.code.value);
    this.invalidCode.set(code === null);
    if (code) void this.router.navigate(['/verificar', code]);
  }
}
