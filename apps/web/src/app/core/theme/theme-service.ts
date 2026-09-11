import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'cert-docs.theme';

/** Classes no <html> que fixam o color-scheme; sem nenhuma, vale o tema do sistema. */
const THEME_CLASS = { light: 'theme-light', dark: 'theme-dark' } as const;

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Tema claro, escuro ou automático, lembrado entre visitas. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly preferenceState = signal<ThemePreference>(
    readStoredPreference(),
  );
  readonly preference = this.preferenceState.asReadonly();

  constructor() {
    this.apply(this.preferenceState());
  }

  set(preference: ThemePreference): void {
    this.preferenceState.set(preference);
    this.apply(preference);
    try {
      if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Sem acesso ao storage o tema vale só para esta visita
    }
  }

  private apply(preference: ThemePreference): void {
    this.root.classList.toggle(THEME_CLASS.light, preference === 'light');
    this.root.classList.toggle(THEME_CLASS.dark, preference === 'dark');
  }
}
