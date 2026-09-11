import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  type ThemePreference,
  ThemeService,
} from '../../core/theme/theme-service';

const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Claro', icon: 'light_mode' },
  { value: 'dark', label: 'Escuro', icon: 'dark_mode' },
  { value: 'system', label: 'Automático', icon: 'contrast' },
];

/** Botão com menu para escolher o tema. */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      type="button"
      [matMenuTriggerFor]="menu"
      [matTooltip]="'Tema: ' + current().label"
      aria-label="Escolher tema"
    >
      <mat-icon>{{ current().icon }}</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      @for (option of options; track option.value) {
        <button
          mat-menu-item
          type="button"
          role="menuitemradio"
          [attr.aria-checked]="theme.preference() === option.value"
          (click)="theme.set(option.value)"
        >
          <mat-icon>{{ option.icon }}</mat-icon>
          <!-- mat-menu-item projeta todo mat-icon no início; o check à direita é um span com a fonte de ícones -->
          <span class="option">
            <span>{{ option.label }}</span>
            @if (theme.preference() === option.value) {
              <span class="material-symbols-outlined check" aria-hidden="true"
                >check</span
              >
            }
          </span>
        </button>
      }
    </mat-menu>
  `,
  styles: `
    .option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-width: 120px;
    }
    .check {
      font-size: 20px;
      color: var(--mat-sys-primary);
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly options = OPTIONS;
  protected readonly current = computed(
    () =>
      OPTIONS.find((option) => option.value === this.theme.preference()) ??
      OPTIONS[2],
  );
}
