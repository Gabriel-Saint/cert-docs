import { type INestApplication, ValidationPipe } from '@nestjs/common';

export const GLOBAL_PREFIX = 'api';

/** Configuração compartilhada entre o main.ts e os testes e2e. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
