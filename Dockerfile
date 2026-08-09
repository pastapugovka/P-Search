# =====================================================
# Стадия сборки: Bun устанавливает зависимости и tsc компилирует TypeScript
# =====================================================
FROM oven/bun:1-alpine AS build
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY . .
RUN bun run build
RUN bun install --production --frozen-lockfile || bun install --production

# =====================================================
# Стадия запуска: минимальный образ с готовым JavaScript
# =====================================================
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data

EXPOSE 3000
CMD ["node", "dist/index.js"]