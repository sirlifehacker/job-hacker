# Use lightweight Node.js Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY index.js ./

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

