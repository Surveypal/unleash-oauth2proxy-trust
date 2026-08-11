ARG NODE_VERSION=22.23-alpine3.23

FROM node:$NODE_VERSION AS builder

WORKDIR /unleash

COPY auth-hook.js index.js package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production=true

FROM node:$NODE_VERSION AS runner

ENV NODE_ENV=production
ENV TZ=UTC

WORKDIR /unleash

COPY --from=builder /unleash /unleash

RUN rm -rf /usr/local/lib/node_modules/npm/

RUN apk upgrade --no-cache

EXPOSE 4242

USER node

CMD ["node", "index.js"]