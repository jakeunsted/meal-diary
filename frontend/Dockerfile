FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

# Build arguments for environment variables needed at build time
# These are baked into the Nuxt build output
ARG GOOGLE_CLIENT_ID
ARG BASE_URL=https://api.mealdiary.co.uk
ARG ORIGIN

# Set as environment variables for the build process
ENV HOST=0.0.0.0
ENV PORT=3000
ENV BASE_URL=${BASE_URL}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV ORIGIN=${ORIGIN}

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]