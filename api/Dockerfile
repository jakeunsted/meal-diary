FROM node:26-alpine

# bcrypt must compile on Alpine/musl; node-gyp needs Python and a C++ toolchain.
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
COPY . ./

RUN npm install \
  && npm rebuild bcrypt --build-from-source

# Build the TypeScript code
RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start"]