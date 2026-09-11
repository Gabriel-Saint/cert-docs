import { DOCUMENT } from '@angular/common';
import type { HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

/**
 * Lê o nome do arquivo do cabeçalho Content-Disposition.
 * Aceita `filename*=UTF-8''...` (RFC 5987, com acentos) e `filename="..."`.
 */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return sanitize(decodeURIComponent(encoded[1].trim()));
    } catch {
      // cai para o filename simples
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
  const name = plain?.[1] ?? plain?.[2];
  return name ? sanitize(name.trim()) : null;
}

/** Remove caminhos e caracteres proibidos em nomes de arquivo. */
function sanitize(name: string): string | null {
  const clean = name.replace(/[/\\:*?"<>|]/g, '_').trim();
  return clean || null;
}

/** Salva um arquivo recebido da API no computador do usuário. */
@Injectable({ providedIn: 'root' })
export class FileSaver {
  private readonly document = inject(DOCUMENT);

  /** Usa o nome enviado pela API; `fallbackName` só se o cabeçalho não vier. */
  saveResponse(response: HttpResponse<Blob>, fallbackName: string): string {
    if (!response.body) throw new Error('A API respondeu sem arquivo');
    const fileName =
      fileNameFromDisposition(response.headers.get('Content-Disposition')) ??
      fallbackName;
    this.save(response.body, fileName);
    return fileName;
  }

  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    // Alguns navegadores ainda leem a URL logo após o clique
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
