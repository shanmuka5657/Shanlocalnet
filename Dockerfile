FROM node:22-bookworm-slim AS base

# Install FFmpeg and ca-certificates for background video transcoding & RDS TLS
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Run as non-root user in production
USER node
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
