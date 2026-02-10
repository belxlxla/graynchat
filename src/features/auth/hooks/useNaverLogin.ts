import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

declare global {
  interface Window {
    naver: any;
  }
}

const NAVER_CLIENT_ID = 'rKU793HIwCl3TzqdHcvj';

// ✅ 환경별 콜백 URL 자동 분기
// - 운영: https://graynchat.com/auth/login  → 네이버 콘솔 등록된 URL
// - 개발: http://localhost:5173/auth/login  → 네이버 콘솔에 추가 등록 필요
const getNaverCallbackUrl = () => {
  const origin = window.location.origin;
  if (origin.includes('graynchat.com')) {
    return 'https://graynchat.com/auth/login';
  }
  return `${origin}/auth/login`;
};

export const useNaverLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isProcessing = useRef(false);

  useEffect(() => {
    const { naver } = window;
    if (!naver) return;

    const naverContainer = document.getElementById('naverIdLogin');
    if (!naverContainer || naverContainer.children.length > 0) return;

    const callbackUrl = getNaverCallbackUrl();

    const naverLogin = new naver.LoginWithNaverId({
      clientId: NAVER_CLIENT_ID,
      callbackUrl: callbackUrl,
      isPopup: false,
      loginButton: { color: 'green', type: 3, height: 60 },
      callbackHandle: true,
    });

    naverLogin.init();

    if (location.hash.includes('access_token') && !isProcessing.current) {
      isProcessing.current = true;

      naverLogin.getLoginStatus(async (status: boolean) => {
        if (status) {
          const { id, email, name, profile_image, mobile } = naverLogin.user;

          if (!email) {
            toast.error('이메일 정보 제공 동의가 필요합니다.');
            isProcessing.current = false;
            return;
          }

          await handleNaverAuth(id, email, name, profile_image, mobile);
        } else {
          isProcessing.current = false;
        }
      });
    }
  }, [location, navigate]);

  const handleNaverAuth = async (
    naverId: string,
    email: string,
    name: string,
    avatar: string,
    phone: string | null
  ) => {
    try {
      const uniqueEmail = `naver_${naverId}@grayn.app`;
      const password = `NAVER_${naverId}_GRAYN`;

      // 1. 회원가입 시도
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: uniqueEmail,
        password: password,
        options: {
          data: {
            full_name: name,
            avatar_url: avatar,
            provider: 'naver',
            real_email: email,
          },
        },
      });

      let userId: string | null = null;
      let isNewUser = false;

      if (signUpError) {
        // 2. 이미 가입된 경우 로그인
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: uniqueEmail,
          password: password,
        });

        if (signInError) {
          console.error('Login failed:', signInError);
          toast.error('네이버 로그인에 실패했습니다.');
          window.history.replaceState({}, '', '/auth/login');
          return;
        }

        userId = signInData?.user?.id || null;

        if (userId) {
          await supabase.auth.updateUser({
            data: {
              provider: 'naver',
              full_name: name,
              avatar_url: avatar,
            }
          });
        }
      } else {
        userId = signUpData?.user?.id || null;
        isNewUser = true;
      }

      // 3. users 테이블에 저장
      if (userId) {
        if (isNewUser) {
          await supabase.from('users').insert({
            id: userId,
            email: email,
            name: name,
            avatar: avatar,
            phone: phone || null,
          });
        } else {
          await supabase.from('users').update({
            name: name,
            avatar: avatar,
            phone: phone || null,
            updated_at: new Date().toISOString(),
          }).eq('id', userId);
        }
      }

      toast.success(`${name}님 환영합니다!`);
      window.history.replaceState({}, '', '/auth/login');
      navigate('/main/friends');

    } catch (error: any) {
      console.error('Naver Auth Error:', error);
      toast.error('로그인 처리 중 오류가 발생했습니다.');
      window.history.replaceState({}, '', '/auth/login');
    } finally {
      isProcessing.current = false;
    }
  };

  const triggerNaverLogin = useCallback(() => {
    const btn = document.getElementById('naverIdLogin')?.firstChild as HTMLElement;
    btn?.click();
  }, []);

  return { triggerNaverLogin };
};