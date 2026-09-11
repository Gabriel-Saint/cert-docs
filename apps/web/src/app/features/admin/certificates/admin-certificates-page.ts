import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import type {
  CertificateHistoryItem,
  CertificateHistoryQuery,
  CertificateStatus,
  Page,
} from '@cert-docs/shared';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  MatPaginatorModule,
  type PageEvent,
} from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  merge,
  skip,
  startWith,
  switchMap,
} from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { CertificatesApi } from '../../../data-access/certificates-api';
import { CERTIFICATE_STATUS_LABEL } from '../../../shared/ui/labels';
import { Notify, unwrapResourceError } from '../../../shared/ui/notify';
import {
  ReasonDialog,
  type ReasonDialogData,
} from '../../../shared/ui/reason-dialog';
import { StateMessage } from '../../../shared/ui/state-message';
import { CertificateDetailDialog } from './certificate-detail-dialog';

const DEFAULT_PAGE_SIZE = 20;
/** Espera o usuário parar de digitar antes de consultar a API. */
export const SEARCH_DEBOUNCE_MS = 300;

type HistoryFilters = Pick<
  CertificateHistoryQuery,
  'q' | 'status' | 'from' | 'to'
>;

function toHistoryFilters(value: {
  q: string;
  status: CertificateStatus | '';
  from: string;
  to: string;
}): HistoryFilters {
  return {
    q: value.q.trim() || undefined,
    status: value.status || undefined,
    from: value.from || undefined,
    to: value.to || undefined,
  };
}

const sameFilters = (a: HistoryFilters, b: HistoryFilters): boolean =>
  a.q === b.q && a.status === b.status && a.from === b.from && a.to === b.to;

@Component({
  selector: 'app-admin-certificates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    StateMessage,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Certificados emitidos</h1>
      </header>

      <form class="filters" [formGroup]="filters">
        <mat-form-field>
          <mat-label>Aluno ou código</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input
            matInput
            id="history-q"
            formControlName="q"
            maxlength="100"
            autocomplete="off"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Status</mat-label>
          <mat-select id="history-status" formControlName="status">
            <mat-option value="">Todos</mat-option>
            <mat-option value="VALID">Válidos</mat-option>
            <mat-option value="REVOKED">Revogados</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Emitidos de</mat-label>
          <input
            matInput
            id="history-from"
            type="date"
            formControlName="from"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>até</mat-label>
          <input matInput id="history-to" type="date" formControlName="to" />
        </mat-form-field>
        @if (hasFilters()) {
          <div class="filter-actions">
            <button mat-button type="button" (click)="clearFilters()">
              <mat-icon>filter_alt_off</mat-icon>
              Limpar filtros
            </button>
          </div>
        }
      </form>

      @if (history.isLoading() || busyId()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (history.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível carregar o histórico"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="history.reload()"
        />
      } @else if (page(); as current) {
        @if (current.total === 0) {
          <app-state-message
            icon="history_edu"
            title="Nenhum certificado encontrado"
          />
        } @else {
          <div class="table-scroll">
            <table mat-table [dataSource]="current.items">
              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef>Código / registro</th>
                <td mat-cell *matCellDef="let row">
                  <span class="mono">{{ row.code }}</span
                  ><br />
                  <small class="muted">{{ row.registry }}</small>
                </td>
              </ng-container>
              <ng-container matColumnDef="student">
                <th mat-header-cell *matHeaderCellDef>Aluno</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.student.name }}<br /><small class="muted">{{
                    row.student.cpf
                  }}</small>
                </td>
              </ng-container>
              <ng-container matColumnDef="course">
                <th mat-header-cell *matHeaderCellDef>Curso</th>
                <td mat-cell *matCellDef="let row">{{ row.course.title }}</td>
              </ng-container>
              <ng-container matColumnDef="issuedAt">
                <th mat-header-cell *matHeaderCellDef>Emissão</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.issuedAt | date: 'short' }}<br /><small class="muted"
                    >por {{ row.issuedBy.name }}</small
                  >
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
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cdk-visually-hidden">Ações</span>
                </th>
                <td mat-cell *matCellDef="let row" class="actions">
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Detalhes"
                    aria-label="Ver detalhes"
                    (click)="openDetail(row.id)"
                  >
                    <mat-icon>info</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Baixar PDF"
                    aria-label="Baixar PDF"
                    (click)="download(row.id)"
                  >
                    <mat-icon>download</mat-icon>
                  </button>
                  @if (row.status === 'VALID') {
                    <button
                      mat-icon-button
                      type="button"
                      matTooltip="Revogar"
                      aria-label="Revogar certificado"
                      [disabled]="busyId() === row.id"
                      (click)="revoke(row)"
                    >
                      <mat-icon>block</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </div>
          <mat-paginator
            [length]="current.total"
            [pageIndex]="(query().page ?? 1) - 1"
            [pageSize]="query().pageSize ?? defaultPageSize"
            [pageSizeOptions]="[10, 20, 50, 100]"
            (page)="onPage($event)"
          />
        }
      }
    </section>
  `,
  styles: `
    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0 16px;
      align-items: start;
    }
    .filter-actions {
      display: flex;
      gap: 8px;
      padding-top: 8px;
    }
    .mono {
      font-family: var(--app-font-mono);
    }
    .actions {
      white-space: nowrap;
      text-align: right;
    }
  `,
})
export class AdminCertificatesPage {
  private readonly api = inject(CertificatesApi);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(Notify);

  protected readonly columns = [
    'code',
    'student',
    'course',
    'issuedAt',
    'status',
    'actions',
  ];
  // Linhas do mat-table chegam como any no template
  protected readonly statusLabel: Record<string, string> =
    CERTIFICATE_STATUS_LABEL;
  protected readonly defaultPageSize = DEFAULT_PAGE_SIZE;
  protected readonly busyId = signal<string | null>(null);

  protected readonly filters = inject(NonNullableFormBuilder).group({
    q: [''],
    status: ['' as CertificateStatus | ''],
    from: [''],
    to: [''],
  });

  protected readonly query = signal<CertificateHistoryQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  protected readonly history = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.history(params),
  });

  /** Mantém a última página na tela enquanto a próxima busca carrega, para a tabela não piscar a cada tecla. */
  protected readonly page = linkedSignal<
    Page<CertificateHistoryItem> | undefined,
    Page<CertificateHistoryItem> | undefined
  >({
    source: () => (this.history.hasValue() ? this.history.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly hasFilters = computed(() => {
    const { q, status, from, to } = this.query();
    return Boolean(q || status || from || to);
  });

  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.history.error())).message,
  );

  constructor() {
    // Texto espera a pausa na digitação; status e datas filtram na hora
    const { q, status, from, to } = this.filters.controls;
    merge(
      q.valueChanges.pipe(debounceTime(SEARCH_DEBOUNCE_MS)),
      status.valueChanges,
      from.valueChanges,
      to.valueChanges,
    )
      .pipe(
        map(() => toHistoryFilters(this.filters.getRawValue())),
        startWith(toHistoryFilters(this.filters.getRawValue())),
        distinctUntilChanged(sameFilters),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe((filters) =>
        this.query.update((current) => ({
          pageSize: current.pageSize,
          page: 1,
          ...filters,
        })),
      );
  }

  protected clearFilters(): void {
    this.filters.reset();
  }

  protected onPage(event: PageEvent): void {
    this.query.update((current) => ({
      ...current,
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    }));
  }

  protected openDetail(id: string): void {
    this.dialog.open(CertificateDetailDialog, {
      data: id,
      width: '720px',
      maxWidth: '95vw',
    });
  }

  protected download(id: string): void {
    this.api
      .downloadPdf(id)
      .subscribe({ error: (error: unknown) => void this.notify.error(error) });
  }

  protected revoke(certificate: CertificateHistoryItem): void {
    const data: ReasonDialogData = {
      title: `Revogar ${certificate.code}`,
      description:
        'O certificado continua no histórico, mas a verificação pública passa a mostrar "revogado". Esta ação não pode ser desfeita.',
      confirmLabel: 'Revogar certificado',
    };
    this.dialog
      .open(ReasonDialog, { data, width: '520px' })
      .afterClosed()
      .pipe(
        filter((reason): reason is string => typeof reason === 'string'),
        switchMap((reason) => {
          this.busyId.set(certificate.id);
          return this.api.revoke(certificate.id, reason);
        }),
      )
      .subscribe({
        next: () => {
          this.notify.success(`Certificado ${certificate.code} revogado.`);
          this.busyId.set(null);
          this.history.reload();
        },
        error: (error: unknown) => {
          void this.notify.error(error);
          this.busyId.set(null);
        },
      });
  }
}
