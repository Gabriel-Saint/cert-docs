import {
  CertificateRequestStatus,
  CertificateStatus,
  type MyCertificateRequestView,
  type MyCertificateView,
} from '@cert-docs/shared';

/** O que o aluno pode fazer com o certificado de um curso. */
export type CourseCertificateState =
  | { kind: 'available'; lastRejection: MyCertificateRequestView | null }
  | { kind: 'pending'; request: MyCertificateRequestView }
  | { kind: 'issued'; certificate: MyCertificateView };

/**
 * Mesma regra da API: certificado válido > pedido em análise > pode solicitar.
 * Um pedido recusado ou certificado revogado volta a permitir solicitação.
 */
export function certificateStateFor(
  courseId: string,
  requests: readonly MyCertificateRequestView[],
  certificates: readonly MyCertificateView[],
): CourseCertificateState {
  const valid = certificates.find(
    (c) => c.course.id === courseId && c.status === CertificateStatus.VALID,
  );
  if (valid) return { kind: 'issued', certificate: valid };

  const forCourse = requests.filter((r) => r.course.id === courseId);
  const pending = forCourse.find(
    (r) => r.status === CertificateRequestStatus.PENDING,
  );
  if (pending) return { kind: 'pending', request: pending };

  // A API devolve os pedidos do mais recente para o mais antigo
  const latest = forCourse[0];
  return {
    kind: 'available',
    lastRejection:
      latest?.status === CertificateRequestStatus.REJECTED ? latest : null,
  };
}
