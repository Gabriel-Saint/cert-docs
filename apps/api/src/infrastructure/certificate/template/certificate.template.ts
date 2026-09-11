import { formatCpf } from '@cert-docs/shared';
import type { CertificateRenderInput } from '../../../domain/ports';
import { CERTIFICATE_TIME_ZONE } from '../../../domain/services/calendar';
import { CERTIFICATE_STYLES } from './certificate.styles';
import { escapeHtml as e } from './escape-html';
import { emblemSvg, sealSvg } from './insignia';
import { frameSvg } from './ornaments';

/** Acima disso a tabela do verso usa espaçamento compacto. */
const DENSE_SYLLABUS_FROM = 9;

export interface CertificateAssets {
  fontFaces: string;
  qrSvg: string;
}

/**
 * Roda no navegador antes da impressão: espera as fontes, reduz o nome até caber
 * em uma linha (mínimo de 30% do tamanho original, suficiente para 100 caracteres)
 * e sinaliza que a página está pronta.
 */
const FIT_AND_READY_SCRIPT = `
(async () => {
  await document.fonts.ready;
  const name = document.querySelector('[data-fit]');
  if (name) {
    const limit = name.parentElement.clientWidth * 0.94;
    let size = parseFloat(getComputedStyle(name).fontSize);
    const min = size * 0.3;
    while (name.scrollWidth > limit && size > min) {
      size *= 0.98;
      name.style.fontSize = size + 'px';
    }
  }
  document.body.dataset.ready = '1';
})();
`;

export function buildCertificateHtml(
  input: CertificateRenderInput,
  assets: CertificateAssets,
): string {
  const { snapshot, registry } = input;
  const { holder, course, institution, period } = snapshot;
  const issuedAt = new Date(snapshot.issuedAt);
  const year = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CERTIFICATE_TIME_ZONE,
      year: 'numeric',
    }).format(issuedAt),
  );
  const verifyHost = `${new URL(input.verificationUrl).host}/verificar`;
  const registryLine = `Registro nº ${registry.number} · Livro ${String(registry.book).padStart(2, '0')} · Folha ${String(registry.sheet).padStart(3, '0')}`;

  const front = `
<section class="page">
  ${frameSvg({ watermark: true })}
  <div class="front-body">
    <div class="brand">
      ${emblemSvg(institution.name)}
      <div class="brand-name">${e(institution.name)}</div>
    </div>

    <div class="titles">
      <div class="title">CERTIFICADO</div>
      <div class="subtitle">de conclusão de curso</div>
    </div>

    <div class="lead">Certificamos que</div>

    <div class="name-wrap"><div class="name" data-fit>${e(holder.name)}</div></div>

    <p class="text">
      portador(a) do CPF <strong>${e(formatCpf(holder.cpf))}</strong>, concluiu com aproveitamento o curso livre de
      <strong>${e(course.title)}</strong>, com carga horária de <strong>${e(course.workloadHours)} horas</strong>,
      ${e(periodText(period.startDate, period.completionDate))}.
    </p>

    <div class="when">${e(institution.city)}, ${e(longDate(issuedAt))}.</div>

    <div class="sign-row">
      ${signature(institution.director, institution.directorRole)}
      <div class="seal">${sealSvg({ institutionName: institution.name, year })}</div>
      ${signature(course.coordinator, 'Coordenação do Curso')}
    </div>

    <div class="footer-row">
      <div class="registry">${e(registryLine)}</div>
      <div class="verify">
        <div>
          <div>Verifique a autenticidade em</div>
          <div>${e(verifyHost)}</div>
          <div class="code">${e(input.code)}</div>
        </div>
        <div class="qr">${assets.qrSvg}</div>
      </div>
    </div>
  </div>
</section>`;

  const modules = course.modules
    .map(
      (module) =>
        `<tr><td>${e(module.title)}</td><td>${e(module.hours)} h</td></tr>`,
    )
    .join('');

  const back = `
<section class="page">
  ${frameSvg({ watermark: false })}
  <div class="back-body">
    <div class="back-head">
      <h2>Conteúdo Programático</h2>
      <span>${e(course.title)} · ${e(holder.name)}</span>
    </div>

    <table class="syllabus${course.modules.length >= DENSE_SYLLABUS_FROM ? ' dense' : ''}">
      <thead><tr><th scope="col">Módulo</th><th scope="col">Carga horária</th></tr></thead>
      <tbody>${modules}</tbody>
      <tfoot><tr><td>Total</td><td>${e(course.workloadHours)} h</td></tr></tfoot>
    </table>

    <aside class="auth">
      <h3>Autenticidade</h3>
      <div class="qr">${assets.qrSvg}</div>
      <div class="code">${e(input.code)}</div>
      <dl>
        <dt>Emitido</dt><dd>${e(shortDateTime(issuedAt))} (Brasília)</dd>
        <dt>SHA-256</dt><dd class="hash">${e(input.dataHash.slice(0, 32))}<br>${e(input.dataHash.slice(32))}</dd>
      </dl>
      <p>Aponte a câmera para o QR Code ou digite o código em ${e(verifyHost)} para confirmar que este certificado é válido e não foi alterado.</p>
    </aside>

    <div class="back-foot">
      <span>${e(registryLine)}</span>
      <span>Curso livre · Emissão digital</span>
    </div>
  </div>
</section>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Certificado ${e(input.code)}</title>
<style>${assets.fontFaces}${CERTIFICATE_STYLES}</style>
</head>
<body>
${front}
${back}
<script>${FIT_AND_READY_SCRIPT}</script>
</body>
</html>`;
}

function signature(fullName: string, role: string): string {
  // A "assinatura" manuscrita usa o nome sem títulos como Dra. e Prof.
  const signedName = fullName.replace(
    /^(prof|profa|dr|dra|me|ma|sr|sra)\.?\s+/i,
    '',
  );
  return `
      <div class="signature">
        <div class="ink">${e(signedName)}</div>
        <div class="rule"></div>
        <div class="who">${e(fullName)}</div>
        <div class="role">${e(role)}</div>
      </div>`;
}

/** YYYY-MM-DD → "12 de setembro de 2026" */
export function longIsoDate(isoDate: string, withYear = true): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function longDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: CERTIFICATE_TIME_ZONE,
  }).format(date);
}

function shortDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: CERTIFICATE_TIME_ZONE,
  })
    .format(date)
    .replace(',', '');
}

/** "realizado de 4 de agosto a 12 de setembro de 2026" ou "concluído em 12 de setembro de 2026" */
export function periodText(
  startDate: string | null,
  completionDate: string,
): string {
  if (!startDate) return `concluído em ${longIsoDate(completionDate)}`;
  const sameYear = startDate.slice(0, 4) === completionDate.slice(0, 4);
  return `realizado de ${longIsoDate(startDate, !sameYear)} a ${longIsoDate(completionDate)}`;
}
