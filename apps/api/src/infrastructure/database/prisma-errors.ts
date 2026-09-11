import { Prisma } from '../../generated/prisma/client';

/** P2002 = violação de restrição única (ex.: email ou CPF duplicado). */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
