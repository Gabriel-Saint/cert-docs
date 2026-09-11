/** Fuso usado nas datas impressas no certificado e na numeração anual do registro. */
export const CERTIFICATE_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Offset fixo de Brasília. O Brasil não tem horário de verão desde 2019,
 * então o início de um dia local é sempre 03:00 UTC.
 */
const BRASILIA_OFFSET = '-03:00';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data no fuso de Brasília no formato YYYY-MM-DD. */
export function isoDateInBrasilia(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CERTIFICATE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function yearInBrasilia(date: Date): number {
  return Number(isoDateInBrasilia(date).slice(0, 4));
}

/** Aceita somente datas reais no formato YYYY-MM-DD (rejeita 2026-02-30, por exemplo). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Instante em que começa o dia YYYY-MM-DD em Brasília. */
export function startOfDayInBrasilia(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00${BRASILIA_OFFSET}`);
}

/** Instante em que começa o dia seguinte a YYYY-MM-DD em Brasília (limite exclusivo). */
export function startOfNextDayInBrasilia(isoDate: string): Date {
  const start = startOfDayInBrasilia(isoDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
