FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .


FROM node:20-alpine

WORKDIR /app

# Only install production dependencies in the final image
COPY package*.json ./
RUN npm ci

# copy runtime files
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]

