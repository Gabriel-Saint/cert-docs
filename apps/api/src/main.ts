import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureApp, GLOBAL_PREFIX } from './app.setup';
import { AppModule } from './modules/app.module';
import { setupSwagger, SWAGGER_PATH } from './swagger.setup';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  setupSwagger(app);
  app.enableShutdownHooks();

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  Logger.log(
    `API rodando em http://localhost:${port}/${GLOBAL_PREFIX}`,
    'Bootstrap',
  );
  Logger.log(
    `Documentação em http://localhost:${port}/${SWAGGER_PATH}`,
    'Bootstrap',
  );
}

void bootstrap();
