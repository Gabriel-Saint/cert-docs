import type { Prisma, PrismaClient } from '../../generated/prisma/client';

/** Cliente normal ou cliente de transação: os repositórios funcionam com os dois. */
export type PrismaDb = PrismaClient | Prisma.TransactionClient;
