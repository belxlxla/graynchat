import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✨ [수정] 환경변수가 없으면 에러를 뿜는 대신, 경고만 하고 null을 반환하도록 수정
// 이렇게 해야 배포 후 키가 없어도 화면이 꺼지지 않습니다.
let supabase: any = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn(
    '⚠️ Supabase 환경변수가 설정되지 않았습니다. (UI 데모 모드로 실행됩니다.)\n' +
    'Vercel Settings > Environment Variables에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 추가해주세요.'
  );
}

export { supabase };