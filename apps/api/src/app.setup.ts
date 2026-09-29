import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE_NAME } from './infrastructure/security/session-cookie';

export const GLOBAL_PREFIX = 'api';

/** Configuração compartilhada entre o main.ts e os testes e2e. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  const frontendOrigin = new URL(
    process.env['PUBLIC_WEB_URL'] ?? 'http://localhost:4200',
  ).origin;
  app.enableCors({ origin: frontendOrigin, credentials: true });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isStateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(
      request.method,
    );
    const hasSessionCookie = request.headers.cookie
      ?.split(';')
      .some((part) => part.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
    const usesBearerToken = request.headers.authorization?.startsWith(
      'Bearer ',
    );
    const routeDoesNotUseSessionCookie =
      [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/session/login',
      ].includes(request.path) || request.path.startsWith('/api/public/');

    if (
      isStateChanging &&
      hasSessionCookie &&
      !usesBearerToken &&
      !routeDoesNotUseSessionCookie &&
      request.headers.origin !== frontendOrigin
    ) {
      response.status(403).json({
        statusCode: 403,
        message: 'Origem não autorizada para sessão web',
      });
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
