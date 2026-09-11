import fc from 'fast-check';
import { DocumentNotFoundError } from '../../../domain/errors';
import {
  InMemoryDocumentRepository,
  makeDocument,
} from '../../../testing/in-memory';
import { CreateDocumentUseCase } from './create-document.use-case';
import { DeleteDocumentUseCase } from './delete-document.use-case';
import { GetDocumentUseCase } from './get-document.use-case';
import { ListDocumentsUseCase } from './list-documents.use-case';
import { UpdateDocumentUseCase } from './update-document.use-case';

describe('Casos de uso de documentos', () => {
  let repo: InMemoryDocumentRepository;

  beforeEach(() => {
    repo = new InMemoryDocumentRepository();
  });

  describe('ListDocumentsUseCase', () => {
    // Property 8: Listagem de documentos retorna somente registros ativos
    it('retorna exatamente os documentos ativos, para qualquer combinação', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { maxLength: 20 }),
          async (flags) => {
            const repository = new InMemoryDocumentRepository();
            repository.documents = flags.map((isActive, i) =>
              makeDocument({ id: `d${i}`, isActive }),
            );

            const result = await new ListDocumentsUseCase(repository).execute();

            expect(result.every((d) => d.isActive)).toBe(true);
            expect(result).toHaveLength(flags.filter(Boolean).length);
          },
        ),
      );
    });
  });

  describe('CreateDocumentUseCase', () => {
    it('cria documento ativo com descrição nula quando omitida', async () => {
      const created = await new CreateDocumentUseCase(repo).execute({
        title: 'Nova apostila',
        content: 'Texto',
      });

      expect(created.isActive).toBe(true);
      expect(created.description).toBeNull();
    });
  });

  describe('GetDocumentUseCase', () => {
    it('lança DocumentNotFoundError para inexistente ou inativo', async () => {
      repo.documents = [makeDocument({ id: 'inativo', isActive: false })];
      const sut = new GetDocumentUseCase(repo);

      await expect(sut.execute('nao-existe')).rejects.toThrow(
        DocumentNotFoundError,
      );
      await expect(sut.execute('inativo')).rejects.toThrow(
        DocumentNotFoundError,
      );
    });
  });

  describe('UpdateDocumentUseCase', () => {
    it('altera só os campos enviados', async () => {
      repo.documents = [
        makeDocument({ id: 'd1', title: 'Antigo', content: 'Mantido' }),
      ];

      const updated = await new UpdateDocumentUseCase(repo).execute('d1', {
        title: 'Novo',
      });

      expect(updated.title).toBe('Novo');
      expect(updated.content).toBe('Mantido');
    });

    it('lança DocumentNotFoundError para id inexistente', async () => {
      await expect(
        new UpdateDocumentUseCase(repo).execute('nao-existe', { title: 'x' }),
      ).rejects.toThrow(DocumentNotFoundError);
    });
  });

  describe('DeleteDocumentUseCase', () => {
    it('faz soft delete e falha na segunda tentativa', async () => {
      repo.documents = [makeDocument({ id: 'd1' })];
      const sut = new DeleteDocumentUseCase(repo);

      await sut.execute('d1');

      expect(repo.documents[0].isActive).toBe(false);
      await expect(sut.execute('d1')).rejects.toThrow(DocumentNotFoundError);
    });
  });
});
