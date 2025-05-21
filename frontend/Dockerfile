FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

ENV HOST=0.0.0.0
ENV PORT=3000
ENV BASE_URL=http://api.railway.internal:3001

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]