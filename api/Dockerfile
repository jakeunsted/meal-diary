FROM node:23.6

WORKDIR /app

COPY package*.json ./
COPY . ./

# Install dependencies and rebuild bcrypt for the current architecture
RUN npm install
RUN npm rebuild bcrypt --build-from-source

COPY . .

# Add type: module to package.json to fix the warning
RUN npm pkg set type=module

EXPOSE 3000

CMD ["npm", "run", "dev"]