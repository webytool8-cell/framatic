# Framatic video renderer for Google Cloud Run Jobs.
# Build context is the repository root:
#   docker build -f renderer/Dockerfile .
FROM node:22-bookworm-slim

# Libraries Chrome Headless Shell needs (per Remotion's Linux docs) + fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
      libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
      fonts-noto-color-emoji fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
RUN npx remotion browser ensure

COPY tsconfig.json remotion.config.ts ./
COPY src/video ./src/video
COPY src/lib/creative/scene-plan.ts ./src/lib/creative/scene-plan.ts
COPY renderer ./renderer
RUN npx remotion bundle src/video/remotion/index.ts --out-dir=/app/bundle

ENV NODE_ENV=production BUNDLE_DIR=/app/bundle
CMD ["node", "renderer/job.mjs"]
