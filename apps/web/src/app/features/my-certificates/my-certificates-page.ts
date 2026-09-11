import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { CertificateRequestsApi } from '../../data-access/certificate-requests-api';
import { CertificatesApi } from '../../data-access/certificates-api';
import {
  CERTIFICATE_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
} from '../../shared/ui/labels';
import { Notify, unwrapResourceError } from '../../shared/ui/notify';
import { StateMessage } from '../../shared/ui/state-message';

@Component({
  selector: 'app-my-certificates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    StateMessage,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Meus certificados</h1>
        <a mat-stroked-button routerLink="/cursos">Solicitar certificado</a>
      </header>

      @if (data.isLoading() && !data.hasValue()) {
        <mat-spinner
          class="spinner"
          diameter="40"
          aria-label="Carregando certificados"
        />
      } @else if (data.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível carregar seus certificados"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="data.reload()"
        />
      } @else if (data.hasValue()) {
        <h2>Certificados emitidos</h2>
        @if (data.value().certificates.length === 0) {
          <app-state-message
            icon="workspace_premium"
            title="Você ainda não tem certificados"
            description="Quando um pedido for aprovado, o certificado aparece aqui."
          />
        } @else {
          <div class="grid">
            @for (
              certificate of data.value().certificates;
              track certificate.id
            ) {
              <mat-card appearance="outlined">
                <mat-card-header>
                  <mat-card-title>{{
                    certificate.course.title
                  }}</mat-card-title>
                  <mat-card-subtitle
                    >Emitido em
                    {{
                      certificate.issuedAt | date: 'longDate'
                    }}</mat-card-subtitle
                  >
                </mat-card-header>
                <mat-card-content>
                  <mat-chip-set>
                    <mat-chip
                      [class.revoked]="certificate.status === 'REVOKED'"
                    >
                      {{ certificateLabel[certificate.status] }}
                    </mat-chip>
                  </mat-chip-set>
                  <p class="code">{{ certificate.code }}</p>
                </mat-card-content>
                <mat-card-actions>
                  <button
                    mat-flat-button
                    type="button"
                    [disabled]="downloading() === certificate.id"
                    (click)="download(certificate.id)"
                  >
                    <mat-icon>download</mat-icon>
                    Baixar PDF
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Copiar link de verificação"
                    aria-label="Copiar link de verificação"
                    (click)="copyLink(certificate.verificationUrl)"
                  >
                    <mat-icon>link</mat-icon>
                  </button>
                  <a
                    mat-icon-button
                    [routerLink]="['/verificar', certificate.code]"
                    matTooltip="Abrir verificação pública"
                    aria-label="Abrir verificação pública"
                  >
                    <mat-icon>verified</mat-icon>
                  </a>
                </mat-card-actions>
              </mat-card>
            }
          </div>
        }

        <h2>Pedidos</h2>
        @if (data.value().requests.length === 0) {
          <p class="muted">Nenhum pedido feito ainda.</p>
        } @else {
          <mat-card appearance="outlined">
            <ul class="requests">
              @for (request of data.value().requests; track request.id) {
                <li>
                  <div>
                    <strong>{{ request.course.title }}</strong>
                    <span class="muted">
                      · pedido em
                      {{ request.requestedAt | date: 'short' }}</span
                    >
                    @if (request.rejectionReason) {
                      <p class="reason">
                        Motivo da recusa: {{ request.rejectionReason }}
                      </p>
                    }
                  </div>
                  <mat-chip-set>
                    <mat-chip>{{ requestLabel[request.status] }}</mat-chip>
                  </mat-chip-set>
                </li>
              }
            </ul>
          </mat-card>
        }
      }
    </section>
  `,
  styles: `
    h2 {
      margin: 8px 0 0;
      font: var(--mat-sys-title-large);
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
    .code {
      font-family: 'Roboto Mono', monospace;
      letter-spacing: 0.04em;
      margin: 12px 0 0;
    }
    .revoked {
      --mat-chip-label-text-color: var(--mat-sys-error);
    }
    .requests {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .requests li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .requests li:last-child {
      border-bottom: 0;
    }
    .reason {
      margin: 4px 0 0;
      color: var(--mat-sys-error);
    }
    /* O conteúdo ocupa a sobra para o botão ficar no rodapé em todos os cards da linha */
    mat-card-content {
      flex: 1;
    }
    mat-card-actions button {
      min-height: 44px;
    }
    .spinner {
      margin: 40px auto;
    }
  `,
})
export class MyCertificatesPage {
  private readonly certificatesApi = inject(CertificatesApi);
  private readonly requestsApi = inject(CertificateRequestsApi);
  private readonly notify = inject(Notify);
  private readonly clipboard = inject(Clipboard);

  protected readonly certificateLabel = CERTIFICATE_STATUS_LABEL;
  protected readonly requestLabel = REQUEST_STATUS_LABEL;
  protected readonly downloading = signal<string | null>(null);

  protected readonly data = rxResource({
    stream: () =>
      forkJoin({
        certificates: this.certificatesApi.mine(),
        requests: this.requestsApi.mine(),
      }),
  });

  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.data.error())).message,
  );

  protected download(id: string): void {
    this.downloading.set(id);
    this.certificatesApi.downloadPdf(id).subscribe({
      next: () => this.downloading.set(null),
      error: (error: unknown) => {
        void this.notify.error(error);
        this.downloading.set(null);
      },
    });
  }

  protected copyLink(url: string): void {
    if (this.clipboard.copy(url)) {
      this.notify.success('Link de verificação copiado.');
    }
  }
}
