import { CertificateRequestStatus } from '@cpf-pdf/shared';
import type {
  CertificateRequest as CertificateRequestRow,
  Prisma,
} from '../../../generated/prisma/client';
import type { CertificateRequestEntity } from '../../../domain/entities/certificate-request.entity';
import { CertificateAlreadyRequestedError } from '../../../domain/errors';
import type {
  CertificateRequestListItem,
  CertificateRequestRepositoryPort,
} from '../../../domain/ports';
import { Cpf } from '../../../domain/value-objects/cpf';
import type { PrismaDb } from '../prisma-db';
import { isUniqueConstraintViolation } from '../prisma-errors';

const listInclude = {
  course: { select: { id: true, title: true } },
  user: { select: { id: true, name: true, email: true, cpf: true } },
} satisfies Prisma.CertificateRequestInclude;

type ListRow = Prisma.CertificateRequestGetPayload<{
  include: typeof listInclude;
}>;

/** Preenchida só enquanto o pedido está PENDING: a coluna única impede dois pendentes. */
const pendingKey = (userId: string, courseId: string) =>
  `${userId}:${courseId}`;

export class PrismaCertificateRequestRepository implements CertificateRequestRepositoryPort {
  constructor(private readonly db: PrismaDb) {}

  async create(data: {
    userId: string;
    courseId: string;
  }): Promise<CertificateRequestEntity> {
    try {
      const row = await this.db.certificateRequest.create({
        data: { ...data, pendingKey: pendingKey(data.userId, data.courseId) },
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new CertificateAlreadyRequestedError({ cause: error });
      }
      throw error;
    }
  }

  async hasPending(userId: string, courseId: string): Promise<boolean> {
    const count = await this.db.certificateRequest.count({
      where: { pendingKey: pendingKey(userId, courseId) },
    });
    return count > 0;
  }

  async findById(id: string): Promise<CertificateRequestEntity | null> {
    const row = await this.db.certificateRequest.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async listByUser(userId: string): Promise<CertificateRequestListItem[]> {
    const rows = await this.db.certificateRequest.findMany({
      where: { userId },
      include: listInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toListItem);
  }

  async list(filter: {
    status?: CertificateRequestStatus;
  }): Promise<CertificateRequestListItem[]> {
    const rows = await this.db.certificateRequest.findMany({
      where: { status: filter.status },
      include: listInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toListItem);
  }

  async markApproved(
    id: string,
    reviewerId: string,
    reviewedAt: Date,
  ): Promise<boolean> {
    // updateMany com filtro de status: trava a linha e só altera se ainda estiver PENDING
    const { count } = await this.db.certificateRequest.updateMany({
      where: { id, status: CertificateRequestStatus.PENDING },
      data: {
        status: CertificateRequestStatus.APPROVED,
        pendingKey: null,
        reviewedById: reviewerId,
        reviewedAt,
      },
    });
    return count > 0;
  }

  async markRejected(
    id: string,
    reviewerId: string,
    reviewedAt: Date,
    reason: string,
  ): Promise<boolean> {
    const { count } = await this.db.certificateRequest.updateMany({
      where: { id, status: CertificateRequestStatus.PENDING },
      data: {
        status: CertificateRequestStatus.REJECTED,
        pendingKey: null,
        reviewedById: reviewerId,
        reviewedAt,
        rejectionReason: reason,
      },
    });
    return count > 0;
  }
}

function toDomain(row: CertificateRequestRow): CertificateRequestEntity {
  return {
    id: row.id,
    userId: row.userId,
    courseId: row.courseId,
    status: row.status,
    rejectionReason: row.rejectionReason,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
  };
}

function toListItem(row: ListRow): CertificateRequestListItem {
  return {
    request: toDomain(row),
    course: row.course,
    student: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      cpf: Cpf.create(row.user.cpf),
    },
  };
}
