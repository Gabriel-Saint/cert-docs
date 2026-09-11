import {
  CertificateStatus,
  Role,
  type CertificateHistoryQuery,
} from '@cpf-pdf/shared';
import type {
  CertificateEntity,
  CertificateRecord,
} from '../../../domain/entities/certificate.entity';
import {
  CertificateAlreadyRevokedError,
  CertificateNotFoundError,
} from '../../../domain/errors';
import type {
  CertificateRepositoryPort,
  CertificateStoragePort,
  ClockPort,
  TokenPayload,
} from '../../../domain/ports';
import {
  startOfDayInBrasilia,
  startOfNextDayInBrasilia,
} from '../../../domain/services/calendar';
import { sha256Hex } from '../../../domain/services/hash';
import { VerificationCode } from '../../../domain/value-objects/verification-code';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export class ListMyCertificatesUseCase {
  constructor(private readonly certificates: CertificateRepositoryPort) {}

  execute(userId: string): Promise<CertificateEntity[]> {
    return this.certificates.listByUser(userId);
  }
}

export class GetCertificateFileUseCase {
  constructor(
    private readonly certificates: CertificateRepositoryPort,
    private readonly storage: CertificateStoragePort,
  ) {}

  async execute(input: {
    certificateId: string;
    requester: TokenPayload;
  }): Promise<{ content: Buffer; fileName: string }> {
    const certificate = await this.certificates.findById(input.certificateId);
    const canAccess =
      certificate &&
      (input.requester.role === Role.ADMIN ||
        certificate.userId === input.requester.sub);

    // Certificado de outra pessoa responde igual a inexistente: não revela que existe
    if (!certificate || !canAccess) throw new CertificateNotFoundError();

    const code = VerificationCode.parse(certificate.code);
    return {
      // Sempre o arquivo guardado na emissão, mesmo se revogado
      content: await this.storage.read(certificate.fileKey),
      fileName: `certificado-${code.formatted()}.pdf`,
    };
  }
}

export class ListCertificatesUseCase {
  constructor(private readonly certificates: CertificateRepositoryPort) {}

  async execute(query: CertificateHistoryQuery): Promise<{
    items: CertificateRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const { items, total } = await this.certificates.search({
      status: query.status,
      courseId: query.courseId,
      issuedFrom: query.from ? startOfDayInBrasilia(query.from) : undefined,
      issuedBefore: query.to ? startOfNextDayInBrasilia(query.to) : undefined,
      text: query.q?.trim() || undefined,
      page,
      pageSize,
    });
    return { items, total, page, pageSize };
  }
}

export class GetCertificateDetailUseCase {
  constructor(private readonly certificates: CertificateRepositoryPort) {}

  async execute(id: string): Promise<CertificateRecord> {
    const certificate = await this.certificates.findById(id);
    if (!certificate) throw new CertificateNotFoundError();
    return certificate;
  }
}

export class RevokeCertificateUseCase {
  constructor(
    private readonly certificates: CertificateRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    certificateId: string;
    revokerId: string;
    reason: string;
  }): Promise<void> {
    const certificate = await this.certificates.findById(input.certificateId);
    if (!certificate) throw new CertificateNotFoundError();
    if (certificate.status === CertificateStatus.REVOKED) {
      throw new CertificateAlreadyRevokedError();
    }

    const revoked = await this.certificates.markRevoked(
      input.certificateId,
      input.revokerId,
      this.clock.now(),
      input.reason,
    );
    if (!revoked) throw new CertificateAlreadyRevokedError();
  }
}

export class VerifyCertificateUseCase {
  constructor(private readonly certificates: CertificateRepositoryPort) {}

  async execute(rawCode: string): Promise<CertificateEntity> {
    const code = VerificationCode.parse(rawCode);
    const certificate = await this.certificates.findByCode(code.value);
    if (!certificate) throw new CertificateNotFoundError();
    return certificate;
  }
}

export class CheckCertificateFileUseCase {
  constructor(private readonly certificates: CertificateRepositoryPort) {}

  async execute(input: {
    code: string;
    content: Buffer;
  }): Promise<{ matches: boolean }> {
    const code = VerificationCode.parse(input.code);
    const certificate = await this.certificates.findByCode(code.value);
    if (!certificate) throw new CertificateNotFoundError();

    return { matches: sha256Hex(input.content) === certificate.fileHash };
  }
}
