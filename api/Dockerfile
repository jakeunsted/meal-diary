FROM node:23.6

WORKDIR /app

COPY package*.json ./
COPY . ./

# Install dependencies and rebuild bcrypt for the current architecture
RUN npm install
RUN npm rebuild bcrypt --build-from-source

# Build the TypeScript code
RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start"]