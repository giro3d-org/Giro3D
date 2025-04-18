FROM node:23-alpine3.20

EXPOSE 8080

WORKDIR /giro3D

COPY package.json .
COPY package-lock.json .

RUN npm ci --prefer-offline --cache .npm

COPY . .

CMD ["npm", "run", "start"]
