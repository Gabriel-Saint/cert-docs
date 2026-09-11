import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CertificateSettings } from '../application/certificate-settings';
import {
  CheckCertificateFileUseCase,
  GetCertificateDetailUseCase,
  GetCertificateFileUseCase,
  ListCertificatesUseCase,
  ListMyCertificatesUseCase,
  RevokeCertificateUseCase,
  VerifyCertificateUseCase,
} from '../application/use-cases/certificate/certificate.use-cases';
import { IssueCertificateUseCase } from '../application/use-cases/certificate/issue-certificate.use-case';
import {
  ApproveCertificateRequestUseCase,
  ListCertificateRequestsUseCase,
  ListMyCertificateRequestsUseCase,
  RejectCertificateRequestUseCase,
  RequestCertificateUseCase,
} from '../application/use-cases/certificate-request/certificate-request.use-cases';
import type {
  CertificateRendererPort,
  CertificateRepositoryPort,
  CertificateRequestRepositoryPort,
  CertificateStoragePort,
  ClockPort,
  CourseRepositoryPort,
  RandomPort,
  UnitOfWorkPort,
  UserRepositoryPort,
} from '../domain/ports';
import { PlaywrightCertificateRenderer } from '../infrastructure/certificate/playwright-certificate.renderer';
import { LocalDiskCertificateStorage } from '../infrastructure/storage/local-disk-certificate.storage';
import {
  CryptoRandomAdapter,
  SystemClockAdapter,
} from '../infrastructure/system/system.adapters';
import { CertificateController } from '../presentation/controllers/certificate.controller';
import { CertificateRequestController } from '../presentation/controllers/certificate-request.controller';
import { PublicCertificateController } from '../presentation/controllers/public-certificate.controller';
import {
  CERTIFICATE_RENDERER,
  CERTIFICATE_REPOSITORY,
  CERTIFICATE_REQUEST_REPOSITORY,
  CERTIFICATE_SETTINGS,
  CERTIFICATE_STORAGE,
  CLOCK,
  COURSE_REPOSITORY,
  RANDOM,
  UNIT_OF_WORK,
  USER_REPOSITORY,
} from './tokens';

@Module({
  controllers: [
    CertificateRequestController,
    CertificateController,
    PublicCertificateController,
  ],
  providers: [
    // ---------- Adapters ----------
    { provide: CERTIFICATE_RENDERER, useClass: PlaywrightCertificateRenderer },
    {
      provide: CERTIFICATE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new LocalDiskCertificateStorage(
          config.get<string>(
            'CERTIFICATES_STORAGE_DIR',
            'storage/certificates',
          ),
        ),
    },
    { provide: RANDOM, useClass: CryptoRandomAdapter },
    { provide: CLOCK, useClass: SystemClockAdapter },
    {
      provide: CERTIFICATE_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): CertificateSettings => ({
        publicWebUrl: config.getOrThrow<string>('PUBLIC_WEB_URL'),
        institution: {
          name: config.getOrThrow<string>('INSTITUTION_NAME'),
          city: config.getOrThrow<string>('INSTITUTION_CITY'),
          director: config.getOrThrow<string>('INSTITUTION_DIRECTOR'),
          directorRole: config.getOrThrow<string>('INSTITUTION_DIRECTOR_ROLE'),
        },
      }),
    },

    // ---------- Pedidos ----------
    {
      provide: RequestCertificateUseCase,
      inject: [
        COURSE_REPOSITORY,
        CERTIFICATE_REQUEST_REPOSITORY,
        CERTIFICATE_REPOSITORY,
      ],
      useFactory: (
        courses: CourseRepositoryPort,
        requests: CertificateRequestRepositoryPort,
        certificates: CertificateRepositoryPort,
      ) => new RequestCertificateUseCase(courses, requests, certificates),
    },
    {
      provide: ListMyCertificateRequestsUseCase,
      inject: [CERTIFICATE_REQUEST_REPOSITORY],
      useFactory: (requests: CertificateRequestRepositoryPort) =>
        new ListMyCertificateRequestsUseCase(requests),
    },
    {
      provide: ListCertificateRequestsUseCase,
      inject: [CERTIFICATE_REQUEST_REPOSITORY],
      useFactory: (requests: CertificateRequestRepositoryPort) =>
        new ListCertificateRequestsUseCase(requests),
    },
    {
      provide: IssueCertificateUseCase,
      inject: [
        UNIT_OF_WORK,
        USER_REPOSITORY,
        COURSE_REPOSITORY,
        CERTIFICATE_RENDERER,
        CERTIFICATE_STORAGE,
        RANDOM,
        CLOCK,
        CERTIFICATE_SETTINGS,
      ],
      useFactory: (
        unitOfWork: UnitOfWorkPort,
        users: UserRepositoryPort,
        courses: CourseRepositoryPort,
        renderer: CertificateRendererPort,
        storage: CertificateStoragePort,
        random: RandomPort,
        clock: ClockPort,
        settings: CertificateSettings,
      ) =>
        new IssueCertificateUseCase(
          unitOfWork,
          users,
          courses,
          renderer,
          storage,
          random,
          clock,
          settings,
        ),
    },
    {
      provide: ApproveCertificateRequestUseCase,
      inject: [CERTIFICATE_REQUEST_REPOSITORY, IssueCertificateUseCase],
      useFactory: (
        requests: CertificateRequestRepositoryPort,
        issue: IssueCertificateUseCase,
      ) => new ApproveCertificateRequestUseCase(requests, issue),
    },
    {
      provide: RejectCertificateRequestUseCase,
      inject: [CERTIFICATE_REQUEST_REPOSITORY, CLOCK],
      useFactory: (
        requests: CertificateRequestRepositoryPort,
        clock: ClockPort,
      ) => new RejectCertificateRequestUseCase(requests, clock),
    },

    // ---------- Certificados ----------
    {
      provide: ListMyCertificatesUseCase,
      inject: [CERTIFICATE_REPOSITORY],
      useFactory: (certificates: CertificateRepositoryPort) =>
        new ListMyCertificatesUseCase(certificates),
    },
    {
      provide: GetCertificateFileUseCase,
      inject: [CERTIFICATE_REPOSITORY, CERTIFICATE_STORAGE],
      useFactory: (
        certificates: CertificateRepositoryPort,
        storage: CertificateStoragePort,
      ) => new GetCertificateFileUseCase(certificates, storage),
    },
    {
      provide: ListCertificatesUseCase,
      inject: [CERTIFICATE_REPOSITORY],
      useFactory: (certificates: CertificateRepositoryPort) =>
        new ListCertificatesUseCase(certificates),
    },
    {
      provide: GetCertificateDetailUseCase,
      inject: [CERTIFICATE_REPOSITORY],
      useFactory: (certificates: CertificateRepositoryPort) =>
        new GetCertificateDetailUseCase(certificates),
    },
    {
      provide: RevokeCertificateUseCase,
      inject: [CERTIFICATE_REPOSITORY, CLOCK],
      useFactory: (certificates: CertificateRepositoryPort, clock: ClockPort) =>
        new RevokeCertificateUseCase(certificates, clock),
    },
    {
      provide: VerifyCertificateUseCase,
      inject: [CERTIFICATE_REPOSITORY],
      useFactory: (certificates: CertificateRepositoryPort) =>
        new VerifyCertificateUseCase(certificates),
    },
    {
      provide: CheckCertificateFileUseCase,
      inject: [CERTIFICATE_REPOSITORY],
      useFactory: (certificates: CertificateRepositoryPort) =>
        new CheckCertificateFileUseCase(certificates),
    },
  ],
})
export class CertificateModule {}
