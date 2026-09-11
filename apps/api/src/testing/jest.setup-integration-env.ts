// Integração usa o banco real: carrega o .env da raiz do monorepo (DATABASE_URL do docker compose).
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../../.env') });
