FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm install prisma && npx prisma generate
RUN npm run build || true

EXPOSE 3018

CMD ["npm", "start"]
