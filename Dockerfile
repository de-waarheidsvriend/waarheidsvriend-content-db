FROM node:20-bookworm-slim

# Install Poppler for PDF processing (pdftoppm for Story 2.2)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Expose the Next.js port
EXPOSE 3000

# Start in production mode
CMD ["npm", "start"]
