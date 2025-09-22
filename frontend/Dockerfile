FROM node:23.5-alpine3.20 AS build-stage
WORKDIR /usr/local/app

# Copy in the source code
COPY public ./public
COPY src ./src
COPY package.json ./package.json
COPY package-lock.json package-lock.json

EXPOSE 3000

# # Install the application dependencies
RUN apk add npm
RUN npm install
RUN npm run build


FROM nginx:1.15

COPY --from=build-stage /usr/local/app/build/ /usr/share/nginx/html