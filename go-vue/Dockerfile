FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend-vue/ .
RUN npm install --legacy-peer-deps && npm run build

FROM golang:1.21-alpine AS backend
WORKDIR /app
COPY backend-go/ .
RUN go mod tidy && CGO_ENABLED=0 go build -o texas-equity-api .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
ENV STATIC_DIR=/app/dist
COPY --from=frontend /app/dist ./dist
COPY --from=backend /app/texas-equity-api .
RUN mkdir -p /app/assets/data
COPY --from=backend /app/assets/data ./assets/data
EXPOSE 8080
CMD ["./texas-equity-api"]
