# Frontend Dockerfile
# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx (lightweight)
FROM nginx:stable-alpine AS production

# Copy built files to Nginx html dir
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx config to support React Router (SPA)


RUN echo 'server {\
  listen 80;\

  location / {\
    root /usr/share/nginx/html;\
    index index.html;\
    try_files $uri $uri/ /index.html;\
  }\

  location /auth/ {\
    proxy_pass http://backend:5000;\
    proxy_http_version 1.1;\
    proxy_set_header Host $host;\
    proxy_set_header X-Real-IP $remote_addr;\
  }\

  location /events/ {\
    proxy_pass http://backend:5000;\
    proxy_http_version 1.1;\
    proxy_set_header Host $host;\
    proxy_set_header X-Real-IP $remote_addr;\
  }\

  location /bookings/ {\
    proxy_pass http://backend:5000;\
    proxy_http_version 1.1;\
    proxy_set_header Host $host;\
    proxy_set_header X-Real-IP $remote_addr;\
  }\
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
