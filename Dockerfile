FROM node:20-bookworm-slim

# Install Poppler for PDF processing and OpenSSL for Prisma
RUN apt-get update && apt-get install -y \
    poppler-utils \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all source files first
COPY . .

# Install dependencies (including devDependencies for prisma generate)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Build the application (dummy DATABASE_URL needed for Next.js static analysis)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npm run build
ENV DATABASE_URL=""

# Remove dev dependencies for smaller image
RUN npm prune --production

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh

# Expose the Next.js port
EXPOSE 3000

# Start with entrypoint that runs migrations first
ENTRYPOINT ["/app/docker-entrypoint.sh"]
