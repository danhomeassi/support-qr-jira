FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Install and build client
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Copy server files
COPY server.js database.js ./
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY utils/ ./utils/

# Create directories for data and uploads
RUN mkdir -p data uploads

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server.js"]
