FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3007

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.cjs ./server.cjs

EXPOSE 3007

CMD ["node", "server.cjs"]
