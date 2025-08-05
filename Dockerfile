FROM node:23.5-alpine3.20
WORKDIR /usr/local/app

# Setup an app user so the container doesn't run as the root user
# RUN useradd app
# USER app

# Copy in the source code
COPY public ./public
COPY src ./src
COPY backend ./backend
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY scripts ./scripts
RUN chmod +x ./scripts/init.sh
EXPOSE 3000
EXPOSE 5001

# # Install the application dependencies
RUN apk add npm
RUN npm install

CMD ["sh", "./scripts/init.sh"]
# CMD ["npm", "start"]
