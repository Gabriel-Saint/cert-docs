import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import type {
  ApproveCertificateRequestBody,
  CertificateRequestView,
} from '@cert-docs/shared';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { todayIsoDate } from '../../../shared/ui/labels';

function periodValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as string;
  const completion = group.get('completionDate')?.value as string;
  const errors: ValidationErrors = {};
  if (completion && completion > todayIsoDate())
    errors['futureCompletion'] = true;
  if (start && completion && start > completion)
    errors['startAfterCompletion'] = true;
  return Object.keys(errors).length ? errors : null;
}

/** Datas do curso para emitir o certificado. Fecha com o corpo da aprovação. */
@Component({
  selector: 'app-approve-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Aprovar e emitir certificado</h2>
    <form [formGroup]="form" (ngSubmit)="confirm()" novalidate>
      <mat-dialog-content>
        <p>
          <strong>{{ data.student.name }}</strong> ({{
            data.student.cpf
          }})<br />
          <span class="muted">{{ data.course.title }}</span>
        </p>
        <p class="muted">
          Os dados do aluno e do curso serão congelados no certificado.
        </p>

        <div class="dates">
          <mat-form-field>
            <mat-label>Início do curso (opcional)</mat-label>
            <input
              matInput
              id="approve-start"
              type="date"
              formControlName="startDate"
              [max]="today"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Conclusão</mat-label>
            <input
              matInput
              id="approve-completion"
              type="date"
              formControlName="completionDate"
              [max]="today"
            />
            @if (form.controls.completionDate.hasError('required')) {
              <mat-error>Informe a data de conclusão.</mat-error>
            }
          </mat-form-field>
        </div>

        @if (form.hasError('futureCompletion')) {
          <p class="error" role="alert">
            A conclusão não pode ser uma data futura.
          </p>
        }
        @if (form.hasError('startAfterCompletion')) {
          <p class="error" role="alert">
            O início não pode ser depois da conclusão.
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit">Emitir certificado</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .dates {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0 16px;
    }
    .error {
      color: var(--mat-sys-error);
      margin: 0;
    }
  `,
})
export class ApproveDialog {
  protected readonly data = inject<CertificateRequestView>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ApproveDialog, ApproveCertificateRequestBody>>(
      MatDialogRef,
    );
  protected readonly today = todayIsoDate();

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      startDate: [''],
      completionDate: [todayIsoDate(), Validators.required],
    },
    { validators: periodValidator },
  );

  protected confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { startDate, completionDate } = this.form.getRawValue();
    this.dialogRef.close({
      completionDate,
      ...(startDate ? { startDate } : {}),
    });
  }
}
