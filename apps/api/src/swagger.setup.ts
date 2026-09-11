import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Nome do esquema de segurança referenciado por @ApiBearerAuth nas rotas protegidas. */
export const SWAGGER_BEARER_AUTH = 'jwt';

/** Caminho da interface do Swagger. O JSON da especificação fica em `${SWAGGER_PATH}-json`. */
export const SWAGGER_PATH = 'api/docs';

const DESCRIPTION = `
API para distribuição de materiais em PDF com o **CPF e o nome do usuário carimbados em todas as páginas**.

### Como testar por aqui
1. Faça login em **POST /api/auth/login** (ADMIN do seed: \`admin@example.com\` / \`admin12345\`).
2. Copie o \`accessToken\` da resposta.
3. Clique em **Authorize** e cole o token.
4. Chame as rotas protegidas — em **GET /api/documents/{id}/pdf** aparece o link para baixar o arquivo.

### Erros de negócio
Seguem o formato \`{ statusCode, code, message }\`, onde \`code\` identifica o erro (ex.: \`EMAIL_OR_CPF_IN_USE\`).
Erros de validação do body retornam \`message\` como lista de campos inválidos.
`;

/** Precisa ser chamado depois do setGlobalPrefix, para as rotas saírem com o prefixo /api. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('CPF PDF Watermark API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Cole o accessToken retornado por POST /api/auth/login',
      },
      SWAGGER_BEARER_AUTH,
    )
    .addTag('auth', 'Cadastro e login')
    .addTag(
      'documents',
      'Catálogo de documentos e download do PDF personalizado',
    )
    .addTag('users', 'Usuários cadastrados (somente ADMIN)')
    .addTag('courses', 'Cursos e conteúdo programático')
    .addTag(
      'certificate-requests',
      'Pedidos de certificado: solicitação, aprovação e recusa',
    )
    .addTag(
      'certificates',
      'Certificados emitidos, download, histórico e revogação',
    )
    .addTag('public', 'Verificação pública de certificados (sem login)')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: 'CPF PDF API — Documentação',
    swaggerOptions: {
      // Mantém o token após recarregar a página
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
