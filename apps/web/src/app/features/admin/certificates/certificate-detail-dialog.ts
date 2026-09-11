import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toApiError } from '../../../core/api/api-error';
import { CertificatesApi } from '../../../data-access/certificates-api';
import { CERTIFICATE_STATUS_LABEL } from '../../../shared/ui/labels';
import { unwrapResourceError } from '../../../shared/ui/notify';

/** Detalhe completo de um certificado emitido (dados congelados, hashes e revogação). */
@Component({
  selector: 'app-certificate-detail-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Detalhes do certificado</h2>
    <mat-dialog-content>
      @if (detail.isLoading()) {
        <mat-spinner diameter="32" aria-label="Carregando detalhes" />
      } @else if (detail.error()) {
        <p class="error" role="alert">{{ errorMessage() }}</p>
      } @else if (detail.hasValue()) {
        @let c = detail.value();
        <dl>
          <dt>Código</dt>
          <dd class="mono">{{ c.code }}</dd>
          <dt>Status</dt>
          <dd>{{ statusLabel[c.status] }}</dd>
          <dt>Registro</dt>
          <dd>
            {{ c.registry }} · Livro {{ c.registryBook }} · Folha
            {{ c.registrySheet }}
          </dd>
          <dt>Aluno</dt>
          <dd>{{ c.snapshot.holder.name }} ({{ c.snapshot.holder.cpf }})</dd>
          <dt>Curso</dt>
          <dd>
            {{ c.snapshot.course.title }} —
            {{ c.snapshot.course.workloadHours }} h
          </dd>
          <dt>Coordenação</dt>
          <dd>{{ c.snapshot.course.coordinator }}</dd>
          <dt>Período</dt>
          <dd>
            @if (c.snapshot.period.startDate) {
              {{ c.snapshot.period.startDate | date: 'dd/MM/yyyy' : 'UTC' }} a
            }
            {{ c.snapshot.period.completionDate | date: 'dd/MM/yyyy' : 'UTC' }}
          </dd>
          <dt>Emitido</dt>
          <dd>{{ c.issuedAt | date: 'long' }} por {{ c.issuedBy.name }}</dd>
          <dt>Verificação</dt>
          <dd>
            <a [href]="c.verificationUrl" target="_blank" rel="noopener">{{
              c.verificationUrl
            }}</a>
          </dd>
          <dt>Hash dos dados</dt>
          <dd class="mono hash">{{ c.dataHash }}</dd>
          <dt>Hash do arquivo</dt>
          <dd class="mono hash">{{ c.fileHash }}</dd>
          @if (c.revocation) {
            <dt>Revogado</dt>
            <dd class="error">
              {{ c.revocation.revokedAt | date: 'long' }} por
              {{ c.revocation.revokedBy.name }} —
              {{ c.revocation.reason }}
            </dd>
          }
        </dl>
        <h3>Conteúdo programático</h3>
        <ol>
          @for (module of c.snapshot.course.modules; track $index) {
            <li>{{ module.title }} — {{ module.hours }} h</li>
          }
        </ol>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Fechar</button>
    </mat-dialog-actions>
  `,
  styles: `
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 6px 16px;
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
    .error {
      color: var(--mat-sys-error);
    }
    h3 {
      margin: 16px 0 4px;
      font: var(--mat-sys-title-small);
    }
  `,
})
export class CertificateDetailDialog {
  private readonly api = inject(CertificatesApi);
  private readonly certificateId = inject<string>(MAT_DIALOG_DATA);
  protected readonly statusLabel = CERTIFICATE_STATUS_LABEL;

  protected readonly detail = rxResource({
    stream: () => this.api.detail(this.certificateId),
  });

  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.detail.error())).message,
  );
}
