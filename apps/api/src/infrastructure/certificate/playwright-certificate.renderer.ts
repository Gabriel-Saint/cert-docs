import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type Browser, chromium } from 'playwright';
import type {
  CertificateRendererPort,
  CertificateRenderInput,
} from '../../domain/ports';
import { buildCertificateHtml } from './template/certificate.template';
import { loadFontFaces } from './template/fonts';
import { PAGE_HEIGHT_MM, PAGE_WIDTH_MM } from './template/palette';
import { qrCodeSvg } from './template/qr-code';

const RENDER_TIMEOUT_MS = 20_000;

/**
 * Gera o PDF imprimindo o template HTML num Chromium sem interface.
 * É o mesmo motor do "Salvar como PDF" do navegador: texto e SVG saem como vetor.
 */
@Injectable()
export class PlaywrightCertificateRenderer
  implements CertificateRendererPort, OnModuleDestroy
{
  private readonly logger = new Logger(PlaywrightCertificateRenderer.name);
  private browser?: Promise<Browser>;

  async render(input: CertificateRenderInput): Promise<Buffer> {
    const html = buildCertificateHtml(input, {
      fontFaces: loadFontFaces(),
      qrSvg: await qrCodeSvg(input.verificationUrl),
    });
    return withTimeout(this.print(html), RENDER_TIMEOUT_MS);
  }

  async onModuleDestroy(): Promise<void> {
    const browser = await this.browser?.catch(() => undefined);
    await browser?.close();
  }

  private async print(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    // Contexto offline e todas as requisições abortadas: o template só usa conteúdo embutido
    const context = await browser.newContext({ offline: true });
    try {
      const page = await context.newPage();
      await page.route('**/*', (route) => route.abort());
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: RENDER_TIMEOUT_MS,
      });
      await page.waitForFunction(
        'document.body.dataset.ready === "1"',
        undefined,
        {
          timeout: RENDER_TIMEOUT_MS,
        },
      );
      return await page.pdf({
        width: `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
    } finally {
      await context.close();
    }
  }

  /** Uma instância do navegador para todas as renderizações; abrir um Chromium por PDF seria lento. */
  private getBrowser(): Promise<Browser> {
    this.browser ??= chromium
      .launch({
        args: ['--disable-dev-shm-usage', '--font-render-hinting=none'],
      })
      .then((browser) => {
        this.logger.log('Chromium iniciado para renderização de certificados');
        browser.on('disconnected', () => (this.browser = undefined));
        return browser;
      })
      .catch((error: unknown) => {
        this.browser = undefined;
        throw error;
      });
    return this.browser;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Renderização excedeu ${ms / 1000} s`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
