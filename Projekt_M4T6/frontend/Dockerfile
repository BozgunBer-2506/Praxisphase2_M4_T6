FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
