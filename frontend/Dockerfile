# build environment
FROM node:20-alpine AS build
WORKDIR /app
ARG DEV_MODE=false
ARG APP_VERSION=0.4.8-alpha
ENV VITE_DEV_MODE=${DEV_MODE}
ENV VITE_APP_VERSION=${APP_VERSION}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# production environment
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
