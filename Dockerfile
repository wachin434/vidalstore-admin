# Etapa 1: compila TypeScript (necesita las devDependencies)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: imagen final, solo dependencias de producción, sin jest ni Nest CLI
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3020
CMD ["node", "dist/main.js"]
