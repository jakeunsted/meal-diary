FROM node:26.3.0-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY api/package.json api/
COPY frontend/package.json frontend/
COPY packages/shared/package.json packages/shared/

ARG GOOGLE_CLIENT_ID
ARG BASE_URL=https://api.mealdiary.co.uk
ARG ORIGIN
ARG GA_MEASUREMENT_ID

ENV HOST=0.0.0.0
ENV PORT=3000
ENV BASE_URL=${BASE_URL}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV ORIGIN=${ORIGIN}
ENV GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID}

COPY scripts/docker-install-frontend.sh scripts/
COPY scripts/install-frontend-native-deps.sh scripts/

RUN sh scripts/docker-install-frontend.sh

COPY frontend frontend/
COPY packages/shared packages/shared/

RUN npm run build --workspace=nuxt-app

WORKDIR /app/frontend

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
