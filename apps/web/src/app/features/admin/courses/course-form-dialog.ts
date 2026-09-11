import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type { CourseView, CreateCourseRequest } from '@cert-docs/shared';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { COURSE_LIMITS, totalWorkload } from '../../../data-access/courses-api';

/** Cria ou edita um curso. Fecha com o corpo pronto para a API. */
@Component({
  selector: 'app-course-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ course ? 'Editar curso' : 'Novo curso' }}</h2>
    <form [formGroup]="form" (ngSubmit)="confirm()" novalidate>
      <mat-dialog-content>
        <mat-form-field class="full-width">
          <mat-label>Título</mat-label>
          <input
            matInput
            id="course-title"
            formControlName="title"
            [maxlength]="limits.titleMaxLength"
          />
          @if (form.controls.title.invalid) {
            <mat-error>Informe o título.</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Coordenação</mat-label>
          <input
            matInput
            id="course-coordinator"
            formControlName="coordinator"
            [maxlength]="limits.coordinatorMaxLength"
          />
          <mat-hint>Aparece como segunda assinatura do certificado.</mat-hint>
          @if (form.controls.coordinator.invalid) {
            <mat-error>Informe quem coordena o curso.</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Descrição (opcional)</mat-label>
          <textarea
            matInput
            id="course-description"
            formControlName="description"
            rows="2"
            [maxlength]="limits.descriptionMaxLength"
          ></textarea>
        </mat-form-field>

        <div class="modules-header">
          <h3>Módulos</h3>
          <span class="total"
            >Total: {{ total() }} {{ total() === 1 ? 'hora' : 'horas' }}</span
          >
        </div>

        <div formArrayName="modules" class="modules">
          @for (
            module of form.controls.modules.controls;
            track module;
            let i = $index;
            let last = $last
          ) {
            <div class="module" [formGroupName]="i">
              <span class="index">{{ i + 1 }}</span>
              <mat-form-field class="module-title">
                <mat-label>Título do módulo</mat-label>
                <input
                  matInput
                  [id]="'module-title-' + i"
                  formControlName="title"
                  [maxlength]="limits.moduleTitleMaxLength"
                />
              </mat-form-field>
              <mat-form-field class="module-hours">
                <mat-label>Horas</mat-label>
                <input
                  matInput
                  [id]="'module-hours-' + i"
                  type="number"
                  formControlName="hours"
                  [min]="limits.minModuleHours"
                  [max]="limits.maxModuleHours"
                />
              </mat-form-field>
              <div class="module-actions">
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Subir"
                  aria-label="Mover módulo para cima"
                  [disabled]="i === 0"
                  (click)="move(i, -1)"
                >
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Descer"
                  aria-label="Mover módulo para baixo"
                  [disabled]="last"
                  (click)="move(i, 1)"
                >
                  <mat-icon>arrow_downward</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Remover"
                  aria-label="Remover módulo"
                  [disabled]="form.controls.modules.length === 1"
                  (click)="remove(i)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>

        <button
          mat-stroked-button
          type="button"
          [disabled]="form.controls.modules.length >= limits.maxModules"
          (click)="addModule()"
        >
          <mat-icon>add</mat-icon>
          Adicionar módulo
        </button>
        @if (showModuleErrors) {
          <p class="error" role="alert">
            Cada módulo precisa de título e de horas inteiras entre
            {{ limits.minModuleHours }} e {{ limits.maxModuleHours }}.
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit">
          {{ course ? 'Salvar alterações' : 'Criar curso' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .modules-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-top: 8px;
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .total {
      font-weight: 500;
    }
    .modules {
      display: grid;
      gap: 4px;
      margin: 8px 0;
    }
    .module {
      display: grid;
      grid-template-columns: 24px 1fr 96px auto;
      gap: 8px;
      align-items: center;
    }
    .index {
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
    }
    .module-actions {
      display: flex;
    }
    .error {
      color: var(--mat-sys-error);
    }
    @media (max-width: 599px) {
      .module {
        grid-template-columns: 24px 1fr 80px;
      }
      .module-actions {
        grid-column: 2 / -1;
        justify-content: flex-end;
      }
    }
  `,
})
export class CourseFormDialog {
  protected readonly course = inject<CourseView | null>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<CourseFormDialog, CreateCourseRequest>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly limits = COURSE_LIMITS;
  protected showModuleErrors = false;

  protected readonly form = this.fb.group({
    title: [
      this.course?.title ?? '',
      [Validators.required, Validators.maxLength(COURSE_LIMITS.titleMaxLength)],
    ],
    coordinator: [
      this.course?.coordinator ?? '',
      [
        Validators.required,
        Validators.maxLength(COURSE_LIMITS.coordinatorMaxLength),
      ],
    ],
    description: [
      this.course?.description ?? '',
      Validators.maxLength(COURSE_LIMITS.descriptionMaxLength),
    ],
    modules: this.fb.array(
      (this.course?.modules ?? [{ title: '', hours: 1 }]).map((module) =>
        this.moduleGroup(module.title, module.hours),
      ),
    ),
  });

  private readonly modulesValue = toSignal(
    this.form.controls.modules.valueChanges,
    {
      initialValue: this.form.controls.modules.getRawValue(),
    },
  );
  protected readonly total = computed(() => totalWorkload(this.modulesValue()));

  protected addModule(): void {
    this.form.controls.modules.push(this.moduleGroup('', 1));
  }

  protected remove(index: number): void {
    this.form.controls.modules.removeAt(index);
  }

  protected move(index: number, direction: -1 | 1): void {
    const modules = this.form.controls.modules;
    const control = modules.at(index);
    modules.removeAt(index, { emitEvent: false });
    modules.insert(index + direction, control);
  }

  protected confirm(): void {
    this.showModuleErrors = this.form.controls.modules.invalid;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, coordinator, description, modules } =
      this.form.getRawValue();
    this.dialogRef.close({
      title: title.trim(),
      coordinator: coordinator.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      modules: modules.map((module) => ({
        title: module.title.trim(),
        hours: Number(module.hours),
      })),
    });
  }

  private moduleGroup(title: string, hours: number) {
    return this.fb.group({
      title: [
        title,
        [
          Validators.required,
          Validators.maxLength(COURSE_LIMITS.moduleTitleMaxLength),
        ],
      ],
      hours: [
        hours,
        [
          Validators.required,
          Validators.min(COURSE_LIMITS.minModuleHours),
          Validators.max(COURSE_LIMITS.maxModuleHours),
          Validators.pattern(/^\d+$/),
        ],
      ],
    });
  }
}
