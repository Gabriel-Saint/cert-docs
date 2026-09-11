import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureApp, GLOBAL_PREFIX } from './app.setup';
import { AppModule } from './modules/app.module';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  Logger.log(
    `API rodando em http://localhost:${port}/${GLOBAL_PREFIX}`,
    'Bootstrap',
  );
}

void bootstrap();
