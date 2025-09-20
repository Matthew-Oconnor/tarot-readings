FROM node:23.5-alpine3.20
WORKDIR /usr/local/app

# Copy in the source code
COPY public ./public
COPY src ./src
COPY package.json package.json
COPY package-lock.json package-lock.json

EXPOSE 3000

# # Install the application dependencies
RUN apk add npm
RUN npm install

CMD ["npm", "start"]