import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PrismaUnitOfWork } from '../infrastructure/database/prisma-unit-of-work';
import { PrismaCertificateRepository } from '../infrastructure/database/repositories/prisma-certificate.repository';
import { PrismaCertificateRequestRepository } from '../infrastructure/database/repositories/prisma-certificate-request.repository';
import { PrismaCourseRepository } from '../infrastructure/database/repositories/prisma-course.repository';
import { PrismaDocumentRepository } from '../infrastructure/database/repositories/prisma-document.repository';
import { PrismaDownloadLogRepository } from '../infrastructure/database/repositories/prisma-download-log.repository';
import { PrismaUserRepository } from '../infrastructure/database/repositories/prisma-user.repository';
import {
  CERTIFICATE_REPOSITORY,
  CERTIFICATE_REQUEST_REPOSITORY,
  COURSE_REPOSITORY,
  DOCUMENT_REPOSITORY,
  DOWNLOAD_LOG_REPOSITORY,
  UNIT_OF_WORK,
  USER_REPOSITORY,
} from './tokens';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: DOCUMENT_REPOSITORY, useClass: PrismaDocumentRepository },
    { provide: DOWNLOAD_LOG_REPOSITORY, useClass: PrismaDownloadLogRepository },
    // Os repositórios de certificados também rodam dentro de transações, por isso recebem o client
    {
      provide: COURSE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaCourseRepository(prisma),
    },
    {
      provide: CERTIFICATE_REQUEST_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new PrismaCertificateRequestRepository(prisma),
    },
    {
      provide: CERTIFICATE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new PrismaCertificateRepository(prisma),
    },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
  ],
  exports: [
    USER_REPOSITORY,
    DOCUMENT_REPOSITORY,
    DOWNLOAD_LOG_REPOSITORY,
    COURSE_REPOSITORY,
    CERTIFICATE_REQUEST_REPOSITORY,
    CERTIFICATE_REPOSITORY,
    UNIT_OF_WORK,
  ],
})
export class DatabaseModule {}
