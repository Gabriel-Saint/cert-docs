import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type {
  CertificateRequestStatus,
  CertificateRequestView,
} from '@cert-docs/shared';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, switchMap } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { CertificateRequestsApi } from '../../../data-access/certificate-requests-api';
import { REQUEST_STATUS_LABEL } from '../../../shared/ui/labels';
import { Notify, unwrapResourceError } from '../../../shared/ui/notify';
import {
  ReasonDialog,
  type ReasonDialogData,
} from '../../../shared/ui/reason-dialog';
import { StateMessage } from '../../../shared/ui/state-message';
import { ApproveDialog } from './approve-dialog';

type StatusFilter = CertificateRequestStatus | 'ALL';

@Component({
  selector: 'app-admin-requests-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    StateMessage,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Pedidos de certificado</h1>
        <mat-button-toggle-group
          [value]="status()"
          (change)="status.set($event.value)"
          aria-label="Filtrar pedidos por status"
        >
          <mat-button-toggle value="PENDING">Em análise</mat-button-toggle>
          <mat-button-toggle value="APPROVED">Aprovados</mat-button-toggle>
          <mat-button-toggle value="REJECTED">Recusados</mat-button-toggle>
          <mat-button-toggle value="ALL">Todos</mat-button-toggle>
        </mat-button-toggle-group>
      </header>

      @if (requests.isLoading() || busyId()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (requests.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível carregar os pedidos"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="requests.reload()"
        />
      } @else if (requests.hasValue() && requests.value().length === 0) {
        <app-state-message icon="inbox" title="Nenhum pedido neste filtro" />
      } @else if (requests.hasValue()) {
        <div class="table-scroll">
          <table mat-table [dataSource]="requests.value()">
            <ng-container matColumnDef="student">
              <th mat-header-cell *matHeaderCellDef>Aluno</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.student.name }}</strong
                ><br />
                <span class="muted"
                  >{{ row.student.email }} · {{ row.student.cpf }}</span
                >
              </td>
            </ng-container>
            <ng-container matColumnDef="course">
              <th mat-header-cell *matHeaderCellDef>Curso</th>
              <td mat-cell *matCellDef="let row">{{ row.course.title }}</td>
            </ng-container>
            <ng-container matColumnDef="requestedAt">
              <th mat-header-cell *matHeaderCellDef>Pedido em</th>
              <td mat-cell *matCellDef="let row">
                {{ row.requestedAt | date: 'short' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <mat-chip-set
                  ><mat-chip>{{
                    statusLabel[row.status]
                  }}</mat-chip></mat-chip-set
                >
                @if (row.rejectionReason) {
                  <small class="muted">{{ row.rejectionReason }}</small>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cdk-visually-hidden">Ações</span>
              </th>
              <td mat-cell *matCellDef="let row" class="actions">
                @if (row.status === 'PENDING') {
                  <button
                    mat-flat-button
                    type="button"
                    [disabled]="busyId() === row.id"
                    (click)="approve(row)"
                  >
                    Aprovar
                  </button>
                  <button
                    mat-button
                    type="button"
                    [disabled]="busyId() === row.id"
                    (click)="reject(row)"
                  >
                    Recusar
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .actions {
      white-space: nowrap;
      text-align: right;
    }
    small {
      display: block;
      max-width: 280px;
    }
  `,
})
export class AdminRequestsPage {
  private readonly api = inject(CertificateRequestsApi);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(Notify);

  protected readonly columns = [
    'student',
    'course',
    'requestedAt',
    'status',
    'actions',
  ];
  // Linhas do mat-table chegam como any no template
  protected readonly statusLabel: Record<string, string> = REQUEST_STATUS_LABEL;
  protected readonly status = signal<StatusFilter>('PENDING');
  protected readonly busyId = signal<string | null>(null);

  protected readonly requests = rxResource({
    params: () => this.status(),
    stream: ({ params }) =>
      this.api.list(params === 'ALL' ? undefined : params),
  });

  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.requests.error())).message,
  );

  protected approve(request: CertificateRequestView): void {
    this.dialog
      .open(ApproveDialog, { data: request, width: '520px' })
      .afterClosed()
      .pipe(
        filter((body) => !!body),
        switchMap((body) => {
          this.busyId.set(request.id);
          return this.api.approve(request.id, body);
        }),
      )
      .subscribe({
        next: (certificate) => {
          this.notify.success(
            `Certificado ${certificate.code} emitido para ${request.student.name}.`,
          );
          this.busyId.set(null);
          this.requests.reload();
        },
        error: (error: unknown) => {
          void this.notify.error(error);
          this.busyId.set(null);
          this.requests.reload();
        },
      });
  }

  protected reject(request: CertificateRequestView): void {
    const data: ReasonDialogData = {
      title: 'Recusar pedido',
      description: `O aluno ${request.student.name} verá este motivo em "Meus certificados".`,
      confirmLabel: 'Recusar pedido',
    };
    this.dialog
      .open(ReasonDialog, { data, width: '520px' })
      .afterClosed()
      .pipe(
        filter((reason): reason is string => typeof reason === 'string'),
        switchMap((reason) => {
          this.busyId.set(request.id);
          return this.api.reject(request.id, reason);
        }),
      )
      .subscribe({
        next: () => {
          this.notify.success('Pedido recusado.');
          this.busyId.set(null);
          this.requests.reload();
        },
        error: (error: unknown) => {
          void this.notify.error(error);
          this.busyId.set(null);
        },
      });
  }
}
