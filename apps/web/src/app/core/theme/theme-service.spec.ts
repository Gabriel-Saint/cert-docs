import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme-service';

describe('ThemeService', () => {
  const root = document.documentElement;

  afterEach(() => {
    localStorage.clear();
    root.classList.remove('theme-light', 'theme-dark');
  });

  it('segue o sistema quando nada foi escolhido', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('system');
    expect(root.classList.contains('theme-light')).toBe(false);
    expect(root.classList.contains('theme-dark')).toBe(false);
  });

  it('restaura a escolha salva ao abrir', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('dark');
    expect(root.classList.contains('theme-dark')).toBe(true);
  });

  it('ignora valor desconhecido no storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'roxo');
    expect(TestBed.inject(ThemeService).preference()).toBe('system');
  });

  it('troca a classe do <html> e lembra a escolha', () => {
    const theme = TestBed.inject(ThemeService);

    theme.set('dark');
    expect(root.classList.contains('theme-dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    theme.set('light');
    expect(root.classList.contains('theme-dark')).toBe(false);
    expect(root.classList.contains('theme-light')).toBe(true);

    theme.set('system');
    expect(root.classList.contains('theme-light')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
