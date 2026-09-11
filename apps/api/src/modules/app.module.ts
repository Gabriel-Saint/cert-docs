import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from '../config/env.validation';
import { DomainExceptionFilter } from '../presentation/filters/domain-exception.filter';
import { AuthModule } from './auth.module';
import { CertificateModule } from './certificate.module';
import { CourseModule } from './course.module';
import { DatabaseModule } from './database.module';
import { DocumentModule } from './document.module';
import { UserModule } from './user.module';

@Module({
  imports: [
    // Lê o .env da raiz em dev; no Docker as variáveis vêm do ambiente do container
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Limite usado pelo ThrottlerGuard nas rotas públicas de verificação
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    DatabaseModule,
    AuthModule,
    DocumentModule,
    UserModule,
    CourseModule,
    CertificateModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
