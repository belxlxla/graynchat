// src/features/auth/hooks/useNaverLogin.ts
import { useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient';

// 상수는 컴포넌트 밖으로 빼야 useEffect 의존성 경고가 사라집니다.
const NAVER_CLIENT_ID = 'rKU793HIwCl3TzqdHcvj'; 
const NAVER_CALLBACK_URL = window.location.origin;

export const useNaverLogin = () => {
  useEffect(() => {
    const { naver } = window;
    if (!naver) {
      console.error('Naver SDK not found');
      return;
    }

    const naverLogin = new naver.LoginWithNaverId({
      clientId: NAVER_CLIENT_ID,
      callbackUrl: NAVER_CALLBACK_URL,
      isPopup: false,
      loginButton: { color: 'green', type: 1, height: 60 },
    });

    naverLogin.init();

    naverLogin.getLoginStatus(async function (status: boolean) {
      if (status) {
        // 네이버 로그인 인스턴스에서 유저 정보 가져오기
        const user = naverLogin.user;
        const { email, id, name, profile_image } = user;
        
        console.log('네이버 인증 성공:', email);

        try {
          // 1. Supabase 로그인 시도 (네이버 ID를 비밀번호로 사용)
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: id, 
          });

          // 2. 로그인 실패 시 (계정 없음) -> 회원가입 진행
          if (signInError) {
            console.log('신규 회원가입 진행 중...');
            
            const { error: signUpError } = await supabase.auth.signUp({
              email: email,
              password: id,
              options: {
                data: {
                  full_name: name,
                  avatar_url: profile_image,
                  login_type: 'naver',
                },
              },
            });

            if (signUpError) throw signUpError;
            alert(`환영합니다, ${name}님! (네이버 연동 가입 완료)`);
          } else {
            console.log('로그인 성공');
          }
        } catch (err) {
          console.error('Supabase 연동 실패:', err);
          alert('로그인 연동 중 오류가 발생했습니다.');
        }
      }
    });
  }, []); // 상수를 밖으로 뺐으므로 빈 배열([]) 유지 가능

  // 버튼 트리거 함수 (useCallback으로 메모이제이션)
  const triggerNaverLogin = useCallback(() => {
    const naverBtn = document.getElementById('naverIdLogin')?.firstChild as HTMLElement;
    if (naverBtn) {
      naverBtn.click();
    } else {
      console.error('네이버 버튼을 찾을 수 없습니다.');
    }
  }, []);

  return { triggerNaverLogin };
};