/**
 * Implementações em memória dos ports, usadas nos testes.
 * Permitem testar casos de uso e o fluxo HTTP sem banco de dados.
 */
import { Role } from '@cert-docs/shared';
import { DocumentEntity } from '../domain/entities/document.entity';
import { UserEntity } from '../domain/entities/user.entity';
import { EmailOrCpfAlreadyInUseError } from '../domain/errors';
import type {
  DocumentChanges,
  DocumentRepositoryPort,
  DownloadLogRepositoryPort,
  HashPort,
  NewDocument,
  NewDownloadLog,
  NewUser,
  PdfGenerationOptions,
  PdfGeneratorPort,
  TokenPayload,
  TokenPort,
  UserRepositoryPort,
} from '../domain/ports';
import { Cpf } from '../domain/value-objects/cpf';

export class InMemoryUserRepository implements UserRepositoryPort {
  readonly users: UserEntity[] = [];
  private sequence = 0;

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findByCpf(cpf: Cpf): Promise<UserEntity | null> {
    return this.users.find((user) => user.cpf.equals(cpf)) ?? null;
  }

  async create(data: NewUser): Promise<UserEntity> {
    // Simula a restrição única do banco
    if (
      this.users.some((u) => u.email === data.email || u.cpf.equals(data.cpf))
    ) {
      throw new EmailOrCpfAlreadyInUseError();
    }
    const user = new UserEntity(
      `user-${++this.sequence}`,
      data.name,
      data.email,
      data.cpf,
      data.passwordHash,
      data.role,
      new Date(),
    );
    this.users.push(user);
    return user;
  }

  async findAll(): Promise<UserEntity[]> {
    return [...this.users];
  }
}

export class InMemoryDocumentRepository implements DocumentRepositoryPort {
  documents: DocumentEntity[] = [];
  private sequence = 0;

  async findActiveById(id: string): Promise<DocumentEntity | null> {
    return this.documents.find((d) => d.id === id && d.isActive) ?? null;
  }

  async findAllActive(): Promise<DocumentEntity[]> {
    return this.documents.filter((d) => d.isActive);
  }

  async create(data: NewDocument): Promise<DocumentEntity> {
    const document = new DocumentEntity(
      `doc-${++this.sequence}`,
      data.title,
      data.description,
      data.content,
      true,
      new Date(),
    );
    this.documents.push(document);
    return document;
  }

  async update(
    id: string,
    changes: DocumentChanges,
  ): Promise<DocumentEntity | null> {
    const current = await this.findActiveById(id);
    if (!current) return null;
    const updated = new DocumentEntity(
      current.id,
      changes.title ?? current.title,
      changes.description !== undefined
        ? changes.description
        : current.description,
      changes.content ?? current.content,
      current.isActive,
      current.createdAt,
    );
    this.replace(updated);
    return updated;
  }

  async deactivate(id: string): Promise<boolean> {
    const current = await this.findActiveById(id);
    if (!current) return false;
    this.replace(
      new DocumentEntity(
        current.id,
        current.title,
        current.description,
        current.content,
        false,
        current.createdAt,
      ),
    );
    return true;
  }

  private replace(document: DocumentEntity): void {
    this.documents = this.documents.map((d) =>
      d.id === document.id ? document : d,
    );
  }
}

export class InMemoryDownloadLogRepository implements DownloadLogRepositoryPort {
  readonly logs: NewDownloadLog[] = [];
  failNextSave = false;

  async save(data: NewDownloadLog): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('falha simulada no banco');
    }
    this.logs.push(data);
  }
}

export class FakePdfGenerator implements PdfGeneratorPort {
  readonly calls: PdfGenerationOptions[] = [];
  failNextGeneration = false;

  async generate(options: PdfGenerationOptions): Promise<Buffer> {
    this.calls.push(options);
    if (this.failNextGeneration) {
      this.failNextGeneration = false;
      throw new Error('falha simulada no PDF');
    }
    return Buffer.from(`%PDF fake ${options.userCpf}`);
  }
}

/** Hash reversível e rápido, só para testes de caso de uso. */
export class FakeHash implements HashPort {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return hashed === `hashed:${plain}`;
  }
}

export class FakeToken implements TokenPort {
  async sign(payload: TokenPayload): Promise<string> {
    return `token:${payload.sub}:${payload.role}`;
  }
}

export function makeUser(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    cpf: string;
    passwordHash: string;
    role: Role;
  }> = {},
): UserEntity {
  return new UserEntity(
    overrides.id ?? 'user-1',
    overrides.name ?? 'João Silva',
    overrides.email ?? 'joao@example.com',
    Cpf.create(overrides.cpf ?? '52998224725'),
    overrides.passwordHash ?? 'hashed:senha12345',
    overrides.role ?? Role.USER,
    new Date(),
  );
}

export function makeDocument(
  overrides: Partial<{
    id: string;
    title: string;
    description: string | null;
    content: string;
    isActive: boolean;
  }> = {},
): DocumentEntity {
  return new DocumentEntity(
    overrides.id ?? 'doc-1',
    overrides.title ?? 'Apostila',
    overrides.description ?? null,
    overrides.content ?? 'Conteúdo da apostila',
    overrides.isActive ?? true,
    new Date(),
  );
}
