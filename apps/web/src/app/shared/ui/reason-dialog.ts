import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { REASON_LENGTH } from '../../data-access/certificate-requests-api';

export interface ReasonDialogData {
  title: string;
  description: string;
  confirmLabel: string;
}

/** Pede um motivo (recusa de pedido, revogação). Fecha com o texto ou sem valor ao cancelar. */
@Component({
  selector: 'app-reason-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="confirm()">
      <mat-dialog-content>
        <p class="muted">{{ data.description }}</p>
        <mat-form-field class="full-width">
          <mat-label>Motivo</mat-label>
          <textarea
            matInput
            id="reason"
            formControlName="reason"
            rows="4"
            [maxlength]="limits.max"
            cdkFocusInitial
          ></textarea>
          <mat-hint align="end"
            >{{ form.controls.reason.value.length }} /
            {{ limits.max }}</mat-hint
          >
          @if (
            form.controls.reason.hasError('minlength') ||
            form.controls.reason.hasError('required')
          ) {
            <mat-error
              >Escreva pelo menos {{ limits.min }} caracteres.</mat-error
            >
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit">{{ data.confirmLabel }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ReasonDialog {
  protected readonly data = inject<ReasonDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ReasonDialog, string>>(MatDialogRef);
  protected readonly limits = REASON_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    reason: [
      '',
      [
        Validators.required,
        Validators.minLength(REASON_LENGTH.min),
        Validators.maxLength(REASON_LENGTH.max),
      ],
    ],
  });

  protected confirm(): void {
    const reason = this.form.controls.reason.value.trim();
    this.form.controls.reason.setValue(reason);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(reason);
  }
}
