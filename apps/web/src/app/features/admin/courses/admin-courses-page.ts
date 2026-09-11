import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { CourseView, CreateCourseRequest } from '@cert-docs/shared';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, switchMap } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { CoursesApi } from '../../../data-access/courses-api';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog';
import { Notify, unwrapResourceError } from '../../../shared/ui/notify';
import { StateMessage } from '../../../shared/ui/state-message';
import { CourseFormDialog } from './course-form-dialog';

@Component({
  selector: 'app-admin-courses-page',
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
        <h1>Cursos</h1>
        <button mat-flat-button type="button" (click)="create()">
          <mat-icon>add</mat-icon>
          Novo curso
        </button>
      </header>

      @if (courses.isLoading() || busy()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (courses.error()) {
        <app-state-message
          tone="error"
          icon="cloud_off"
          title="Não foi possível carregar os cursos"
          [description]="errorMessage()"
          actionLabel="Tentar novamente"
          (action)="courses.reload()"
        />
      } @else if (courses.hasValue() && courses.value().length === 0) {
        <app-state-message
          icon="menu_book"
          title="Nenhum curso cadastrado"
          description="Cadastre um curso para os alunos poderem pedir certificado."
        />
      } @else if (courses.hasValue()) {
        <div class="table-scroll">
          <table mat-table [dataSource]="courses.value()">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Curso</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.title }}</strong
                ><br />
                <span class="muted">{{ row.coordinator }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="modules">
              <th mat-header-cell *matHeaderCellDef>Módulos</th>
              <td mat-cell *matCellDef="let row">{{ row.modules.length }}</td>
            </ng-container>
            <ng-container matColumnDef="workload">
              <th mat-header-cell *matHeaderCellDef>Carga horária</th>
              <td mat-cell *matCellDef="let row">{{ row.workloadHours }} h</td>
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
                  aria-label="Editar curso"
                  (click)="edit(row)"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Desativar"
                  aria-label="Desativar curso"
                  (click)="deactivate(row)"
                >
                  <mat-icon>archive</mat-icon>
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
export class AdminCoursesPage {
  private readonly api = inject(CoursesApi);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(Notify);

  protected readonly columns = ['title', 'modules', 'workload', 'actions'];
  protected readonly busy = signal(false);
  protected readonly courses = rxResource({ stream: () => this.api.list() });
  protected readonly errorMessage = computed(
    () => toApiError(unwrapResourceError(this.courses.error())).message,
  );

  protected create(): void {
    this.openForm(null).subscribe(this.handle('Curso criado.'));
  }

  protected edit(course: CourseView): void {
    this.openForm(course).subscribe(this.handle('Curso atualizado.'));
  }

  protected deactivate(course: CourseView): void {
    const data: ConfirmDialogData = {
      title: 'Desativar curso',
      message: `"${course.title}" deixa de aceitar pedidos de certificado. Pedidos e certificados já existentes continuam valendo.`,
      confirmLabel: 'Desativar',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.busy.set(true);
          return this.api.deactivate(course.id);
        }),
      )
      .subscribe(this.handle('Curso desativado.'));
  }

  private openForm(course: CourseView | null) {
    return this.dialog
      .open(CourseFormDialog, {
        data: course,
        width: '720px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(
        filter((body): body is CreateCourseRequest => !!body),
        switchMap((body) => {
          this.busy.set(true);
          return course
            ? this.api.update(course.id, body)
            : this.api.create(body);
        }),
      );
  }

  private handle(successMessage: string) {
    return {
      next: () => {
        this.notify.success(successMessage);
        this.busy.set(false);
        this.courses.reload();
      },
      error: (error: unknown) => {
        void this.notify.error(error);
        this.busy.set(false);
      },
    };
  }
}
