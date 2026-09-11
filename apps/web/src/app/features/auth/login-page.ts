import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
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
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { readApiError } from '../../core/api/api-error';
import { safeReturnUrl } from '../../core/auth/auth-guards';
import { AuthService } from '../../core/auth/auth-service';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  template: `
    <mat-card class="card" appearance="outlined">
      @if (submitting()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <mat-card-content>
        <p class="brand">CertDocs</p>
        <h1>Entrar</h1>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (errorMessage()) {
            <p class="error" role="alert">{{ errorMessage() }}</p>
          }

          <mat-form-field>
            <mat-label>Email</mat-label>
            <input
              matInput
              id="login-email"
              type="email"
              formControlName="email"
              autocomplete="email"
            />
            @if (form.controls.email.hasError('required')) {
              <mat-error>Informe o email.</mat-error>
            } @else if (form.controls.email.hasError('email')) {
              <mat-error>Email em formato inválido.</mat-error>
            }
          </mat-form-field>

          <mat-form-field>
            <mat-label>Senha</mat-label>
            <input
              matInput
              id="login-password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
            @if (form.controls.password.hasError('required')) {
              <mat-error>Informe a senha.</mat-error>
            }
          </mat-form-field>

          <button
            mat-flat-button
            class="submit"
            type="submit"
            [disabled]="submitting()"
          >
            Entrar
          </button>
        </form>

        <p class="footer">
          Não tem conta? <a routerLink="/cadastro">Criar conta</a>
        </p>
        <p class="footer muted">
          Recebeu um certificado?
          <a routerLink="/verificar">Verificar autenticidade</a>
        </p>
      </mat-card-content>
    </mat-card>
  `,
  styleUrl: './auth-card.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Página que a pessoa tentou abrir antes de ser mandada para o login. */
  readonly returnUrl = input<string>();

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () =>
        void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: async (error: unknown) => {
        // O email continua preenchido; só a senha é limpa
        this.form.controls.password.reset();
        this.errorMessage.set((await readApiError(error)).message);
        this.submitting.set(false);
      },
    });
  }
}
