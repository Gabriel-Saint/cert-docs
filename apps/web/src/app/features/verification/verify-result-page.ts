import { DatePipe } from '@angular/common';
import { HttpStatusCode } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { FileCheckResult } from '@cert-docs/shared';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import {
  MAX_UPLOAD_BYTES,
  normalizeVerificationCode,
  VerificationApi,
} from '../../data-access/verification-api';
import { PublicHeader } from '../../layout/public-header';
import { Notify, unwrapResourceError } from '../../shared/ui/notify';
import { StateMessage } from '../../shared/ui/state-message';

@Component({
  selector: 'app-verify-result-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    PublicHeader,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    StateMessage,
  ],
  template: `
    <app-public-header />
    <section class="page narrow">
      @if (!normalizedCode()) {
        <app-state-message
          tone="error"
          icon="qr_code_2"
          title="Código de verificação inválido"
          description="Confira se o código foi digitado ou copiado por completo."
        />
        <a mat-stroked-button routerLink="/verificar">Digitar outro código</a>
      } @else if (verification.isLoading()) {
        <mat-spinner
          class="spinner"
          diameter="40"
          aria-label="Verificando certificado"
        />
      } @else if (notFound()) {
        <app-state-message
          tone="error"
          icon="search_off"
          title="Nenhum certificado com este código"
          [description]="'Código consultado: ' + normalizedCode()"
        />
        <a mat-stroked-button routerLink="/verificar">Digitar outro código</a>
      } @else if (verification.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível verificar agora"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="verification.reload()"
        />
      } @else if (verification.hasValue() && verification.value(); as result) {
        <mat-card
          appearance="outlined"
          [class.revoked]="result.status === 'REVOKED'"
        >
          <mat-card-content>
            @if (result.status === 'VALID') {
              <p class="verdict valid" role="status">
                <mat-icon>verified</mat-icon> Certificado válido
              </p>
            } @else {
              <p class="verdict invalid" role="alert">
                <mat-icon>gpp_bad</mat-icon> Certificado revogado
              </p>
              @if (result.revocation) {
                <p>
                  Revogado em
                  {{ result.revocation.revokedAt | date: 'longDate' }}. Motivo:
                  {{ result.revocation.reason }}
                </p>
              }
            }

            <dl>
              <dt>Aluno</dt>
              <dd>{{ result.holderName }}</dd>
              <dt>CPF</dt>
              <dd>{{ result.holderCpf }}</dd>
              <dt>Curso</dt>
              <dd>
                {{ result.courseTitle }} ({{ result.workloadHours }} horas)
              </dd>
              <dt>Período</dt>
              <dd>
                @if (result.period.startDate) {
                  {{ result.period.startDate | date: 'dd/MM/yyyy' : 'UTC' }} a
                }
                {{ result.period.completionDate | date: 'dd/MM/yyyy' : 'UTC' }}
              </dd>
              <dt>Emitido em</dt>
              <dd>{{ result.issuedAt | date: 'long' }}</dd>
              <dt>Registro</dt>
              <dd>{{ result.registry }}</dd>
              <dt>Código</dt>
              <dd class="mono">{{ result.code }}</dd>
              <dt>SHA-256 dos dados</dt>
              <dd class="mono hash">{{ result.dataHash }}</dd>
            </dl>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>Conferir o arquivo PDF</mat-card-title>
            <mat-card-subtitle>
              Envie o PDF que você recebeu para confirmar que é exatamente o
              arquivo emitido. Ele não é guardado.
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <input
              #fileInput
              id="certificate-file"
              type="file"
              accept="application/pdf"
              hidden
              (change)="onFileSelected(fileInput)"
            />
            <button
              mat-stroked-button
              type="button"
              class="upload"
              [disabled]="checking()"
              (click)="fileInput.click()"
            >
              <mat-icon>upload_file</mat-icon>
              {{ checking() ? 'Conferindo…' : 'Escolher PDF' }}
            </button>

            @if (fileCheck(); as check) {
              @if (check.matches) {
                <p class="verdict valid" role="status">
                  <mat-icon>task_alt</mat-icon> O arquivo é o original emitido.
                </p>
              } @else {
                <p class="verdict invalid" role="alert">
                  <mat-icon>warning</mat-icon>
                  O arquivo foi alterado ou não é o emitido. Confie apenas nos
                  dados desta página.
                </p>
              }
            }
          </mat-card-content>
        </mat-card>
      }
    </section>
  `,
  styles: `
    .narrow {
      max-width: 760px;
    }
    .verdict {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      font: var(--mat-sys-title-large);
    }
    .valid {
      color: #1b6b3a;
    }
    .invalid {
      color: var(--mat-sys-error);
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 16px;
      margin: 0;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0;
    }
    .mono {
      font-family: 'Roboto Mono', monospace;
    }
    .hash {
      word-break: break-all;
      font-size: 0.85em;
    }
    .upload {
      min-height: 44px;
    }
    .spinner {
      margin: 40px auto;
    }
    @media (max-width: 599px) {
      dl {
        grid-template-columns: 1fr;
      }
      dd {
        margin-bottom: 8px;
      }
    }
  `,
})
export class VerifyResultPage {
  private readonly api = inject(VerificationApi);
  private readonly notify = inject(Notify);

  /** Parâmetro :code da rota (o QR Code aponta para cá). */
  readonly code = input.required<string>();

  protected readonly normalizedCode = computed(() =>
    normalizeVerificationCode(this.code()),
  );
  protected readonly checking = signal(false);
  protected readonly fileCheck = signal<FileCheckResult | null>(null);

  protected readonly verification = rxResource({
    params: () => this.normalizedCode(),
    stream: ({ params: code }) => (code ? this.api.verify(code) : of(null)),
  });

  private readonly apiError = computed(() => {
    const error = this.verification.error();
    return error ? toApiError(unwrapResourceError(error)) : null;
  });

  protected readonly notFound = computed(
    () => this.apiError()?.status === HttpStatusCode.NotFound,
  );
  protected readonly errorMessage = computed(
    () => this.apiError()?.message ?? '',
  );

  protected onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    const code = this.normalizedCode();
    if (!file || !code) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      this.notify.success('O arquivo é maior que o limite de 5 MB.');
      return;
    }

    this.checking.set(true);
    this.fileCheck.set(null);
    this.api.checkFile(code, file, file.name).subscribe({
      next: (result) => {
        this.fileCheck.set(result);
        this.checking.set(false);
      },
      error: (error: unknown) => {
        void this.notify.error(error);
        this.checking.set(false);
      },
    });
  }
}
