import type { CertificateSnapshot } from '@cert-docs/shared';
import type { VerificationCode } from '../domain/value-objects/verification-code';

/** Configuração fixa usada na emissão (vem das variáveis de ambiente). */
export interface CertificateSettings {
  /** Endereço público do frontend, sem barra no final. */
  publicWebUrl: string;
  institution: CertificateSnapshot['institution'];
}

export function buildVerificationUrl(
  publicWebUrl: string,
  code: VerificationCode,
): string {
  return `${publicWebUrl.replace(/\/+$/, '')}/verificar/${code.formatted()}`;
}
