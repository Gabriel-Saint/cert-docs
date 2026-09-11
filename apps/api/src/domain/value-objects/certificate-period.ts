import { InvalidCertificatePeriodError } from '../errors';
import { isValidIsoDate } from '../services/calendar';

/** Período do curso impresso no certificado. Datas no formato YYYY-MM-DD. */
export class CertificatePeriod {
  private constructor(
    readonly startDate: string | null,
    readonly completionDate: string,
  ) {}

  /** @param today data de hoje (YYYY-MM-DD) no fuso do certificado */
  static create(
    startDate: string | null | undefined,
    completionDate: string,
    today: string,
  ): CertificatePeriod {
    const start = startDate ?? null;

    if (!isValidIsoDate(completionDate) || (start && !isValidIsoDate(start))) {
      throw new InvalidCertificatePeriodError(
        'As datas devem ser válidas e estar no formato AAAA-MM-DD',
      );
    }
    // Datas ISO podem ser comparadas como texto
    if (completionDate > today) {
      throw new InvalidCertificatePeriodError(
        'A data de conclusão não pode ser futura',
      );
    }
    if (start && start > completionDate) {
      throw new InvalidCertificatePeriodError(
        'A data de início não pode ser posterior à data de conclusão',
      );
    }
    return new CertificatePeriod(start, completionDate);
  }
}
