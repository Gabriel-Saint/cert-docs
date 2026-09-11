import {
  DocumentNotFoundError,
  DownloadLogPersistenceError,
  PdfGenerationError,
  UserNotFoundError,
} from '../../../domain/errors';
import type {
  DocumentRepositoryPort,
  DownloadLogRepositoryPort,
  PdfGeneratorPort,
  UserRepositoryPort,
} from '../../../domain/ports';

export interface GeneratePersonalizedPdfInput {
  documentId: string;
  /** Sempre o usuário do token — nunca vem do body/query. */
  userId: string;
  ipAddress?: string | null;
}

export interface PersonalizedPdf {
  buffer: Buffer;
  fileName: string;
}

export class GeneratePersonalizedPdfUseCase {
  constructor(
    private readonly documentRepo: DocumentRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly logRepo: DownloadLogRepositoryPort,
    private readonly pdfGenerator: PdfGeneratorPort,
  ) {}

  async execute({
    documentId,
    userId,
    ipAddress,
  }: GeneratePersonalizedPdfInput): Promise<PersonalizedPdf> {
    const document = await this.documentRepo.findActiveById(documentId);
    if (!document) throw new DocumentNotFoundError();

    const user = await this.userRepo.findById(userId);
    if (!user) throw new UserNotFoundError();

    let buffer: Buffer;
    try {
      buffer = await this.pdfGenerator.generate({
        title: document.title,
        content: document.content,
        userCpf: user.cpf.formatted(),
        userName: user.name,
      });
    } catch (cause) {
      // Falhou antes de concluir: nenhum log é gravado.
      throw new PdfGenerationError({ cause });
    }

    try {
      // O log é gravado ANTES de devolver o PDF; se falhar, o PDF não sai.
      await this.logRepo.save({ userId, documentId, ipAddress });
    } catch (cause) {
      throw new DownloadLogPersistenceError({ cause });
    }

    return {
      buffer,
      fileName: `documento-${document.id}-${user.cpf.partial()}.pdf`,
    };
  }
}
