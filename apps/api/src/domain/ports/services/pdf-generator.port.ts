export interface PdfGenerationOptions {
  title: string;
  content: string;
  /** CPF já formatado: 529.982.247-25 */
  userCpf: string;
  userName: string;
}

export interface PdfGeneratorPort {
  generate(options: PdfGenerationOptions): Promise<Buffer>;
}
