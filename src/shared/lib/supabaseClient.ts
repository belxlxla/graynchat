// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// .env 파일에서 키를 가져옵니다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Key가 .env 파일에 설정되지 않았습니다.');
}

// Supabase 클라이언트를 생성하여 앱 전체에서 사용합니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);