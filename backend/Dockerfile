FROM node:23.5-alpine3.20
WORKDIR /usr/local/app

COPY . ./backend
COPY .env ./.env
COPY package.json package.json
COPY package-lock.json package-lock.json

EXPOSE 5001

# # Install the application dependencies
RUN apk add npm
RUN npm install

CMD [ "node", "backend/server.js" ]