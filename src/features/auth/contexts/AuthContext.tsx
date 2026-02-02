import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../../shared/lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 현재 세션 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. 인증 상태 변경 감지 (로그인/로그아웃 시 자동 업데이트)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ 안전한 로그아웃 함수
  const signOut = async () => {
    try {
      // Supabase 로그아웃 시도
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        // 403 에러나 session_not_found는 무시 (이미 로그아웃 상태)
        if (!error.message?.includes('403') && !error.message?.includes('session_not_found')) {
          console.error('Logout error:', error);
        }
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // 에러 여부와 관계없이 로컬 상태 정리
      localStorage.clear();
      sessionStorage.clear();
      
      // 상태 초기화
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// 커스텀 훅: 다른 컴포넌트에서 쉽게 유저 정보를 가져오기 위함
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};