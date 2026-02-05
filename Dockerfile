# [전략 변경] 서버에서 빌드하지 않습니다!
# 정민님 맥북에서 만든 'dist' 폴더를 그대로 가져다가 3000번으로 띄우기만 합니다.

FROM node:22-alpine

WORKDIR /app

# 웹사이트 띄워주는 가벼운 도구 하나만 설치 (용량 거의 안 차지함)
RUN npm install -g serve

# 내 맥북에서 만든 완성품(dist)을 서버로 복사
COPY dist ./dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
