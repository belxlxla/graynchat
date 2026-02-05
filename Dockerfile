# 1. 빌드 단계 (Node 22)
FROM node:22 AS builder
WORKDIR /app
COPY package.json package-lock.json ./

# [핵심 변경] 설치 후 즉시 캐시 삭제 (&& 로 연결해야 같은 단계에서 지워짐)
RUN rm -rf package-lock.json node_modules
RUN npm install --legacy-peer-deps && npm cache clean --force

COPY . .
RUN npm run build

# 2. 실행 단계
FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]