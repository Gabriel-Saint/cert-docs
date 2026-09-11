import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PrismaDocumentRepository } from '../infrastructure/database/repositories/prisma-document.repository';
import { PrismaDownloadLogRepository } from '../infrastructure/database/repositories/prisma-download-log.repository';
import { PrismaUserRepository } from '../infrastructure/database/repositories/prisma-user.repository';
import {
  DOCUMENT_REPOSITORY,
  DOWNLOAD_LOG_REPOSITORY,
  USER_REPOSITORY,
} from './tokens';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: DOCUMENT_REPOSITORY, useClass: PrismaDocumentRepository },
    { provide: DOWNLOAD_LOG_REPOSITORY, useClass: PrismaDownloadLogRepository },
  ],
  exports: [USER_REPOSITORY, DOCUMENT_REPOSITORY, DOWNLOAD_LOG_REPOSITORY],
})
export class DatabaseModule {}
