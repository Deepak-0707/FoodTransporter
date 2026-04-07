# Frontend Dockerfile — Phase 4 (with backward compatibility)

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:5000
ARG VITE_SOCKET_URL=http://localhost:5000

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build


FROM nginx:stable-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

# Combined Nginx config (SPA + API proxy)
COPY <<NGINX /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # React Router support
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy (preserves old behavior)
    location /auth/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /events/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /bookings/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /menu/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]