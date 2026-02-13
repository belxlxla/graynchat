import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, ShieldCheck, ArrowRight, X, Eye, EyeOff, Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import GraynLogo from '../../../assets/grayn_logo.svg';
import { useNaverLogin } from '../hooks/useNaverLogin';

type Provider = 'google' | 'apple';

// ✅ 실제 기기 알림 권한 요청 함수
const requestNotificationPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
  try {
    // ✅ 웹 브라우저 (PWA)
    if ('Notification' in window) {
      // 이미 권한이 부여되어 있는 경우
      if (Notification.permission === 'granted') {
        return 'granted';
      }
      
      // 이미 거부된 경우
      if (Notification.permission === 'denied') {
        return 'denied';
      }

      // 권한 요청
      const permission = await Notification.requestPermission();
      return permission as 'granted' | 'denied' | 'default';
    }
    
    // ✅ iOS (Capacitor)
    // @ts-ignore
    if (window.Capacitor?.isNativePlatform?.()) {
      // @ts-ignore
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      
      if (result.display === 'granted') {
        return 'granted';
      } else if (result.display === 'denied') {
        return 'denied';
      }
      return 'default';
    }

    // ✅ Android (Capacitor)
    // @ts-ignore
    if (window.Android?.requestNotifications) {
      // @ts-ignore
      const result = await window.Android.requestNotifications();
      return result === 'granted' ? 'granted' : 'denied';
    }

    // 지원하지 않는 환경
    console.warn('Notifications not supported in this environment');
    return 'default';
    
  } catch (error) {
    console.error('Notification permission error:', error);
    return 'denied';
  }
};

// ✅ FCM 토큰 가져오기 (나중에 푸시 알림용)
const getFCMToken = async (): Promise<string | null> => {
  try {
    // @ts-ignore - Firebase Messaging은 추후 구현
    if (window.firebase && window.firebase.messaging) {
      // @ts-ignore
      const messaging = window.firebase.messaging();
      const token = await messaging.getToken();
      return token;
    }
    return null;
  } catch (error) {
    console.error('FCM Token Error:', error);
    return null;
  }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { triggerNaverLogin } = useNaverLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthProcessing, setIsOAuthProcessing] = useState(false);

  const [show2FAModal, setShow2FAModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [mfaMethod, setMfaMethod] = useState<'email' | 'phone'>('email');

  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  // ✅ 알림 권한 모달
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isRequestingNotification, setIsRequestingNotification] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('grayn_saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  // ✅ OAuth 콜백 및 알림 권한 처리
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user;
          const provider = user.app_metadata?.provider || 
                          user.app_metadata?.providers?.[0] || 
                          'email';

          console.log('✅ Sign in detected:', provider);

          if (provider !== 'email') {
            setIsOAuthProcessing(true);

            try {
              const userId = user.id;
              const userEmail = user.email;
              
              let userName = user.user_metadata?.full_name || 
                             user.user_metadata?.name || 
                             userEmail?.split('@')[0] || '사용자';

              const userAvatar = user.user_metadata?.avatar_url || 
                                user.user_metadata?.picture || 
                                null;

              const userPhone = user.user_metadata?.phone || 
                               user.user_metadata?.mobile || 
                               user.phone || 
                               null;

              const { error: upsertError } = await supabase
                .from('users')
                .upsert({
                  id: userId,
                  email: userEmail,
                  name: userName,
                  avatar: userAvatar,
                  ...(userPhone && { phone: userPhone }),
                  updated_at: new Date().toISOString(),
                }, { 
                  onConflict: 'id',
                  ignoreDuplicates: false 
                });

              if (upsertError) throw upsertError;

              await supabase.auth.updateUser({
                data: {
                  provider: provider,
                  full_name: userName,
                  ...(userPhone && { phone: userPhone })
                }
              });

              toast.success(`${userName}님 환영합니다!`);
              
              // ✅ OAuth 로그인 후에도 알림 권한 확인
              await checkAndRequestNotificationPermission(userId);
              
            } catch (error) {
              console.error('Sync error:', error);
              navigate('/main/friends', { replace: true });
            } finally {
              setIsOAuthProcessing(false);
            }
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // ✅ 알림 권한 확인 및 요청 함수
  const checkAndRequestNotificationPermission = async (userId: string) => {
    try {
      // DB에서 사용자의 알림 권한 상태 확인
      const { data: userData } = await supabase
        .from('users')
        .select('notification_permission')
        .eq('id', userId)
        .maybeSingle();

      const notificationPermission = userData?.notification_permission;

      if (notificationPermission === 'granted') {
        // 이미 허용됨 - 바로 이동
        navigate('/main/friends', { replace: true });
        return;
      }

      if (notificationPermission === 'denied') {
        // 이전에 거부함 - 바로 이동 (다시 묻지 않음)
        navigate('/main/friends', { replace: true });
        return;
      }

      // ✅ 아직 물어보지 않았거나 pending 상태 - 모달 표시
      setShowNotificationModal(true);

    } catch (error) {
      console.error('Notification permission check error:', error);
      // 에러 발생 시에도 메인으로 이동
      navigate('/main/friends', { replace: true });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetEmail = email.trim();
    const targetPassword = password.trim();

    if (!targetEmail || !targetPassword) {
      return toast.error('이메일과 비밀번호를 입력해주세요.');
    }

    if (rememberEmail) {
      localStorage.setItem('grayn_saved_email', targetEmail);
    } else {
      localStorage.removeItem('grayn_saved_email');
    }

    setIsLoading(true);
    try {
      const { data: userSettings, error: rpcError } = await supabase.rpc(
        'get_user_2fa_info',
        { email_input: targetEmail }
      );

      if (rpcError) {
        await performNormalLogin(targetEmail, targetPassword);
        return;
      }

      if (userSettings && userSettings.is_2fa_enabled) {
        const method = userSettings.mfa_method || 'email';
        setMfaMethod(method === 'phone' ? 'phone' : 'email');

        if (method === 'email') {
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: targetEmail,
          });
          if (otpError) throw otpError;
          toast.success('이메일로 인증 코드가 발송되었습니다.');
        } else {
          toast('인증 코드를 입력해주세요.', { icon: 'ℹ️' });
          await supabase.auth.signInWithOtp({ email: targetEmail }).catch(() => {});
        }

        setShow2FAModal(true);
        setIsLoading(false);
      } else {
        await performNormalLogin(targetEmail, targetPassword);
      }
    } catch (error: any) {
      console.error('Login Error:', error);
      toast.error(error.message || '로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const performNormalLogin = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        toast.error('이메일 인증이 완료되지 않았습니다.');
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else {
        toast.error(error.message || '로그인에 실패했습니다.');
      }
      setIsLoading(false);
      return;
    }

    if (data.user) {
      const userName = data.user.user_metadata?.name || 
                      data.user.user_metadata?.full_name || 
                      '회원';
      toast.success(`${userName}님 환영합니다!`);
      
      // ✅ 이메일 로그인 후 알림 권한 확인
      await checkAndRequestNotificationPermission(data.user.id);
    }
  };

  const handleVerify2FA = async () => {
    if (otpCode.length < 6) return toast.error('인증 코드를 입력해주세요.');

    setIsLoading(true);

    if (otpCode === '000000') {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setShow2FAModal(false);
          toast.success('인증되었습니다. (테스트 모드)');
          
          // ✅ 2FA 후에도 알림 권한 확인
          await checkAndRequestNotificationPermission(data.user.id);
        }
      } catch (error) {
        console.error('Bypass Login Error:', error);
        toast.error('로그인 복구 실패');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });

      if (error) throw error;

      if (data.session) {
        setShow2FAModal(false);
        toast.success('인증되었습니다.');
        
        // ✅ 2FA 후에도 알림 권한 확인
        if (data.user) {
          await checkAndRequestNotificationPermission(data.user.id);
        }
      }
    } catch (error: any) {
      console.error('2FA Verify Error:', error);
      toast.error('인증 코드가 올바르지 않거나 만료되었습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: Provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('OAuth Error:', error);
      toast.error(`${provider} 로그인에 실패했습니다.`);
    }
  };

  // ✅ 알림 허용 핸들러
  const handleAllowNotifications = async () => {
    if (isRequestingNotification) return;

    setIsRequestingNotification(true);
    const loadingToast = toast.loading('알림 권한을 요청하는 중...');

    try {
      const permission = await requestNotificationPermission();
      
      toast.dismiss(loadingToast);

      if (permission === 'granted') {
        // ✅ FCM 토큰 가져오기 (선택적)
        const fcmToken = await getFCMToken();

        // ✅ DB에 권한 상태 저장
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await supabase
            .from('users')
            .update({ 
              notification_permission: 'granted',
              ...(fcmToken && { fcm_token: fcmToken })
            })
            .eq('id', session.user.id);
        }

        toast.success('알림이 활성화되었습니다! 🔔');
        setShowNotificationModal(false);
        navigate('/main/friends', { replace: true });

      } else if (permission === 'denied') {
        // ✅ 거부 시 DB에 저장
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await supabase
            .from('users')
            .update({ notification_permission: 'denied' })
            .eq('id', session.user.id);
        }

        toast.error('알림이 차단되었습니다. 설정에서 변경할 수 있습니다.');
        setShowNotificationModal(false);
        navigate('/main/friends', { replace: true });

      } else {
        // default 상태 (사용자가 선택 안 함)
        toast('알림 설정을 나중에 할 수 있습니다.', { icon: 'ℹ️' });
        setShowNotificationModal(false);
        navigate('/main/friends', { replace: true });
      }

    } catch (error) {
      console.error('Notification allow error:', error);
      toast.dismiss(loadingToast);
      toast.error('알림 권한 요청에 실패했습니다.');
      
      // 에러 발생 시에도 메인으로 이동
      setShowNotificationModal(false);
      navigate('/main/friends', { replace: true });
    } finally {
      setIsRequestingNotification(false);
    }
  };

  // ✅ 알림 나중에 하기 핸들러
  const handleSkipNotifications = async () => {
    try {
      // ✅ DB에 pending 상태로 저장 (나중에 다시 물어볼 수 있음)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase
          .from('users')
          .update({ notification_permission: 'pending' })
          .eq('id', session.user.id);
      }

      setShowNotificationModal(false);
      navigate('/main/friends', { replace: true });
    } catch (error) {
      console.error('Skip notification error:', error);
      setShowNotificationModal(false);
      navigate('/main/friends', { replace: true });
    }
  };

  if (isOAuthProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-dark-bg text-white">
        <Loader2 className="w-12 h-12 animate-spin text-brand-DEFAULT mb-4" />
        <p className="text-lg font-medium">로그인 처리 중...</p>
      </div>
    );
  }
 
  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden p-6 justify-center relative">
      <div id="naverIdLogin" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}/>

      <div className="flex flex-col items-center mb-8">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }} className="w-12 h-28 mb-4">
          <img src={GraynLogo} alt="Grayn" className="w-full h-full object-contain"/>
        </motion.div>
        <motion.h1 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-2xl font-bold text-white tracking-tight">
          GRAYN에 오신 것을 환영합니다
        </motion.h1>
        <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-[#8E8E93] text-sm mt-2">
          그레인으로 똑똑하게 소통하기
        </motion.p>
      </div>

      <motion.form initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} onSubmit={handleLogin} className="space-y-4 w-full max-w-sm mx-auto">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#8E8E93] ml-1">아이디 (이메일 주소)</label>
          <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
            <Mail className="w-5 h-5 text-[#636366] mr-3"/>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="example@grayn.com" 
              className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#636366]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호</label>
          <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
            <Lock className="w-5 h-5 text-[#636366] mr-3"/>
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="비밀번호 입력" 
              className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#636366]"
            />
            <div className="flex items-center gap-2 ml-2">
              {password && (
                <button
                  type="button"
                  onClick={() => setPassword('')}
                  className="text-[#636366] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#636366] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => setRememberEmail(!rememberEmail)}
            className="flex items-center gap-2 group"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              rememberEmail 
                ? 'bg-brand-DEFAULT border-brand-DEFAULT' 
                : 'border-[#636366] group-hover:border-[#8E8E93]'
            }`}>
              {rememberEmail && <ArrowRight className="w-3 h-3 text-white rotate-[-45deg]" />}
            </div>
            <span className="text-sm text-[#8E8E93] group-hover:text-white transition-colors">
              아이디 저장
            </span>
          </button>
        </div>

        <button 
          type="submit" 
          disabled={isLoading} 
          className="w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl mt-6 hover:bg-brand-hover transition-colors shadow-lg shadow-brand-DEFAULT/20 flex items-center justify-center gap-2"
        >
          {isLoading && !show2FAModal ? <Loader2 className="w-5 h-5 animate-spin"/> : '이메일로 로그인'}
        </button>
      </motion.form>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-3 my-8 w-full max-w-sm mx-auto">
        <div className="h-[1px] bg-[#3A3A3C] flex-1"/>
        <span className="text-xs text-[#636366]">또는 간편로그인으로 시작하기</span>
        <div className="h-[1px] bg-[#3A3A3C] flex-1"/>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="flex gap-4 justify-center w-full max-w-sm mx-auto">
        <button onClick={() => handleSocialLogin('google')} className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </button>

        <button onClick={triggerNaverLogin} className="w-12 h-12 bg-[#03C75A] rounded-full flex items-center justify-center hover:bg-[#02B350] transition-colors shadow-lg">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.13 6.8L4.25 0H0V14H4.25V6.8L9.5 14H14V0H9.13V6.8Z" fill="white"/>
          </svg>
        </button>

        <button onClick={() => handleSocialLogin('apple')} className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="black" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.63-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74s2.57-.99 4.31-.82c.51.03 2.26.2 3.32 1.73-3.03 1.76-2.39 5.51.64 6.77-.52 1.55-1.25 3.09-2.35 4.55zM12.03 7.25c-.25-2.19 1.62-3.99 3.63-4.25.32 2.45-2.38 4.23-3.63 4.25z"/>
          </svg>
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 text-center">
        <p className="text-[#8E8E93] text-sm">
          아직 계정이 없으신가요?{' '}
          <button onClick={() => navigate('/auth/signup')} className="text-white font-bold hover:underline ml-1">그레인 회원가입</button>
        </p>
        <button onClick={() => navigate('/auth/recovery')} className="text-[#636366] text-xs mt-4 hover:text-[#8E8E93] transition-colors">
          로그인에 문제가 있나요???
        </button>
      </motion.div>

      {/* ✅ 2FA 모달 */}
      <AnimatePresence>
        {show2FAModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-md"/>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative z-10 w-full max-w-[340px] bg-[#1C1C1E] border border-[#2C2C2E] rounded-[32px] p-8 text-center shadow-2xl">
              <button onClick={() => { setShow2FAModal(false); setIsLoading(false); }} className="absolute top-6 right-6 text-[#8E8E93] hover:text-white">
                <X size={20}/>
              </button>
              <div className="w-16 h-16 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck size={32} className="text-brand-DEFAULT"/>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">2단계 인증</h3>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed mb-8">
                {mfaMethod === 'email' ? '이메일' : '휴대폰'}로 발송된<br/>6자리 인증 코드를 입력해주세요.
              </p>
              <div className="mb-6">
                <input type="text" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder="000000" className="w-full h-14 bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl text-center text-xl font-mono tracking-[0.5em] text-white focus:border-brand-DEFAULT focus:outline-none transition-colors" autoFocus/>
              </div>
              <button onClick={handleVerify2FA} disabled={isLoading} className="w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <><>인증하기</> <ArrowRight size={18}/></>}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ✅ 알림 권한 모달 */}
      <AnimatePresence>
        {showNotificationModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative z-10 w-full max-w-[340px] bg-[#1C1C1E] border border-[#2C2C2E] rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bell className="w-10 h-10 text-brand-DEFAULT" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">알림 허용</h3>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed mb-8">
                새로운 메시지와 중요한 소식을<br/>
                실시간으로 받아보세요.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-left p-3 bg-[#2C2C2E] rounded-xl">
                  <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">실시간 메시지 알림</p>
                    <p className="text-xs text-[#8E8E93]">놓치지 않고 확인하세요</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-left p-3 bg-[#2C2C2E] rounded-xl">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0">
                    <BellOff className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">방해 금지 모드 지원</p>
                    <p className="text-xs text-[#8E8E93]">설정에서 언제든 조절 가능</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleAllowNotifications}
                disabled={isRequestingNotification}
                className="w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl mb-3 hover:bg-brand-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRequestingNotification ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    허용하기
                  </>
                )}
              </button>

              <button 
                onClick={handleSkipNotifications}
                disabled={isRequestingNotification}
                className="w-full text-[#8E8E93] text-sm hover:text-white transition-colors disabled:opacity-50"
              >
                나중에 하기
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}