# Build a partir da RAIZ do monorepo:
#   docker build -f apps/api/Dockerfile -t cert-docs-api .

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
# Debian slim (e não Alpine): o Chromium do Playwright, usado para gerar os certificados, não roda em Alpine
FROM node:22-bookworm-slim AS runner
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}
WORKDIR /app
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CERTIFICATES_STORAGE_DIR=/data/certificates

COPY --from=builder /repo/apps/api/dist ./
# "install" em vez de "ci": o lockfile enxuto gerado pelo Nx pode ficar incompleto
# para dependências aninhadas de workspaces; o install parte dele e completa o que faltar.
RUN npm install --omit=dev --no-audit --no-fund \
 # CLI do Prisma e dotenv: necessários só para rodar "migrate deploy" com o prisma.config.ts
 && npm install --no-save prisma@7.10.0 dotenv@17.4.2 \
 # Só o "headless shell" do Chromium, com as bibliotecas de sistema que ele precisa
 && npx playwright install --with-deps --only-shell chromium \
 && npm cache clean --force \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/prisma.config.ts ./prisma.config.ts

# O CLI do Prisma baixa o motor de migração da plataforma na primeira execução.
# Rodar aqui, ainda como root, evita que o "migrate deploy" tente gravar em node_modules como usuário node.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/* \
 && DATABASE_URL=postgresql://build:build@localhost:5432/build \
    ./node_modules/.bin/prisma version --config prisma.config.ts

# Pasta dos PDFs emitidos: montada como volume no docker compose
RUN mkdir -p /data/certificates && chown -R node:node /data/certificates

USER node
EXPOSE 3000

# Aplica as migrations pendentes e só então sobe a API
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --config prisma.config.ts && node main.js"]
