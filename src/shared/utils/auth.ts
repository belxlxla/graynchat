import { supabase } from '../lib/supabaseClient';

export const safeLogout = async (redirectTo: string = '/') => {
  try {
    // 1. Supabase 로그아웃 시도
    await supabase.auth.signOut();
  } catch (error: any) {
    // 403, session_not_found 에러는 무시
    if (!error.message?.includes('403') && !error.message?.includes('session_not_found')) {
      console.error('Logout error:', error);
    }
  } finally {
    // 2. 로컬 저장소 정리
    localStorage.clear();
    sessionStorage.clear();
    
    // 3. 리다이렉트
    window.location.href = redirectTo;
  }
};