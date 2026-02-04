# 1. 빌드 단계 (공사)
FROM node:18 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# React 앱을 HTML/CSS/JS로 변환(빌드)합니다.
RUN npm run build

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