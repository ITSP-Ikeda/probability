# Stage 1: build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend-react/ .
RUN npm install --legacy-peer-deps && npm run build

# Stage 2: build Rust backend (glibc for faster allocator than musl)
FROM rust:1.82-bookworm AS backend
WORKDIR /app
COPY backend-rust/ .
RUN cargo build --release --bins

# Stage 3: runtime (glibc to match backend binary)
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV STATIC_DIR=/app/dist
COPY --from=frontend /app/dist ./dist
COPY --from=backend /app/target/release/texas-equity-api .
COPY --from=backend /app/target/release/gen_preflop_table .
RUN mkdir -p /app/assets/data
COPY --from=backend /app/assets/data ./assets/data
EXPOSE 8080
CMD ["./texas-equity-api"]
