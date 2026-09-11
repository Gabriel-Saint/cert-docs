/**
 * Implementações em memória dos ports de cursos e certificados, para testes sem banco.
 * A unidade de trabalho em memória desfaz as alterações quando o trabalho falha,
 * imitando o rollback de uma transação real.
 */
import { CertificateRequestStatus, CertificateStatus } from '@cert-docs/shared';
import type {
  CertificateEntity,
  CertificateRecord,
} from '../domain/entities/certificate.entity';
import type { CertificateRequestEntity } from '../domain/entities/certificate-request.entity';
import type { CourseEntity } from '../domain/entities/course.entity';
import { CertificateAlreadyRequestedError } from '../domain/errors';
import type {
  CertificateRendererPort,
  CertificateRenderInput,
  CertificateRepositoryPort,
  CertificateRequestListItem,
  CertificateRequestRepositoryPort,
  CertificateSearch,
  CertificateStoragePort,
  ClockPort,
  CourseChanges,
  CourseRepositoryPort,
  NewCertificate,
  NewCourse,
  RandomPort,
  RegistryCounterPort,
  TransactionalRepositories,
  UnitOfWorkPort,
} from '../domain/ports';
import type { InMemoryUserRepository } from './in-memory';

export class InMemoryCourseRepository implements CourseRepositoryPort {
  courses: CourseEntity[] = [];
  private sequence = 0;

  async findById(id: string): Promise<CourseEntity | null> {
    return this.courses.find((course) => course.id === id) ?? null;
  }

  async findActiveById(id: string): Promise<CourseEntity | null> {
    return this.courses.find((c) => c.id === id && c.isActive) ?? null;
  }

  async findAllActive(): Promise<CourseEntity[]> {
    return this.courses.filter((course) => course.isActive);
  }

  async create(data: NewCourse): Promise<CourseEntity> {
    const course: CourseEntity = {
      id: `course-${++this.sequence}`,
      ...data,
      modules: data.modules.map((m) => ({ ...m })),
      isActive: true,
      createdAt: new Date(),
    };
    this.courses.push(course);
    return course;
  }

  async update(
    id: string,
    changes: CourseChanges,
  ): Promise<CourseEntity | null> {
    const current = await this.findActiveById(id);
    if (!current) return null;
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    const updated: CourseEntity = { ...current, ...defined };
    this.courses = this.courses.map((c) => (c.id === id ? updated : c));
    return updated;
  }

  async deactivate(id: string): Promise<boolean> {
    const current = await this.findActiveById(id);
    if (!current) return false;
    this.courses = this.courses.map((c) =>
      c.id === id ? { ...c, isActive: false } : c,
    );
    return true;
  }
}

export class InMemoryCertificateRequestRepository implements CertificateRequestRepositoryPort {
  requests: CertificateRequestEntity[] = [];
  private sequence = 0;

  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly courses: InMemoryCourseRepository,
  ) {}

  async create(data: {
    userId: string;
    courseId: string;
  }): Promise<CertificateRequestEntity> {
    // Simula a chave única pendingKey
    if (await this.hasPending(data.userId, data.courseId)) {
      throw new CertificateAlreadyRequestedError();
    }
    const request: CertificateRequestEntity = {
      id: `request-${++this.sequence}`,
      ...data,
      status: CertificateRequestStatus.PENDING,
      rejectionReason: null,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(Date.now() + this.sequence),
    };
    this.requests.push(request);
    return request;
  }

  async hasPending(userId: string, courseId: string): Promise<boolean> {
    return this.requests.some(
      (r) =>
        r.userId === userId &&
        r.courseId === courseId &&
        r.status === CertificateRequestStatus.PENDING,
    );
  }

  async findById(id: string): Promise<CertificateRequestEntity | null> {
    return this.requests.find((request) => request.id === id) ?? null;
  }

  async listByUser(userId: string): Promise<CertificateRequestListItem[]> {
    const items = await this.toListItems(
      this.requests.filter((request) => request.userId === userId),
    );
    return items.reverse();
  }

  async list(filter: {
    status?: CertificateRequestStatus;
  }): Promise<CertificateRequestListItem[]> {
    return this.toListItems(
      this.requests.filter((r) => !filter.status || r.status === filter.status),
    );
  }

  async markApproved(
    id: string,
    reviewerId: string,
    reviewedAt: Date,
  ): Promise<boolean> {
    return this.review(id, {
      status: CertificateRequestStatus.APPROVED,
      reviewedById: reviewerId,
      reviewedAt,
    });
  }

  async markRejected(
    id: string,
    reviewerId: string,
    reviewedAt: Date,
    reason: string,
  ): Promise<boolean> {
    return this.review(id, {
      status: CertificateRequestStatus.REJECTED,
      reviewedById: reviewerId,
      reviewedAt,
      rejectionReason: reason,
    });
  }

  dump(): CertificateRequestEntity[] {
    return structuredClone(this.requests);
  }

  restore(state: CertificateRequestEntity[]): void {
    this.requests = state;
  }

  private review(
    id: string,
    changes: Partial<CertificateRequestEntity>,
  ): boolean {
    const index = this.requests.findIndex(
      (r) => r.id === id && r.status === CertificateRequestStatus.PENDING,
    );
    if (index === -1) return false;
    this.requests[index] = { ...this.requests[index], ...changes };
    return true;
  }

  private async toListItems(
    requests: CertificateRequestEntity[],
  ): Promise<CertificateRequestListItem[]> {
    return Promise.all(
      requests.map(async (request) => {
        const [user, course] = await Promise.all([
          this.users.findById(request.userId),
          this.courses.findById(request.courseId),
        ]);
        if (!user || !course) throw new Error('dados de teste inconsistentes');
        return {
          request,
          course: { id: course.id, title: course.title },
          student: {
            id: user.id,
            name: user.name,
            email: user.email,
            cpf: user.cpf,
          },
        };
      }),
    );
  }
}

export class InMemoryCertificateRepository implements CertificateRepositoryPort {
  certificates: CertificateEntity[] = [];
  private sequence = 0;

  constructor(private readonly users: InMemoryUserRepository) {}

  async hasValid(userId: string, courseId: string): Promise<boolean> {
    return this.certificates.some(
      (c) =>
        c.userId === userId &&
        c.courseId === courseId &&
        c.status === CertificateStatus.VALID,
    );
  }

  async create(data: NewCertificate): Promise<CertificateEntity> {
    // Simula a chave única validKey
    if (await this.hasValid(data.userId, data.courseId)) {
      throw new CertificateAlreadyRequestedError();
    }
    const certificate: CertificateEntity = {
      id: `certificate-${++this.sequence}`,
      ...structuredClone(data),
      status: CertificateStatus.VALID,
      revokedById: null,
      revokedAt: null,
      revocationReason: null,
    };
    this.certificates.push(certificate);
    return certificate;
  }

  async findById(id: string): Promise<CertificateRecord | null> {
    const certificate = this.certificates.find((c) => c.id === id);
    return certificate ? this.toRecord(certificate) : null;
  }

  async findByCode(code: string): Promise<CertificateEntity | null> {
    return this.certificates.find((c) => c.code === code) ?? null;
  }

  async listByUser(userId: string): Promise<CertificateEntity[]> {
    return this.certificates.filter((c) => c.userId === userId).reverse();
  }

  async search(
    query: CertificateSearch,
  ): Promise<{ items: CertificateRecord[]; total: number }> {
    const text = query.text?.toLowerCase();
    const matches = this.certificates
      .filter((c) => !query.status || c.status === query.status)
      .filter((c) => !query.courseId || c.courseId === query.courseId)
      .filter((c) => !query.issuedFrom || c.issuedAt >= query.issuedFrom)
      .filter((c) => !query.issuedBefore || c.issuedAt < query.issuedBefore)
      .filter(
        (c) =>
          !text ||
          c.snapshot.holder.name.toLowerCase().includes(text) ||
          c.code.toLowerCase().includes(text.replace(/[\s-]/g, '')),
      )
      .reverse();

    const start = (query.page - 1) * query.pageSize;
    const items = await Promise.all(
      matches.slice(start, start + query.pageSize).map((c) => this.toRecord(c)),
    );
    return { items, total: matches.length };
  }

  async markRevoked(
    id: string,
    revokerId: string,
    revokedAt: Date,
    reason: string,
  ): Promise<boolean> {
    const index = this.certificates.findIndex(
      (c) => c.id === id && c.status === CertificateStatus.VALID,
    );
    if (index === -1) return false;
    this.certificates[index] = {
      ...this.certificates[index],
      status: CertificateStatus.REVOKED,
      revokedById: revokerId,
      revokedAt,
      revocationReason: reason,
    };
    return true;
  }

  dump(): CertificateEntity[] {
    return structuredClone(this.certificates);
  }

  restore(state: CertificateEntity[]): void {
    this.certificates = state;
  }

  private async toRecord(
    certificate: CertificateEntity,
  ): Promise<CertificateRecord> {
    const issuer = await this.users.findById(certificate.issuedById);
    const revoker = certificate.revokedById
      ? await this.users.findById(certificate.revokedById)
      : null;
    return {
      ...certificate,
      issuedByName: issuer?.name ?? 'desconhecido',
      revokedByName: revoker?.name ?? null,
    };
  }
}

export class InMemoryRegistryCounter implements RegistryCounterPort {
  counters = new Map<number, number>();

  async next(year: number): Promise<number> {
    const next = (this.counters.get(year) ?? 0) + 1;
    this.counters.set(year, next);
    return next;
  }

  dump(): Map<number, number> {
    return new Map(this.counters);
  }

  restore(state: Map<number, number>): void {
    this.counters = state;
  }
}

export class InMemoryUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly requests: InMemoryCertificateRequestRepository,
    private readonly certificates: InMemoryCertificateRepository,
    private readonly registry: InMemoryRegistryCounter,
  ) {}

  async transaction<T>(
    work: (repositories: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const before = {
      requests: this.requests.dump(),
      certificates: this.certificates.dump(),
      registry: this.registry.dump(),
    };
    try {
      return await work({
        requests: this.requests,
        certificates: this.certificates,
        registry: this.registry,
      });
    } catch (error) {
      this.requests.restore(before.requests);
      this.certificates.restore(before.certificates);
      this.registry.restore(before.registry);
      throw error;
    }
  }
}

export class InMemoryCertificateStorage implements CertificateStoragePort {
  readonly files = new Map<string, Buffer>();
  failNextSave = false;

  async save(key: string, content: Buffer): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('disco cheio (simulado)');
    }
    if (this.files.has(key)) throw new Error(`arquivo já existe: ${key}`);
    this.files.set(key, Buffer.from(content));
  }

  async read(key: string): Promise<Buffer> {
    const content = this.files.get(key);
    if (!content) throw new Error(`arquivo não encontrado: ${key}`);
    return content;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}

/** Renderer falso: devolve bytes previsíveis sem abrir navegador. */
export class FakeCertificateRenderer implements CertificateRendererPort {
  readonly calls: CertificateRenderInput[] = [];
  failNextRender = false;

  async render(input: CertificateRenderInput): Promise<Buffer> {
    this.calls.push(structuredClone(input));
    if (this.failNextRender) {
      this.failNextRender = false;
      throw new Error('chromium caiu (simulado)');
    }
    return Buffer.from(`%PDF-fake ${input.code} ${input.snapshot.holder.name}`);
  }
}

export class FixedClock implements ClockPort {
  constructor(public current = new Date('2026-09-11T15:00:00.000Z')) {}

  now(): Date {
    return new Date(this.current);
  }
}

/** Gera bytes diferentes a cada chamada, mas de forma determinística. */
export class SequenceRandom implements RandomPort {
  private counter = 0;

  bytes(length: number): Uint8Array {
    this.counter++;
    return Uint8Array.from(
      { length },
      (_, i) => (this.counter * 31 + i * 17) % 256,
    );
  }
}
