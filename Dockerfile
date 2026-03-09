FROM --platform=linux/arm64 node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/ping || exit 1

CMD ["node", "dist/server.js"]
