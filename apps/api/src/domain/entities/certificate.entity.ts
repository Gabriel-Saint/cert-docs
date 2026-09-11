import type { CertificateSnapshot, CertificateStatus } from '@cpf-pdf/shared';

export interface CertificateEntity {
  id: string;
  requestId: string;
  userId: string;
  courseId: string;
  /** Código de verificação sem prefixo nem hífens (12 caracteres). */
  code: string;
  registryYear: number;
  registrySequence: number;
  status: CertificateStatus;
  /** Dados congelados na emissão: nunca mudam depois. */
  snapshot: CertificateSnapshot;
  /** SHA-256 do JSON canônico de { snapshot, code, registry }. Impresso no verso. */
  dataHash: string;
  /** SHA-256 dos bytes do PDF emitido. Usado na conferência de arquivo. */
  fileHash: string;
  fileKey: string;
  issuedById: string;
  issuedAt: Date;
  revokedById: string | null;
  revokedAt: Date | null;
  revocationReason: string | null;
}

/** Certificado com os nomes de quem emitiu e revogou, para o histórico do ADMIN. */
export interface CertificateRecord extends CertificateEntity {
  issuedByName: string;
  revokedByName: string | null;
}
