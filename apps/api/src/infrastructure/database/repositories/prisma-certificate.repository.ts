import { CertificateStatus, type CertificateSnapshot } from '@cert-docs/shared';
import type {
  Certificate as CertificateRow,
  Prisma,
} from '../../../generated/prisma/client';
import type {
  CertificateEntity,
  CertificateRecord,
} from '../../../domain/entities/certificate.entity';
import { CertificateAlreadyRequestedError } from '../../../domain/errors';
import type {
  CertificateRepositoryPort,
  CertificateSearch,
  NewCertificate,
} from '../../../domain/ports';
import type { PrismaDb } from '../prisma-db';
import { isUniqueConstraintViolation } from '../prisma-errors';

const withPeople = {
  issuedBy: { select: { name: true } },
  revokedBy: { select: { name: true } },
} satisfies Prisma.CertificateInclude;

type RecordRow = Prisma.CertificateGetPayload<{ include: typeof withPeople }>;

/** Preenchida só enquanto o certificado está VALID: a coluna única impede dois válidos. */
const validKey = (userId: string, courseId: string) => `${userId}:${courseId}`;

export class PrismaCertificateRepository implements CertificateRepositoryPort {
  constructor(private readonly db: PrismaDb) {}

  async hasValid(userId: string, courseId: string): Promise<boolean> {
    const count = await this.db.certificate.count({
      where: { validKey: validKey(userId, courseId) },
    });
    return count > 0;
  }

  async create(data: NewCertificate): Promise<CertificateEntity> {
    try {
      const row = await this.db.certificate.create({
        data: {
          ...data,
          snapshot: data.snapshot as unknown as Prisma.InputJsonObject,
          validKey: validKey(data.userId, data.courseId),
          holderName: data.snapshot.holder.name,
          courseTitle: data.snapshot.course.title,
        },
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new CertificateAlreadyRequestedError({ cause: error });
      }
      throw error;
    }
  }

  async findById(id: string): Promise<CertificateRecord | null> {
    const row = await this.db.certificate.findUnique({
      where: { id },
      include: withPeople,
    });
    return row && toRecord(row);
  }

  async findByCode(code: string): Promise<CertificateEntity | null> {
    const row = await this.db.certificate.findUnique({ where: { code } });
    return row && toDomain(row);
  }

  async listByUser(userId: string): Promise<CertificateEntity[]> {
    const rows = await this.db.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async search(
    query: CertificateSearch,
  ): Promise<{ items: CertificateRecord[]; total: number }> {
    const where: Prisma.CertificateWhereInput = {
      status: query.status,
      courseId: query.courseId,
      issuedAt:
        query.issuedFrom || query.issuedBefore
          ? { gte: query.issuedFrom, lt: query.issuedBefore }
          : undefined,
      OR: query.text
        ? [
            { holderName: { contains: query.text, mode: 'insensitive' } },
            { code: { contains: normalizeCodeFragment(query.text) } },
          ]
        : undefined,
    };

    const [rows, total] = await Promise.all([
      this.db.certificate.findMany({
        where,
        include: withPeople,
        orderBy: { issuedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.certificate.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }

  async markRevoked(
    id: string,
    revokerId: string,
    revokedAt: Date,
    reason: string,
  ): Promise<boolean> {
    const { count } = await this.db.certificate.updateMany({
      where: { id, status: CertificateStatus.VALID },
      data: {
        status: CertificateStatus.REVOKED,
        validKey: null,
        revokedById: revokerId,
        revokedAt,
        revocationReason: reason,
      },
    });
    return count > 0;
  }
}

/** "cert-7k3f-9qx2" → "7K3F9QX2", para buscar trechos do código como são guardados. */
function normalizeCodeFragment(text: string): string {
  return text
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/^CERT(?=.{1,12}$)/, '');
}

function toDomain(row: CertificateRow): CertificateEntity {
  return {
    id: row.id,
    requestId: row.requestId,
    userId: row.userId,
    courseId: row.courseId,
    code: row.code,
    registryYear: row.registryYear,
    registrySequence: row.registrySequence,
    status: row.status,
    snapshot: row.snapshot as unknown as CertificateSnapshot,
    dataHash: row.dataHash,
    fileHash: row.fileHash,
    fileKey: row.fileKey,
    issuedById: row.issuedById,
    issuedAt: row.issuedAt,
    revokedById: row.revokedById,
    revokedAt: row.revokedAt,
    revocationReason: row.revocationReason,
  };
}

function toRecord(row: RecordRow): CertificateRecord {
  return {
    ...toDomain(row),
    issuedByName: row.issuedBy.name,
    revokedByName: row.revokedBy?.name ?? null,
  };
}
