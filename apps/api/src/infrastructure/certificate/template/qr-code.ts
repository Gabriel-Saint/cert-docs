import QRCode from 'qrcode';
import { PALETTE } from './palette';

/** QR Code vetorial (SVG), com fundo transparente para assumir a cor do papel. */
export function qrCodeSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    color: { dark: `${PALETTE.navy}ff`, light: '#00000000' },
  });
}
