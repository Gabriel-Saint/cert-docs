import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type { CreateDocumentRequest, DocumentDetail } from '@cert-docs/shared';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Mesmos limites da API (CreateDocumentDto). */
const LIMITS = { title: 255, description: 1000 } as const;

@Component({
  selector: 'app-document-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ document ? 'Editar documento' : 'Novo documento' }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="confirm()" novalidate>
      <mat-dialog-content>
        <mat-form-field class="full-width">
          <mat-label>Título</mat-label>
          <input
            matInput
            id="document-title"
            formControlName="title"
            [maxlength]="limits.title"
          />
          @if (form.controls.title.invalid) {
            <mat-error>Informe o título.</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Descrição (opcional)</mat-label>
          <textarea
            matInput
            id="document-description"
            formControlName="description"
            rows="2"
            [maxlength]="limits.description"
          ></textarea>
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Conteúdo</mat-label>
          <textarea
            matInput
            id="document-content"
            formControlName="content"
            rows="12"
          ></textarea>
          <mat-hint>Quebras de linha são mantidas no PDF.</mat-hint>
          @if (form.controls.content.invalid) {
            <mat-error>Informe o conteúdo.</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit">
          {{ document ? 'Salvar alterações' : 'Criar documento' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class DocumentFormDialog {
  protected readonly document = inject<DocumentDetail | null>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<DocumentFormDialog, CreateDocumentRequest>>(
      MatDialogRef,
    );
  protected readonly limits = LIMITS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: [
      this.document?.title ?? '',
      [Validators.required, Validators.maxLength(LIMITS.title)],
    ],
    description: [
      this.document?.description ?? '',
      Validators.maxLength(LIMITS.description),
    ],
    content: [this.document?.content ?? '', Validators.required],
  });

  protected confirm(): void {
    const { title, description, content } = this.form.getRawValue();
    this.form.patchValue({ title: title.trim() });
    if (this.form.invalid || !content.trim()) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close({
      title: title.trim(),
      content,
      ...(description.trim() ? { description: description.trim() } : {}),
    });
  }
}
