import {
  CertificateRequestStatus,
  type ApproveCertificateRequestBody,
} from '@cert-docs/shared';
import type { CertificateEntity } from '../../../domain/entities/certificate.entity';
import type { CertificateRequestEntity } from '../../../domain/entities/certificate-request.entity';
import {
  CertificateAlreadyRequestedError,
  CertificateRequestAlreadyReviewedError,
  CertificateRequestNotFoundError,
  CourseNotFoundError,
} from '../../../domain/errors';
import type {
  CertificateRepositoryPort,
  CertificateRequestListItem,
  CertificateRequestRepositoryPort,
  ClockPort,
  CourseRepositoryPort,
} from '../../../domain/ports';
import type { IssueCertificateUseCase } from '../certificate/issue-certificate.use-case';

export class RequestCertificateUseCase {
  constructor(
    private readonly courses: CourseRepositoryPort,
    private readonly requests: CertificateRequestRepositoryPort,
    private readonly certificates: CertificateRepositoryPort,
  ) {}

  async execute(input: { userId: string; courseId: string }): Promise<{
    request: CertificateRequestEntity;
    course: { id: string; title: string };
  }> {
    const course = await this.courses.findActiveById(input.courseId);
    if (!course) throw new CourseNotFoundError();

    const [hasPending, hasValid] = await Promise.all([
      this.requests.hasPending(input.userId, input.courseId),
      this.certificates.hasValid(input.userId, input.courseId),
    ]);
    if (hasPending || hasValid) throw new CertificateAlreadyRequestedError();

    // Duas requisições simultâneas podem passar pela checagem acima:
    // a chave única do banco barra a segunda e o repositório converte em 409.
    const request = await this.requests.create(input);
    return { request, course: { id: course.id, title: course.title } };
  }
}

export class ListMyCertificateRequestsUseCase {
  constructor(private readonly requests: CertificateRequestRepositoryPort) {}

  execute(userId: string): Promise<CertificateRequestListItem[]> {
    return this.requests.listByUser(userId);
  }
}

export class ListCertificateRequestsUseCase {
  constructor(private readonly requests: CertificateRequestRepositoryPort) {}

  execute(filter: {
    status?: CertificateRequestStatus;
  }): Promise<CertificateRequestListItem[]> {
    return this.requests.list(filter);
  }
}

/** A aprovação só valida o pedido; quem emite é o IssueCertificateUseCase. */
export class ApproveCertificateRequestUseCase {
  constructor(
    private readonly requests: CertificateRequestRepositoryPort,
    private readonly issueCertificate: IssueCertificateUseCase,
  ) {}

  async execute(
    input: {
      requestId: string;
      reviewerId: string;
    } & ApproveCertificateRequestBody,
  ): Promise<CertificateEntity> {
    const request = await this.requests.findById(input.requestId);
    if (!request) throw new CertificateRequestNotFoundError();
    if (request.status !== CertificateRequestStatus.PENDING) {
      throw new CertificateRequestAlreadyReviewedError();
    }

    return this.issueCertificate.execute({
      requestId: request.id,
      userId: request.userId,
      courseId: request.courseId,
      issuerId: input.reviewerId,
      startDate: input.startDate ?? null,
      completionDate: input.completionDate,
    });
  }
}

export class RejectCertificateRequestUseCase {
  constructor(
    private readonly requests: CertificateRequestRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    requestId: string;
    reviewerId: string;
    reason: string;
  }): Promise<void> {
    const request = await this.requests.findById(input.requestId);
    if (!request) throw new CertificateRequestNotFoundError();

    const rejected = await this.requests.markRejected(
      input.requestId,
      input.reviewerId,
      this.clock.now(),
      input.reason,
    );
    if (!rejected) throw new CertificateRequestAlreadyReviewedError();
  }
}
