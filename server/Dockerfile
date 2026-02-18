FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .


FROM node:20-alpine

WORKDIR /app

# Only install production dependencies in the final image
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source (tsx runs TypeScript directly)
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]

