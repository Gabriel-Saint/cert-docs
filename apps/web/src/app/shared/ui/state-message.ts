import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Mensagem de estado vazio ou de erro, com ação opcional (ex.: "Tentar novamente"). */
@Component({
  selector: 'app-state-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="state" [attr.role]="tone() === 'error' ? 'alert' : null">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      <p class="title">{{ title() }}</p>
      @if (description()) {
        <p class="muted">{{ description() }}</p>
      }
      @if (actionLabel()) {
        <button mat-stroked-button type="button" (click)="action.emit()">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: `
    .state {
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: 40px 16px;
      text-align: center;
    }
    mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }
    p {
      margin: 0;
    }
    .title {
      font: var(--mat-sys-title-medium);
    }
  `,
})
export class StateMessage {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly icon = input('info');
  readonly tone = input<'empty' | 'error'>('empty');
  readonly actionLabel = input<string>();
  readonly action = output<void>();
}
