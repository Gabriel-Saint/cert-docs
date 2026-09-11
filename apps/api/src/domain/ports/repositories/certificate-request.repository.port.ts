import type { CertificateRequestStatus } from '@cpf-pdf/shared';
import type { CertificateRequestEntity } from '../../entities/certificate-request.entity';
import type { Cpf } from '../../value-objects/cpf';

export interface CertificateRequestListItem {
  request: CertificateRequestEntity;
  course: { id: string; title: string };
  student: { id: string; name: string; email: string; cpf: Cpf };
}

export interface CertificateRequestRepositoryPort {
  /** Lança CertificateAlreadyRequestedError se já houver pedido pendente para o aluno e o curso. */
  create(data: {
    userId: string;
    courseId: string;
  }): Promise<CertificateRequestEntity>;
  hasPending(userId: string, courseId: string): Promise<boolean>;
  findById(id: string): Promise<CertificateRequestEntity | null>;
  /** Mais recentes primeiro. */
  listByUser(userId: string): Promise<CertificateRequestListItem[]>;
  /** Mais antigos primeiro (fila de análise). */
  list(filter: {
    status?: CertificateRequestStatus;
  }): Promise<CertificateRequestListItem[]>;
  /** Só altera se o pedido estiver PENDING. Retorna false caso contrário. */
  markApproved(
    id: string,
    reviewerId: string,
    reviewedAt: Date,
  ): Promise<boolean>;
  /** Só altera se o pedido estiver PENDING. Retorna false caso contrário. */
  markRejected(
    id: string,
    reviewerId: string,
    reviewedAt: Date,
    reason: string,
  ): Promise<boolean>;
}
