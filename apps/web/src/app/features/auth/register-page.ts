import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { readApiError } from '../../core/api/api-error';
import { HOME_ROUTE } from '../../core/auth/auth-guards';
import { AuthService } from '../../core/auth/auth-service';
import { cpfValidator, maskCpfInput } from '../../core/forms/cpf-field';

/** Mesmos limites da API (RegisterDto). */
const LIMITS = {
  nameMin: 2,
  nameMax: 100,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 128,
} as const;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  return confirmation && password !== confirmation
    ? { passwordsMismatch: true }
    : null;
}

@Component({
  selector: 'app-register-page',
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
        <h1>Criar conta</h1>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (errorMessage()) {
            <p class="error" role="alert">{{ errorMessage() }}</p>
          }

          <mat-form-field>
            <mat-label>Nome completo</mat-label>
            <input
              matInput
              id="register-name"
              formControlName="name"
              autocomplete="name"
              [maxlength]="limits.nameMax"
            />
            <mat-hint>Aparece nos PDFs e certificados.</mat-hint>
            @if (form.controls.name.invalid) {
              <mat-error
                >Informe o nome (de {{ limits.nameMin }} a
                {{ limits.nameMax }} caracteres).</mat-error
              >
            }
          </mat-form-field>

          <mat-form-field>
            <mat-label>Email</mat-label>
            <input
              matInput
              id="register-email"
              type="email"
              formControlName="email"
              autocomplete="email"
            />
            @if (form.controls.email.hasError('required')) {
              <mat-error>Informe o email.</mat-error>
            } @else if (form.controls.email.invalid) {
              <mat-error>Email em formato inválido.</mat-error>
            }
          </mat-form-field>

          <mat-form-field>
            <mat-label>CPF</mat-label>
            <input
              matInput
              id="register-cpf"
              formControlName="cpf"
              inputmode="numeric"
              placeholder="000.000.000-00"
              autocomplete="off"
              (input)="onCpfInput($event)"
            />
            @if (form.controls.cpf.hasError('required')) {
              <mat-error>Informe o CPF.</mat-error>
            } @else if (form.controls.cpf.hasError('cpf')) {
              <mat-error>CPF inválido. Confira os números.</mat-error>
            }
          </mat-form-field>

          <mat-form-field>
            <mat-label>Senha</mat-label>
            <input
              matInput
              id="register-password"
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
            <mat-hint>Mínimo de {{ limits.passwordMin }} caracteres.</mat-hint>
            @if (form.controls.password.invalid) {
              <mat-error
                >A senha precisa ter de {{ limits.passwordMin }} a
                {{ limits.passwordMax }} caracteres.</mat-error
              >
            }
          </mat-form-field>

          <mat-form-field>
            <mat-label>Confirme a senha</mat-label>
            <input
              matInput
              id="register-confirm-password"
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
            />
            @if (
              form.hasError('passwordsMismatch') &&
              form.controls.confirmPassword.touched
            ) {
              <mat-hint class="error">As senhas não conferem.</mat-hint>
            }
          </mat-form-field>

          <button
            mat-flat-button
            class="submit"
            type="submit"
            [disabled]="submitting()"
          >
            Criar conta
          </button>
        </form>

        <p class="footer">Já tem conta? <a routerLink="/entrar">Entrar</a></p>
      </mat-card-content>
    </mat-card>
  `,
  styleUrl: './auth-card.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly limits = LIMITS;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(LIMITS.nameMin),
          Validators.maxLength(LIMITS.nameMax),
        ],
      ],
      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.maxLength(LIMITS.emailMax),
        ],
      ],
      cpf: ['', [Validators.required, cpfValidator]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(LIMITS.passwordMin),
          Validators.maxLength(LIMITS.passwordMax),
        ],
      ],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  protected onCpfInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const masked = maskCpfInput(input.value);
    if (masked !== input.value) this.form.controls.cpf.setValue(masked);
  }

  protected submit(): void {
    this.form.controls.name.setValue(this.form.controls.name.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { name, email, cpf, password } = this.form.getRawValue();
    this.auth
      .register({ name, email, cpf, password })
      // Conta criada: já entra direto, sem pedir a senha de novo
      .pipe(switchMap(() => this.auth.login({ email, password })))
      .subscribe({
        next: () => void this.router.navigateByUrl(HOME_ROUTE),
        error: async (error: unknown) => {
          this.errorMessage.set((await readApiError(error)).message);
          this.submitting.set(false);
        },
      });
  }
}
