FROM node:22-alpine AS build-stage
WORKDIR /usr/local/app

COPY package.json ./package.json
COPY package-lock.json package-lock.json
COPY vite.config.js ./vite.config.js
COPY index.html ./index.html
COPY public ./public
COPY src ./src

RUN npm ci
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build-stage /usr/local/app/dist/ /usr/share/nginx/html
EXPOSE 80
