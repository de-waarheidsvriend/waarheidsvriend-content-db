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
# In development: overwritten by volume mount in docker-compose.yml
# In production: this provides the application code
COPY . .

# Expose the Next.js development port
EXPOSE 3000

# Start in development mode with hot-reload
# Note: -H 0.0.0.0 is required to make the server accessible from outside the container
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
