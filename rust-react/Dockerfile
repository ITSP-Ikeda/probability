# Stage 1: build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend-react/ .
RUN npm install --legacy-peer-deps && npm run build

# Stage 2: build Rust backend
FROM rust:1.82-alpine AS backend
WORKDIR /app
RUN apk add --no-cache musl-dev
COPY backend-rust/ .
RUN cargo build --release --bins

# Stage 3: runtime
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
ENV STATIC_DIR=/app/dist
COPY --from=frontend /app/dist ./dist
COPY --from=backend /app/target/release/texas-equity-api .
COPY --from=backend /app/target/release/gen_preflop_table .
RUN mkdir -p /app/assets/data
COPY --from=backend /app/assets/data ./assets/data
EXPOSE 8080
CMD ["./texas-equity-api"]
