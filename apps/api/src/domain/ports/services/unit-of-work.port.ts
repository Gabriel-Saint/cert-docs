import type { CertificateRequestRepositoryPort } from '../repositories/certificate-request.repository.port';
import type { CertificateRepositoryPort } from '../repositories/certificate.repository.port';
import type { RegistryCounterPort } from '../repositories/registry-counter.port';

/** Repositórios ligados à mesma transação. */
export interface TransactionalRepositories {
  requests: CertificateRequestRepositoryPort;
  certificates: CertificateRepositoryPort;
  registry: RegistryCounterPort;
}

export interface UnitOfWorkPort {
  /** Tudo o que `work` gravar é confirmado junto ou desfeito junto. */
  transaction<T>(
    work: (repositories: TransactionalRepositories) => Promise<T>,
  ): Promise<T>;
}
