FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm install prisma@5 && npx prisma generate
RUN npm run build || true

EXPOSE 3016

CMD ["npm", "start"]
