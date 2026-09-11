import { Module } from '@nestjs/common';
import { CreateDocumentUseCase } from '../application/use-cases/document/create-document.use-case';
import { DeleteDocumentUseCase } from '../application/use-cases/document/delete-document.use-case';
import { GeneratePersonalizedPdfUseCase } from '../application/use-cases/document/generate-personalized-pdf.use-case';
import { GetDocumentUseCase } from '../application/use-cases/document/get-document.use-case';
import { ListDocumentsUseCase } from '../application/use-cases/document/list-documents.use-case';
import { UpdateDocumentUseCase } from '../application/use-cases/document/update-document.use-case';
import type {
  DocumentRepositoryPort,
  DownloadLogRepositoryPort,
  PdfGeneratorPort,
  UserRepositoryPort,
} from '../domain/ports';
import { PdfKitGeneratorAdapter } from '../infrastructure/pdf/pdfkit-generator.adapter';
import { DocumentController } from '../presentation/controllers/document.controller';
import {
  DOCUMENT_REPOSITORY,
  DOWNLOAD_LOG_REPOSITORY,
  PDF_GENERATOR,
  USER_REPOSITORY,
} from './tokens';

@Module({
  controllers: [DocumentController],
  providers: [
    { provide: PDF_GENERATOR, useClass: PdfKitGeneratorAdapter },
    {
      provide: ListDocumentsUseCase,
      inject: [DOCUMENT_REPOSITORY],
      useFactory: (documents: DocumentRepositoryPort) =>
        new ListDocumentsUseCase(documents),
    },
    {
      provide: GetDocumentUseCase,
      inject: [DOCUMENT_REPOSITORY],
      useFactory: (documents: DocumentRepositoryPort) =>
        new GetDocumentUseCase(documents),
    },
    {
      provide: CreateDocumentUseCase,
      inject: [DOCUMENT_REPOSITORY],
      useFactory: (documents: DocumentRepositoryPort) =>
        new CreateDocumentUseCase(documents),
    },
    {
      provide: UpdateDocumentUseCase,
      inject: [DOCUMENT_REPOSITORY],
      useFactory: (documents: DocumentRepositoryPort) =>
        new UpdateDocumentUseCase(documents),
    },
    {
      provide: DeleteDocumentUseCase,
      inject: [DOCUMENT_REPOSITORY],
      useFactory: (documents: DocumentRepositoryPort) =>
        new DeleteDocumentUseCase(documents),
    },
    {
      provide: GeneratePersonalizedPdfUseCase,
      inject: [
        DOCUMENT_REPOSITORY,
        USER_REPOSITORY,
        DOWNLOAD_LOG_REPOSITORY,
        PDF_GENERATOR,
      ],
      useFactory: (
        documents: DocumentRepositoryPort,
        users: UserRepositoryPort,
        logs: DownloadLogRepositoryPort,
        pdf: PdfGeneratorPort,
      ) => new GeneratePersonalizedPdfUseCase(documents, users, logs, pdf),
    },
  ],
})
export class DocumentModule {}
