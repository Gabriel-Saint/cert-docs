/**
 * JSON canônico: chaves ordenadas em todos os níveis, sem espaços e sem campos `undefined`.
 * O mesmo conteúdo sempre gera a mesma string, independentemente da ordem das chaves,
 * o que torna o hash dos dados reproduzível.
 */
export function canonicalize(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(',')}}`;
}
