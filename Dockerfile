# 1. 빌드 단계 (공사)
FROM node:18 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
# package-lock.json이 있으면 맥북/리눅스 충돌이 날 수 있으니 지우고 설치
RUN rm -rf package-lock.json
RUN rm -rf node_modules
RUN npm install

# 2. 실행 단계 (전시)
FROM node:18-alpine
WORKDIR /app
# 3000번 포트로 웹사이트를 보여주는 도구(serve)를 설치합니다.
RUN npm install -g serve
# 빌드된 결과물만 가져옵니다.
COPY --from=builder /app/dist ./dist

# 3000번 포트에서 앱을 실행합니다.
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]