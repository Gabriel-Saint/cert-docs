export const CertificateRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type CertificateRequestStatus =
  (typeof CertificateRequestStatus)[keyof typeof CertificateRequestStatus];

export const CertificateStatus = {
  VALID: 'VALID',
  REVOKED: 'REVOKED',
} as const;

export type CertificateStatus =
  (typeof CertificateStatus)[keyof typeof CertificateStatus];

/** Dados congelados no momento da emissão. */
export interface CertificateSnapshot {
  holder: { name: string; cpf: string };
  course: {
    title: string;
    coordinator: string;
    workloadHours: number;
    modules: { title: string; hours: number }[];
  };
  /** Datas no formato YYYY-MM-DD. */
  period: { startDate: string | null; completionDate: string };
  institution: {
    name: string;
    city: string;
    director: string;
    directorRole: string;
  };
  /** Data e hora ISO 8601 (UTC). */
  issuedAt: string;
}

export interface CreateCertificateRequestBody {
  courseId: string;
}

export interface ApproveCertificateRequestBody {
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  completionDate: string;
}

export interface ReasonBody {
  reason: string;
}

export interface MyCertificateRequestView {
  id: string;
  course: { id: string; title: string };
  status: CertificateRequestStatus;
  requestedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface CertificateRequestView extends MyCertificateRequestView {
  /** CPF mascarado. */
  student: { id: string; name: string; email: string; cpf: string };
}

export interface MyCertificateView {
  id: string;
  code: string;
  course: { id: string; title: string };
  status: CertificateStatus;
  issuedAt: string;
  verificationUrl: string;
}

export interface CertificateHistoryItem {
  id: string;
  code: string;
  registry: string;
  status: CertificateStatus;
  issuedAt: string;
  /** CPF mascarado. */
  student: { name: string; cpf: string };
  course: { id: string; title: string };
  issuedBy: { id: string; name: string };
}

export interface CertificateDetailView extends CertificateHistoryItem {
  registryBook: number;
  registrySheet: number;
  /** Snapshot com o CPF mascarado. */
  snapshot: CertificateSnapshot;
  dataHash: string;
  fileHash: string;
  verificationUrl: string;
  revocation: {
    revokedAt: string;
    reason: string;
    revokedBy: { id: string; name: string };
  } | null;
}

export interface CertificateHistoryQuery {
  status?: CertificateStatus;
  courseId?: string;
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
  /** Nome do aluno ou código de verificação. */
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicCertificateVerification {
  code: string;
  status: CertificateStatus;
  holderName: string;
  /** CPF mascarado. */
  holderCpf: string;
  courseTitle: string;
  workloadHours: number;
  period: { startDate: string | null; completionDate: string };
  issuedAt: string;
  registry: string;
  dataHash: string;
  revocation: { revokedAt: string; reason: string } | null;
}

export interface FileCheckResult {
  matches: boolean;
}
