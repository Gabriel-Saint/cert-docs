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
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toApiError } from '../../core/api/api-error';
import { DocumentsApi } from '../../data-access/documents-api';
import { Notify, unwrapResourceError } from '../../shared/ui/notify';
import { StateMessage } from '../../shared/ui/state-message';

@Component({
  selector: 'app-documents-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    StateMessage,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Documentos</h1>
          <p class="muted">
            Cada PDF é gerado na hora com o seu CPF e nome em todas as páginas.
          </p>
        </div>
      </header>

      @if (documents.isLoading()) {
        <mat-spinner
          class="spinner"
          diameter="40"
          aria-label="Carregando documentos"
        />
      } @else if (documents.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível carregar os documentos"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="documents.reload()"
        />
      } @else if (documents.hasValue() && documents.value().length === 0) {
        <app-state-message
          icon="folder_off"
          title="Nenhum documento disponível no momento"
        />
      } @else if (documents.hasValue()) {
        <div class="grid">
          @for (document of documents.value(); track document.id) {
            <mat-card appearance="outlined">
              <mat-card-header>
                <mat-card-title>{{ document.title }}</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <p class="muted">
                  {{ document.description ?? 'Sem descrição.' }}
                </p>
              </mat-card-content>
              <mat-card-actions>
                <button
                  mat-flat-button
                  type="button"
                  [disabled]="downloading().has(document.id)"
                  (click)="download(document.id)"
                >
                  <mat-icon>download</mat-icon>
                  {{
                    downloading().has(document.id)
                      ? 'Gerando PDF…'
                      : 'Baixar PDF'
                  }}
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
export class DocumentsPage {
  private readonly api = inject(DocumentsApi);
  private readonly notify = inject(Notify);

  protected readonly documents = rxResource({ stream: () => this.api.list() });
  protected readonly downloading = signal<ReadonlySet<string>>(new Set());
  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.documents.error())).message,
  );

  protected download(id: string): void {
    this.downloading.update((ids) => new Set(ids).add(id));
    const done = () =>
      this.downloading.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });

    this.api.downloadPdf(id).subscribe({
      next: (fileName) => {
        this.notify.success(`Download iniciado: ${fileName}`);
        done();
      },
      error: (error: unknown) => {
        void this.notify.error(error);
        done();
      },
    });
  }
}
