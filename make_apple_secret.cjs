console.log("▶️ 1단계: 스크립트 시작...");

try {
  const jwt = require('jsonwebtoken');
  console.log("▶️ 2단계: 모듈 로드 성공!");

  // --------------------------------------------------------
  // ⬇️ 여기 4가지를 다시 입력해주세요 (저장 필수!) ⬇️
  // --------------------------------------------------------
  
  // 1. Team ID (애플 개발자 센터 우측 상단 10자리)
  const TEAM_ID = 'J4J5FC4RB4'; 

  // 2. Key ID (QW3MRZJ23P)
  const KEY_ID = 'QW3MRZJ23P'; 

  // 3. Supabase Client ID (com.grayn.app.service)
  const CLIENT_ID = 'com.grayn.app.service'; 

  // 4. Private Key (.p8 파일 내용 전체)
  // 백틱(`) 기호 안에 줄바꿈 포함해서 전체를 붙여넣으세요
  const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgH0KkvJnRvzkHMJIT
jFY1fZKE/byRCeda/BFsqutuIZKgCgYIKoZIzj0DAQehRANCAARgQtMHBD6/2IOJ
uJjiMnqby/yTPIZBwwAoKVByC2kizRgtNAnrXwRS+eBE1XFPVDuu4E6mXxsbsbFG
Hudc2S7P
-----END PRIVATE KEY-----`;

  // --------------------------------------------------------

  console.log("▶️ 3단계: 비밀키 생성 중...");

  // [수정됨] 옵션 이름을 라이브러리 규칙에 맞게 변경했습니다.
  const secret = jwt.sign({}, PRIVATE_KEY, {
    algorithm: 'ES256',
    expiresIn: '180d',
    issuer: TEAM_ID,       // iss -> issuer
    subject: CLIENT_ID,    // sub -> subject
    audience: 'https://appleid.apple.com', // aud -> audience
    keyid: KEY_ID,         // kid -> keyid
  });

  console.log("\n✅ [성공] 아래 긴 문자열을 복사해서 Supabase [비밀 키] 칸에 넣으세요 👇\n");
  console.log(secret);
  console.log("\n---------------------------------------------------");

} catch (error) {
  console.error("\n❌ [에러 발생]", error.message);
}