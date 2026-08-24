FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV npm_config_update_notifier=false

COPY package*.json ./

FROM base AS development

ENV NODE_ENV=development

RUN apt-get update \
  && apt-get install -y --no-install-recommends default-mysql-client \
  && rm -rf /var/lib/apt/lists/*

RUN npm ci

COPY . .

RUN mkdir -p uploads

EXPOSE 4000

CMD ["npm","run","dev"]



FROM base AS production

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*

RUN npm ci --omit=dev \
 && npm cache clean --force

COPY --chown=node:node . .

RUN mkdir -p uploads \
 && chown -R node:node /app

USER node

EXPOSE 4000

ENTRYPOINT ["dumb-init","--"]

CMD ["npm","start"]
