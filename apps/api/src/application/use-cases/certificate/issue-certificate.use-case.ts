import type { CertificateSnapshot } from '@cert-docs/shared';
import { workloadHours } from '../../../domain/entities/course.entity';
import type { CertificateEntity } from '../../../domain/entities/certificate.entity';
import {
  CertificateIssuanceError,
  CertificateRequestAlreadyReviewedError,
  CourseNotFoundError,
  DomainError,
  UserNotFoundError,
} from '../../../domain/errors';
import type {
  CertificateRendererPort,
  CertificateStoragePort,
  ClockPort,
  CourseRepositoryPort,
  RandomPort,
  UnitOfWorkPort,
  UserRepositoryPort,
} from '../../../domain/ports';
import {
  isoDateInBrasilia,
  yearInBrasilia,
} from '../../../domain/services/calendar';
import { canonicalize } from '../../../domain/services/canonical-json';
import { sha256Hex } from '../../../domain/services/hash';
import { CertificatePeriod } from '../../../domain/value-objects/certificate-period';
import { Registry } from '../../../domain/value-objects/registry';
import { VerificationCode } from '../../../domain/value-objects/verification-code';
import {
  buildVerificationUrl,
  type CertificateSettings,
} from '../../certificate-settings';

export interface IssueCertificateInput {
  requestId: string;
  userId: string;
  courseId: string;
  issuerId: string;
  /** YYYY-MM-DD */
  startDate: string | null;
  /** YYYY-MM-DD */
  completionDate: string;
}

/**
 * Emite o certificado de um pedido. Separado da aprovação para que outros gatilhos
 * (ex.: conclusão automática de uma trilha) possam reutilizar a mesma emissão.
 */
export class IssueCertificateUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly users: UserRepositoryPort,
    private readonly courses: CourseRepositoryPort,
    private readonly renderer: CertificateRendererPort,
    private readonly storage: CertificateStoragePort,
    private readonly random: RandomPort,
    private readonly clock: ClockPort,
    private readonly settings: CertificateSettings,
  ) {}

  async execute(input: IssueCertificateInput): Promise<CertificateEntity> {
    const now = this.clock.now();
    const period = CertificatePeriod.create(
      input.startDate,
      input.completionDate,
      isoDateInBrasilia(now),
    );

    const [user, course] = await Promise.all([
      this.users.findById(input.userId),
      this.courses.findById(input.courseId),
    ]);
    if (!user) throw new UserNotFoundError();
    if (!course) throw new CourseNotFoundError();

    const code = VerificationCode.generate(this.random);
    const year = yearInBrasilia(now);
    const fileKey = `${year}/${code.value}.pdf`;
    const snapshot: CertificateSnapshot = {
      holder: { name: user.name, cpf: user.cpf.toString() },
      course: {
        title: course.title,
        coordinator: course.coordinator,
        workloadHours: workloadHours(course.modules),
        modules: course.modules.map(({ title, hours }) => ({ title, hours })),
      },
      period: {
        startDate: period.startDate,
        completionDate: period.completionDate,
      },
      institution: { ...this.settings.institution },
      issuedAt: now.toISOString(),
    };

    let fileSaved = false;
    try {
      return await this.unitOfWork.transaction(
        async ({ requests, certificates, registry }) => {
          // Trava o pedido: uma segunda aprovação simultânea não encontra mais PENDING
          const claimed = await requests.markApproved(
            input.requestId,
            input.issuerId,
            now,
          );
          if (!claimed) throw new CertificateRequestAlreadyReviewedError();

          const registryNumber = new Registry(year, await registry.next(year));
          const dataHash = sha256Hex(
            canonicalize({
              snapshot,
              code: code.formatted(),
              registry: registryNumber.formatted(),
            }),
          );

          const pdf = await this.renderer.render({
            snapshot,
            code: code.formatted(),
            registry: {
              number: registryNumber.formatted(),
              book: registryNumber.book,
              sheet: registryNumber.sheet,
            },
            dataHash,
            verificationUrl: buildVerificationUrl(
              this.settings.publicWebUrl,
              code,
            ),
          });

          await this.storage.save(fileKey, pdf);
          fileSaved = true;

          return certificates.create({
            requestId: input.requestId,
            userId: input.userId,
            courseId: input.courseId,
            code: code.value,
            registryYear: year,
            registrySequence: registryNumber.sequence,
            snapshot,
            dataHash,
            fileHash: sha256Hex(pdf),
            fileKey,
            issuedById: input.issuerId,
            issuedAt: now,
          });
        },
      );
    } catch (error) {
      // A transação já desfez o banco; o arquivo precisa ser removido à mão
      if (fileSaved) await this.storage.delete(fileKey).catch(() => undefined);
      if (error instanceof DomainError) throw error;
      throw new CertificateIssuanceError({ cause: error });
    }
  }
}
