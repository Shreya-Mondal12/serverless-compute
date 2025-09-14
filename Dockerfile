# Use Node.js base image
FROM node:18-slim

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Expose port (only if index.js starts a server, otherwise skip)
EXPOSE 3000

# Default command to run your app
CMD ["node", "src/index.js"]
