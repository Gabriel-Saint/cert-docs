import type {
  CertificateRequestStatus,
  CertificateStatus,
  Role,
} from '@cert-docs/shared';

export const REQUEST_STATUS_LABEL: Record<CertificateRequestStatus, string> = {
  PENDING: 'Em análise',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
};

export const CERTIFICATE_STATUS_LABEL: Record<CertificateStatus, string> = {
  VALID: 'Válido',
  REVOKED: 'Revogado',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  USER: 'Aluno',
};

/** Data de hoje no fuso de Brasília, no formato AAAA-MM-DD (valor de <input type="date">). */
export function todayIsoDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(now);
}
