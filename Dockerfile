# Gunakan Node 20 (Wajib untuk Tailwind/Vite terbaru)
FROM node:20-alpine

WORKDIR /app

# Copy dependency
COPY package*.json ./

# Bersihkan cache dan install (mencegah error native binding)
RUN npm install

# Copy seluruh kode
COPY . .

# Build aplikasi (Vite + Esbuild)
RUN npm run build

# Install tsx untuk menjalankan server.ts
RUN npm install -g tsx

# Port sesuai server.ts
EXPOSE 3000

# Jalankan server
CMD ["tsx", "server.ts"]