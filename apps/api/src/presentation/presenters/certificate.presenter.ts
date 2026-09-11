import {
  type CertificateDetailView,
  type CertificateHistoryItem,
  type CertificateRequestView,
  maskCpf,
  type MyCertificateRequestView,
  type MyCertificateView,
  type PublicCertificateVerification,
} from '@cpf-pdf/shared';
import { buildVerificationUrl } from '../../application/certificate-settings';
import type {
  CertificateEntity,
  CertificateRecord,
} from '../../domain/entities/certificate.entity';
import type { CertificateRequestEntity } from '../../domain/entities/certificate-request.entity';
import type { CertificateRequestListItem } from '../../domain/ports';
import { Registry } from '../../domain/value-objects/registry';
import { VerificationCode } from '../../domain/value-objects/verification-code';

export function toMyRequestView(
  request: CertificateRequestEntity,
  course: { id: string; title: string },
): MyCertificateRequestView {
  return {
    id: request.id,
    course,
    status: request.status,
    requestedAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    rejectionReason: request.rejectionReason,
  };
}

export function toRequestView(
  item: CertificateRequestListItem,
): CertificateRequestView {
  return {
    ...toMyRequestView(item.request, item.course),
    student: {
      id: item.student.id,
      name: item.student.name,
      email: item.student.email,
      cpf: item.student.cpf.masked(),
    },
  };
}

export function toMyCertificateView(
  certificate: CertificateEntity,
  publicWebUrl: string,
): MyCertificateView {
  const code = VerificationCode.parse(certificate.code);
  return {
    id: certificate.id,
    code: code.formatted(),
    course: {
      id: certificate.courseId,
      title: certificate.snapshot.course.title,
    },
    status: certificate.status,
    issuedAt: certificate.issuedAt.toISOString(),
    verificationUrl: buildVerificationUrl(publicWebUrl, code),
  };
}

export function toHistoryItem(
  certificate: CertificateRecord,
): CertificateHistoryItem {
  const { snapshot } = certificate;
  return {
    id: certificate.id,
    code: VerificationCode.parse(certificate.code).formatted(),
    registry: registryOf(certificate).formatted(),
    status: certificate.status,
    issuedAt: certificate.issuedAt.toISOString(),
    student: { name: snapshot.holder.name, cpf: maskCpf(snapshot.holder.cpf) },
    course: { id: certificate.courseId, title: snapshot.course.title },
    issuedBy: { id: certificate.issuedById, name: certificate.issuedByName },
  };
}

export function toDetailView(
  certificate: CertificateRecord,
  publicWebUrl: string,
): CertificateDetailView {
  const registry = registryOf(certificate);
  return {
    ...toHistoryItem(certificate),
    registryBook: registry.book,
    registrySheet: registry.sheet,
    snapshot: {
      ...certificate.snapshot,
      holder: {
        ...certificate.snapshot.holder,
        cpf: maskCpf(certificate.snapshot.holder.cpf),
      },
    },
    dataHash: certificate.dataHash,
    fileHash: certificate.fileHash,
    verificationUrl: buildVerificationUrl(
      publicWebUrl,
      VerificationCode.parse(certificate.code),
    ),
    revocation:
      certificate.revokedAt && certificate.revokedById
        ? {
            revokedAt: certificate.revokedAt.toISOString(),
            reason: certificate.revocationReason ?? '',
            revokedBy: {
              id: certificate.revokedById,
              name: certificate.revokedByName ?? '',
            },
          }
        : null,
  };
}

/**
 * Verificação pública: só o necessário para confirmar a autenticidade.
 * Nunca inclui CPF completo, email, ids internos, arquivo ou quem aprovou.
 */
export function toPublicVerification(
  certificate: CertificateEntity,
): PublicCertificateVerification {
  const { snapshot } = certificate;
  return {
    code: VerificationCode.parse(certificate.code).formatted(),
    status: certificate.status,
    holderName: snapshot.holder.name,
    holderCpf: maskCpf(snapshot.holder.cpf),
    courseTitle: snapshot.course.title,
    workloadHours: snapshot.course.workloadHours,
    period: { ...snapshot.period },
    issuedAt: certificate.issuedAt.toISOString(),
    registry: registryOf(certificate).formatted(),
    dataHash: certificate.dataHash,
    revocation: certificate.revokedAt
      ? {
          revokedAt: certificate.revokedAt.toISOString(),
          reason: certificate.revocationReason ?? '',
        }
      : null,
  };
}

function registryOf(certificate: CertificateEntity): Registry {
  return new Registry(certificate.registryYear, certificate.registrySequence);
}
