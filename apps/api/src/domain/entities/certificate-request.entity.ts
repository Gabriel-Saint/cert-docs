import type { CertificateRequestStatus } from '@cert-docs/shared';

export interface CertificateRequestEntity {
  id: string;
  userId: string;
  courseId: string;
  status: CertificateRequestStatus;
  rejectionReason: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}
