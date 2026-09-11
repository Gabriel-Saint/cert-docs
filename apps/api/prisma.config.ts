// Os caminhos abaixo são relativos a ESTE arquivo.
// Os comandos rodam pela raiz do monorepo (targets do Nx), então o dotenv lê o .env da raiz.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx apps/api/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
