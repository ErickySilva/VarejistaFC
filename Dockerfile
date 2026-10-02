# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Desenvolvimento: código montado por volume (ver compose.yaml, perfil "app").
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# Operação: migrações, seed e criação do primeiro admin em produção. Tem as
# dependências de desenvolvimento (drizzle-kit, tsx) e o código-fonte, por isso
# fica fora da imagem final. Roda só sob demanda, e nunca como serviço (ver
# compose.production.yaml, perfil "tools").
FROM deps AS tools
COPY --chown=node:node . .
USER node
CMD ["npm", "run", "db:migrate"]

FROM deps AS builder
COPY . .
RUN npm run build

# Produção: apenas a saída standalone do Next.js.
FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
