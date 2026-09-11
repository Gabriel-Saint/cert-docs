import type { CertificateStatus } from '@cert-docs/shared';
import type {
  CertificateEntity,
  CertificateRecord,
} from '../../entities/certificate.entity';

export type NewCertificate = Omit<
  CertificateEntity,
  'id' | 'status' | 'revokedById' | 'revokedAt' | 'revocationReason'
>;

export interface CertificateSearch {
  status?: CertificateStatus;
  courseId?: string;
  /** Início do intervalo (inclusivo). */
  issuedFrom?: Date;
  /** Fim do intervalo (exclusivo). */
  issuedBefore?: Date;
  /** Busca no nome do aluno ou no código de verificação. */
  text?: string;
  page: number;
  pageSize: number;
}

export interface CertificateRepositoryPort {
  hasValid(userId: string, courseId: string): Promise<boolean>;
  /** Lança CertificateAlreadyRequestedError se já houver certificado válido para o aluno e o curso. */
  create(data: NewCertificate): Promise<CertificateEntity>;
  findById(id: string): Promise<CertificateRecord | null>;
  /** @param code código sem prefixo nem hífens */
  findByCode(code: string): Promise<CertificateEntity | null>;
  /** Mais recentes primeiro. */
  listByUser(userId: string): Promise<CertificateEntity[]>;
  /** Mais recentes primeiro. */
  search(
    query: CertificateSearch,
  ): Promise<{ items: CertificateRecord[]; total: number }>;
  /** Só altera se o certificado estiver VALID. Retorna false caso contrário. */
  markRevoked(
    id: string,
    revokerId: string,
    revokedAt: Date,
    reason: string,
  ): Promise<boolean>;
}
