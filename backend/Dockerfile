FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
