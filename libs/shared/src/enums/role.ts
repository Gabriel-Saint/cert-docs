/**
 * Objeto const + union type em vez de `enum`: os valores são strings puras,
 * compatíveis direto com o enum gerado pelo Prisma ('ADMIN' | 'USER').
 */
export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
