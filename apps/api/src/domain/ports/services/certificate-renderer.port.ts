import type { CertificateSnapshot } from '@cpf-pdf/shared';

export interface CertificateRenderInput {
  snapshot: CertificateSnapshot;
  /** CERT-7K3F-9QX2-M8PD */
  code: string;
  registry: { number: string; book: number; sheet: number };
  dataHash: string;
  verificationUrl: string;
}

export interface CertificateRendererPort {
  /** PDF A4 paisagem com frente e verso. */
  render(input: CertificateRenderInput): Promise<Buffer>;
}
