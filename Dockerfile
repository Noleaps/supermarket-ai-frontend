FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm install -g tsx
EXPOSE 3000
CMD ["tsx", "server.ts"]