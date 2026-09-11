import {
  DocumentNotFoundError,
  DownloadLogPersistenceError,
  PdfGenerationError,
  UserNotFoundError,
} from '../../../domain/errors';
import {
  FakePdfGenerator,
  InMemoryDocumentRepository,
  InMemoryDownloadLogRepository,
  InMemoryUserRepository,
  makeDocument,
  makeUser,
} from '../../../testing/in-memory';
import { GeneratePersonalizedPdfUseCase } from './generate-personalized-pdf.use-case';

describe('GeneratePersonalizedPdfUseCase', () => {
  const makeSut = () => {
    const documents = new InMemoryDocumentRepository();
    const users = new InMemoryUserRepository();
    const logs = new InMemoryDownloadLogRepository();
    const pdf = new FakePdfGenerator();

    documents.documents = [
      makeDocument({ id: 'd1', title: 'Apostila' }),
      makeDocument({ id: 'inativo', isActive: false }),
    ];
    users.users.push(
      makeUser({
        id: 'u1',
        name: 'João',
        cpf: '52998224725',
        email: 'joao@example.com',
      }),
      makeUser({
        id: 'u2',
        name: 'Maria',
        cpf: '11144477735',
        email: 'maria@example.com',
      }),
    );

    const sut = new GeneratePersonalizedPdfUseCase(documents, users, logs, pdf);
    return { sut, logs, pdf };
  };

  it('gera o PDF com o CPF formatado do usuário que pediu e nome de arquivo com CPF parcial', async () => {
    const { sut, pdf } = makeSut();

    const result = await sut.execute({ documentId: 'd1', userId: 'u2' });

    expect(pdf.calls).toEqual([
      {
        title: 'Apostila',
        content: 'Conteúdo da apostila',
        userCpf: '111.444.777-35',
        userName: 'Maria',
      },
    ]);
    expect(result.fileName).toBe('documento-d1-111-35.pdf');
  });

  // Property 6: Download Log criado exatamente uma vez por geração bem-sucedida
  it('grava exatamente um log por download concluído', async () => {
    const { sut, logs } = makeSut();

    await sut.execute({
      documentId: 'd1',
      userId: 'u1',
      ipAddress: '127.0.0.1',
    });
    await sut.execute({ documentId: 'd1', userId: 'u2' });

    expect(logs.logs).toEqual([
      { documentId: 'd1', userId: 'u1', ipAddress: '127.0.0.1' },
      { documentId: 'd1', userId: 'u2', ipAddress: undefined },
    ]);
  });

  it('não grava log quando a geração do PDF falha', async () => {
    const { sut, logs, pdf } = makeSut();
    pdf.failNextGeneration = true;

    await expect(
      sut.execute({ documentId: 'd1', userId: 'u1' }),
    ).rejects.toThrow(PdfGenerationError);
    expect(logs.logs).toHaveLength(0);
  });

  it('não devolve o PDF quando o log falha', async () => {
    const { sut, logs } = makeSut();
    logs.failNextSave = true;

    await expect(
      sut.execute({ documentId: 'd1', userId: 'u1' }),
    ).rejects.toThrow(DownloadLogPersistenceError);
  });

  it.each([
    ['documento inexistente', 'nao-existe', 'u1', DocumentNotFoundError],
    ['documento inativo', 'inativo', 'u1', DocumentNotFoundError],
    ['usuário inexistente', 'd1', 'nao-existe', UserNotFoundError],
  ])('falha com %s sem gerar PDF', async (_, documentId, userId, errorType) => {
    const { sut, pdf, logs } = makeSut();

    await expect(sut.execute({ documentId, userId })).rejects.toThrow(
      errorType,
    );
    expect(pdf.calls).toHaveLength(0);
    expect(logs.logs).toHaveLength(0);
  });
});
