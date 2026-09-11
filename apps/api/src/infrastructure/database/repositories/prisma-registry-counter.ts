import type { RegistryCounterPort } from '../../../domain/ports';
import type { PrismaDb } from '../prisma-db';

export class PrismaRegistryCounter implements RegistryCounterPort {
  constructor(private readonly db: PrismaDb) {}

  async next(year: number): Promise<number> {
    // O UPDATE trava a linha do ano até o fim da transação: emissões simultâneas esperam na fila
    const rows = await this.db.$queryRaw<{ last: number }[]>`
      INSERT INTO registry_counters (year, last) VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE SET last = registry_counters.last + 1
      RETURNING last`;
    return Number(rows[0].last);
  }
}
