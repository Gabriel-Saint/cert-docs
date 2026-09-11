import { Injectable } from '@nestjs/common';
import type {
  TransactionalRepositories,
  UnitOfWorkPort,
} from '../../domain/ports';
import { PrismaService } from './prisma.service';
import { PrismaCertificateRepository } from './repositories/prisma-certificate.repository';
import { PrismaCertificateRequestRepository } from './repositories/prisma-certificate-request.repository';
import { PrismaRegistryCounter } from './repositories/prisma-registry-counter';

/** A emissão renderiza o PDF dentro da transação, por isso o timeout é maior que o padrão (5 s). */
const TRANSACTION_TIMEOUT_MS = 60_000;

@Injectable()
export class PrismaUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(
    work: (repositories: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      (tx) =>
        work({
          requests: new PrismaCertificateRequestRepository(tx),
          certificates: new PrismaCertificateRepository(tx),
          registry: new PrismaRegistryCounter(tx),
        }),
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: 10_000 },
    );
  }
}
