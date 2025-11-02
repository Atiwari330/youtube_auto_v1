# Media Worker Dockerfile
# Optimized for Cloud Run / Fly.io deployment
# Includes: Node.js, yt-dlp, ffmpeg

FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Verify installations
RUN yt-dlp --version && ffmpeg -version && node --version

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL Node.js dependencies (including dev for TypeScript build)
RUN npm ci

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install -g typescript && tsc

# Remove devDependencies and build artifacts (keeps image small)
RUN npm prune --production && rm -rf src tsconfig.json

# Use existing node user (already exists in node:20-slim)
RUN chown -R node:node /app
USER node

# Expose port (default 3001)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the server
CMD ["node", "dist/index.js"]
