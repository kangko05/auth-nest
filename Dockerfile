FROM node:lts-alpine3.24 AS builder
WORKDIR /usr/local/app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ---

FROM node:lts-alpine3.24 AS runner
WORKDIR /usr/local/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/local/app/dist ./dist

EXPOSE 3000
USER node

CMD ["node", "dist/main"]
