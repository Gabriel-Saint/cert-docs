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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { CertificateRequestsApi } from '../../data-access/certificate-requests-api';
import { CertificatesApi } from '../../data-access/certificates-api';
import { CoursesApi } from '../../data-access/courses-api';
import { Notify, unwrapResourceError } from '../../shared/ui/notify';
import { StateMessage } from '../../shared/ui/state-message';
import { certificateStateFor } from './certificate-state';

@Component({
  selector: 'app-courses-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    StateMessage,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Cursos</h1>
          <p class="muted">
            Concluiu um curso? Solicite o certificado e acompanhe em "Meus
            certificados".
          </p>
        </div>
      </header>

      @if (data.isLoading() && !data.hasValue()) {
        <mat-spinner
          class="spinner"
          diameter="40"
          aria-label="Carregando cursos"
        />
      } @else if (data.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível carregar os cursos"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="data.reload()"
        />
      } @else if (cards().length === 0) {
        <app-state-message
          icon="school"
          title="Nenhum curso disponível no momento"
        />
      } @else {
        <div class="list">
          @for (card of cards(); track card.course.id) {
            <mat-card appearance="outlined">
              <mat-card-header>
                <mat-card-title>{{ card.course.title }}</mat-card-title>
                <mat-card-subtitle>
                  {{ card.course.workloadHours }} horas ·
                  {{ card.course.coordinator }}
                </mat-card-subtitle>
              </mat-card-header>

              <mat-card-content>
                @if (card.course.description) {
                  <p>{{ card.course.description }}</p>
                }
                <mat-expansion-panel class="syllabus">
                  <mat-expansion-panel-header>
                    <mat-panel-title
                      >Conteúdo programático ({{
                        card.course.modules.length
                      }}
                      módulos)</mat-panel-title
                    >
                  </mat-expansion-panel-header>
                  <ol>
                    @for (module of card.course.modules; track $index) {
                      <li>
                        {{ module.title }}
                        <span class="muted">— {{ module.hours }} h</span>
                      </li>
                    }
                  </ol>
                </mat-expansion-panel>

                @switch (card.state.kind) {
                  @case ('issued') {
                    <p class="status">
                      <mat-icon>verified</mat-icon> Certificado emitido
                    </p>
                  }
                  @case ('pending') {
                    <p class="status">
                      <mat-icon>hourglass_top</mat-icon> Pedido em análise
                    </p>
                  }
                  @case ('available') {
                    @if (
                      card.state.kind === 'available' &&
                      card.state.lastRejection
                    ) {
                      <p class="status rejected">
                        <mat-icon>info</mat-icon>
                        Último pedido recusado:
                        {{ card.state.lastRejection.rejectionReason }}
                      </p>
                    }
                  }
                }
              </mat-card-content>

              <mat-card-actions>
                @switch (card.state.kind) {
                  @case ('issued') {
                    <a mat-stroked-button routerLink="/meus-certificados"
                      >Ver certificado</a
                    >
                  }
                  @case ('pending') {
                    <button mat-stroked-button type="button" disabled>
                      Aguardando aprovação
                    </button>
                  }
                  @default {
                    <button
                      mat-flat-button
                      type="button"
                      [disabled]="requesting() === card.course.id"
                      (click)="request(card.course.id)"
                    >
                      <mat-icon>workspace_premium</mat-icon>
                      Solicitar certificado
                    </button>
                  }
                }
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .list {
      display: grid;
      gap: 16px;
    }
    .syllabus {
      margin: 12px 0;
    }
    ol {
      margin: 0;
      padding-left: 20px;
      display: grid;
      gap: 4px;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0 0;
    }
    .rejected {
      color: var(--mat-sys-error);
    }
    /* O conteúdo ocupa a sobra para o botão ficar no rodapé em todos os cards da linha */
    mat-card-content {
      flex: 1;
    }
    mat-card-actions a,
    mat-card-actions button {
      min-height: 44px;
    }
    .spinner {
      margin: 40px auto;
    }
  `,
})
export class CoursesPage {
  private readonly coursesApi = inject(CoursesApi);
  private readonly requestsApi = inject(CertificateRequestsApi);
  private readonly certificatesApi = inject(CertificatesApi);
  private readonly notify = inject(Notify);

  protected readonly requesting = signal<string | null>(null);

  protected readonly data = rxResource({
    stream: () =>
      forkJoin({
        courses: this.coursesApi.list(),
        requests: this.requestsApi.mine(),
        certificates: this.certificatesApi.mine(),
      }),
  });

  protected readonly cards = computed(() => {
    if (!this.data.hasValue()) return [];
    const { courses, requests, certificates } = this.data.value();
    return courses.map((course) => ({
      course,
      state: certificateStateFor(course.id, requests, certificates),
    }));
  });

  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.data.error())).message,
  );

  protected request(courseId: string): void {
    this.requesting.set(courseId);
    this.requestsApi.request(courseId).subscribe({
      next: () => {
        this.notify.success(
          'Pedido enviado. Você será avisado em "Meus certificados".',
        );
        this.requesting.set(null);
        this.data.reload();
      },
      error: (error: unknown) => {
        void this.notify.error(error);
        this.requesting.set(null);
        this.data.reload();
      },
    });
  }
}
