FROM node:26.3.0-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/marketing/package.json apps/marketing/

ARG SITE_URL=https://mealdiary.co.uk
ARG APP_URL=https://app.mealdiary.co.uk
ARG GA_MEASUREMENT_ID
ARG POSTHOG_PUBLIC_KEY
ARG POSTHOG_HOST=https://prxhg.mealdiary.co.uk

ENV HOST=0.0.0.0
ENV PORT=3010
ENV SITE_URL=${SITE_URL}
ENV APP_URL=${APP_URL}
ENV GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID}
ENV POSTHOG_PUBLIC_KEY=${POSTHOG_PUBLIC_KEY}
ENV POSTHOG_HOST=${POSTHOG_HOST}
ENV NUXT_PUBLIC_SITE_URL=${SITE_URL}
ENV NUXT_PUBLIC_APP_URL=${APP_URL}

COPY scripts/docker-install-marketing.sh scripts/
COPY scripts/linux-platform.sh scripts/

RUN sh scripts/docker-install-marketing.sh

COPY apps/marketing apps/marketing/

RUN npm run build --workspace=meal-diary-marketing

WORKDIR /app/apps/marketing

EXPOSE 3010

CMD ["node", ".output/server/index.mjs"]
