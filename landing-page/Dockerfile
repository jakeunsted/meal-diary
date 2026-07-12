FROM node:26.3.0-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY landing-page/package.json landing-page/

ARG APP_URL

ENV HOST=0.0.0.0
ENV PORT=3003
ENV APP_URL=${APP_URL}

COPY scripts/docker-install-landing-page.sh scripts/
COPY scripts/install-landing-page-native-deps.sh scripts/
COPY scripts/linux-platform.sh scripts/

RUN sh scripts/docker-install-landing-page.sh

COPY landing-page landing-page/

RUN npm run build --workspace=landing-page

WORKDIR /app/landing-page

EXPOSE 3003

CMD ["node", ".output/server/index.mjs"]
