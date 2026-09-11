import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { CreateDocumentRequest, DocumentSummary } from '@cert-docs/shared';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, map, switchMap } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { DocumentsApi } from '../../../data-access/documents-api';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog';
import { Notify, unwrapResourceError } from '../../../shared/ui/notify';
import { StateMessage } from '../../../shared/ui/state-message';
import { DocumentFormDialog } from './document-form-dialog';

@Component({
  selector: 'app-admin-documents-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    StateMessage,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Documentos</h1>
        <button mat-flat-button type="button" (click)="create()">
          <mat-icon>add</mat-icon>
          Novo documento
        </button>
      </header>

      @if (documents.isLoading() || busy()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (documents.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível carregar os documentos"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="documents.reload()"
        />
      } @else if (documents.hasValue() && documents.value().length === 0) {
        <app-state-message icon="folder" title="Nenhum documento cadastrado" />
      } @else if (documents.hasValue()) {
        <div class="table-scroll">
          <table mat-table [dataSource]="documents.value()">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Título</th>
              <td mat-cell *matCellDef="let row">{{ row.title }}</td>
            </ng-container>
            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Descrição</th>
              <td mat-cell *matCellDef="let row" class="muted">
                {{ row.description ?? '—' }}
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
                  matTooltip="Editar"
                  aria-label="Editar documento"
                  (click)="edit(row)"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Excluir"
                  aria-label="Excluir documento"
                  (click)="remove(row)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
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
  `,
})
export class AdminDocumentsPage {
  private readonly api = inject(DocumentsApi);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(Notify);

  protected readonly columns = ['title', 'description', 'actions'];
  protected readonly busy = signal(false);
  protected readonly documents = rxResource({ stream: () => this.api.list() });
  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.documents.error())).message,
  );

  protected create(): void {
    this.dialog
      .open(DocumentFormDialog, {
        data: null,
        width: '760px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(
        filter((body): body is CreateDocumentRequest => !!body),
        switchMap((body) => {
          this.busy.set(true);
          return this.api.create(body);
        }),
      )
      .subscribe(this.handle('Documento criado.'));
  }

  protected edit(summary: DocumentSummary): void {
    this.busy.set(true);
    // A lista não traz o conteúdo: busca o documento completo antes de abrir o formulário
    this.api
      .get(summary.id)
      .pipe(
        switchMap((document) => {
          this.busy.set(false);
          return this.dialog
            .open(DocumentFormDialog, {
              data: document,
              width: '760px',
              maxWidth: '95vw',
            })
            .afterClosed()
            .pipe(map((body) => ({ body })));
        }),
        filter(
          (result): result is { body: CreateDocumentRequest } => !!result.body,
        ),
        switchMap(({ body }) => {
          this.busy.set(true);
          return this.api.update(summary.id, body);
        }),
      )
      .subscribe(this.handle('Documento atualizado.'));
  }

  protected remove(document: DocumentSummary): void {
    const data: ConfirmDialogData = {
      title: 'Excluir documento',
      message: `"${document.title}" deixa de aparecer para os alunos. O histórico de downloads é mantido.`,
      confirmLabel: 'Excluir',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.busy.set(true);
          return this.api.remove(document.id);
        }),
      )
      .subscribe(this.handle('Documento excluído.'));
  }

  private handle(successMessage: string) {
    return {
      next: () => {
        this.notify.success(successMessage);
        this.busy.set(false);
        this.documents.reload();
      },
      error: (error: unknown) => {
        void this.notify.error(error);
        this.busy.set(false);
      },
    };
  }
}
