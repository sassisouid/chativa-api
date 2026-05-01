FROM node:20-alpine

# Install build dependencies for sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source
COPY . .

# Create data directory for SQLite
RUN mkdir -p /data

# Expose port (Fly sets PORT automatically)
EXPOSE 3000

CMD ["node", "server.js"]
