# Build a partir da RAIZ do monorepo:
#   docker build -f apps/api/Dockerfile -t cpf-pdf-api .

# Mesma versão do npm usada para gerar o package-lock.json (campo "packageManager" do package.json).
# A imagem node:22 vem com npm 10, que interpreta o lockfile do npm 11 de outro jeito e recusa o "npm ci".
ARG NPM_VERSION=11.12.1

# ---------- Stage 1: build ----------
FROM node:22-alpine AS builder
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}
WORKDIR /repo
ENV NX_DAEMON=false \
    NX_NO_CLOUD=true

# Manifests primeiro: aproveita o cache do Docker enquanto as dependências não mudam
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY libs/shared/package.json libs/shared/package.json
RUN npm ci

COPY . .

# prune = prisma generate + build (webpack) + package.json/lockfile enxutos só com as deps da api.
# O prisma.config.ts exige DATABASE_URL até para gerar o client; no build uma URL fictícia basta.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    npx nx run api:prune --configuration=production

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runner
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/apps/api/dist ./
# "install" em vez de "ci": o lockfile enxuto gerado pelo Nx pode ficar incompleto
# para dependências aninhadas de workspaces; o install parte dele e completa o que faltar.
RUN npm install --omit=dev --no-audit --no-fund \
 # CLI do Prisma e dotenv: necessários só para rodar "migrate deploy" com o prisma.config.ts
 && npm install --no-save prisma@7.10.0 dotenv@17.4.2 \
 && npm cache clean --force

COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/prisma.config.ts ./prisma.config.ts

USER node
EXPOSE 3000

# Aplica as migrations pendentes e só então sobe a API
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --config prisma.config.ts && node main.js"]
