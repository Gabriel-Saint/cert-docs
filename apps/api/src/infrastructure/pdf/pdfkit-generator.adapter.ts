import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type {
  PdfGenerationOptions,
  PdfGeneratorPort,
} from '../../domain/ports';

const PAGE_MARGIN = 60;
const STAMP_SIDE_MARGIN = 50;
const HEADER_TEXT_Y = 20;
const HEADER_LINE_Y = 35;
const FOOTER_LINE_OFFSET = 35;
const FOOTER_TEXT_OFFSET = 25;
const STAMP_FONT_SIZE = 8;
const STAMP_COLOR = '#888888';
const LINE_COLOR = '#cccccc';

@Injectable()
export class PdfKitGeneratorAdapter implements PdfGeneratorPort {
  generate(options: PdfGenerationOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // A margem de 60 mantém o conteúdo longe das faixas de cabeçalho e rodapé
      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE_MARGIN,
        bufferPages: true,
        info: { Title: options.title },
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // 1) Conteúdo primeiro: o PDFKit quebra as páginas sozinho quando o texto não cabe
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#000000')
        .text(options.title, { align: 'center' });
      doc.moveDown(2);
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(options.content, { align: 'left', lineGap: 5 });

      // 2) Carimbo depois, em cada página já criada.
      // Carimbar no evento 'pageAdded' escreveria abaixo da margem inferior,
      // o que faz o PDFKit criar páginas extras e empurrar o conteúdo.
      const stamp = `CPF: ${options.userCpf} | ${options.userName}`;
      const { start, count } = doc.bufferedPageRange();

      for (let pageIndex = start; pageIndex < start + count; pageIndex++) {
        doc.switchToPage(pageIndex);
        this.stampPage(doc, stamp);
      }

      doc.end(); // end() já faz o flush das páginas bufferizadas
    });
  }

  private stampPage(doc: PDFKit.PDFDocument, stamp: string): void {
    const { width, height, margins } = doc.page;
    const originalBottomMargin = margins.bottom;
    const textWidth = width - STAMP_SIDE_MARGIN * 2;

    // Sem margem inferior durante o carimbo, o texto do rodapé não dispara página nova
    margins.bottom = 0;

    doc.font('Helvetica').fontSize(STAMP_FONT_SIZE).fillColor(STAMP_COLOR);
    doc.text(stamp, STAMP_SIDE_MARGIN, HEADER_TEXT_Y, {
      width: textWidth,
      align: 'center',
    });
    doc
      .moveTo(STAMP_SIDE_MARGIN, HEADER_LINE_Y)
      .lineTo(width - STAMP_SIDE_MARGIN, HEADER_LINE_Y)
      .strokeColor(LINE_COLOR)
      .stroke();
    doc
      .moveTo(STAMP_SIDE_MARGIN, height - FOOTER_LINE_OFFSET)
      .lineTo(width - STAMP_SIDE_MARGIN, height - FOOTER_LINE_OFFSET)
      .strokeColor(LINE_COLOR)
      .stroke();
    doc.text(stamp, STAMP_SIDE_MARGIN, height - FOOTER_TEXT_OFFSET, {
      width: textWidth,
      align: 'center',
    });

    margins.bottom = originalBottomMargin;
  }
}
