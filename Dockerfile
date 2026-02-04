# 1. Node.js 설치된 리눅스 환경을 불러옴
FROM node:18

# 2. 서버 안에 'app' 폴더를 생성
WORKDIR /app

# 3. 패키지 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 4. 나머지 소스 코드 복사
COPY . .

# 5. 3000번 포트 열기
EXPOSE 3000

# 6. 서버 실행 명령어
CMD ["node", "App.tsx"]