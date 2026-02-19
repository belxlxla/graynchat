import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Mail, Lock, User, Loader2, 
  Check, ChevronRight, Eye, EyeOff, X, Calendar,
  AlertCircle, UserCheck, Shield, Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

const VERIFY_TIME = 180;

export default function SignUpPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const [accountData, setAccountData] = useState({
    name: '',
    email: '',
    birthdate: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const [isMinor, setIsMinor] = useState(false);
  const [age, setAge] = useState<number | null>(null);
  const [guardianConsent, setGuardianConsent] = useState({
    agreed: false,
    guardianName: '',
    guardianPhone: '',
    relationship: '',
  });

  const [guardianVerifyStep, setGuardianVerifyStep] = useState<'input' | 'verify'>('input');
  const [guardianVerifyCode, setGuardianVerifyCode] = useState('');
  const [guardianTimer, setGuardianTimer] = useState(VERIFY_TIME);
  const [isGuardianVerified, setIsGuardianVerified] = useState(false);
  const [isSendingGuardianSMS, setIsSendingGuardianSMS] = useState(false);
  const [isVerifyingGuardianCode, setIsVerifyingGuardianCode] = useState(false);
  const [guardianCodeError, setGuardianCodeError] = useState(false);

  const [agreedTerms, setAgreedTerms] = useState({
    service: false,
    location: false,
    privacy: false,
    sensitive: false,
    operation: false,
    youth: false,
    marketing: false,
  });

  const policyLinks: Record<string, string> = {
    service: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    location: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    privacy: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    sensitive: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    operation: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    youth: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    marketing: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
  };

  const calculateAge = (birthdate: string): number | null => {
    if (birthdate.length !== 8) return null;
    const year = parseInt(birthdate.substring(0, 4));
    const month = parseInt(birthdate.substring(4, 6));
    const day = parseInt(birthdate.substring(6, 8));
    if (year < 1900 || year > new Date().getFullYear()) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    const today = new Date();
    const birthDate = new Date(year, month - 1, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  useEffect(() => {
    if (accountData.birthdate.length === 8) {
      const calculatedAge = calculateAge(accountData.birthdate);
      setAge(calculatedAge);
      if (calculatedAge !== null) {
        if (calculatedAge < 14) {
          setIsMinor(true);
          toast('만 14세 미만은 법정대리인 동의가 필요합니다.', { icon: '⚠️', duration: 3000 });
        } else {
          setIsMinor(false);
          setGuardianConsent({ agreed: false, guardianName: '', guardianPhone: '', relationship: '' });
          setGuardianVerifyStep('input');
          setGuardianVerifyCode('');
          setIsGuardianVerified(false);
        }
      }
    } else {
      setAge(null);
      setIsMinor(false);
    }
  }, [accountData.birthdate]);

  useEffect(() => {
    if (guardianVerifyStep !== 'verify' || guardianTimer <= 0) return;
    const interval = setInterval(() => setGuardianTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [guardianVerifyStep, guardianTimer]);

  useEffect(() => {
    if (guardianTimer === 0 && guardianVerifyStep === 'verify') {
      toast.error('인증 시간이 만료되었습니다.');
      setGuardianVerifyStep('input');
      setGuardianVerifyCode('');
      setGuardianTimer(VERIFY_TIME);
    }
  }, [guardianTimer, guardianVerifyStep]);

  const validatePassword = (password: string): string => {
    if (password.length === 0) return '';
    if (password.length < 8) return '비밀번호는 8자리 이상이어야 합니다.';
    if (!/[A-Z]/.test(password)) return '대문자를 최소 1개 포함해야 합니다.';
    if (!/[a-z]/.test(password)) return '소문자를 최소 1개 포함해야 합니다.';
    if (!/[0-9]/.test(password)) return '숫자를 최소 1개 포함해야 합니다.';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return '특수문자를 최소 1개 포함해야 합니다.';
    return '';
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountData({ ...accountData, [name]: value });
    if (name === 'password') {
      const error = validatePassword(value);
      setPasswordError(error);
      if (accountData.confirmPassword && value !== accountData.confirmPassword) {
        setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
      } else {
        setConfirmPasswordError('');
      }
    }
    if (name === 'confirmPassword') {
      setConfirmPasswordError(value !== accountData.password ? '비밀번호가 일치하지 않습니다.' : '');
    }
  };

  const handleBirthdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setAccountData({ ...accountData, birthdate: value });
  };

  const formatBirthdate = (value: string) => {
    if (value.length <= 4) return value;
    if (value.length <= 6) return `${value.slice(0, 4)}-${value.slice(4)}`;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  };

  const formatGuardianPhone = (value: string) => {
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length < 4) return raw;
    if (raw.length < 8) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
  };

  // ✅ Edge Function으로 SMS 발송
  const handleSendGuardianSMS = async () => {
    const raw = guardianConsent.guardianPhone.replace(/-/g, '');
    if (!guardianConsent.guardianName.trim()) return toast.error('법정대리인 이름을 입력해주세요.');
    if (!guardianConsent.relationship) return toast.error('관계를 선택해주세요.');
    if (raw.length < 10) return toast.error('올바른 전화번호를 입력해주세요.');

    setIsSendingGuardianSMS(true);
    const loadingToast = toast.loading('법정대리인 인증번호를 발송하는 중...');

    try {
      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: { phoneNumber: raw },
      });

      toast.dismiss(loadingToast);

      if (error) throw new Error(error.message || 'SMS 발송에 실패했습니다.');
      if (data?.error) throw new Error(data.error);

      toast.success('법정대리인 휴대폰으로 인증번호가 발송되었습니다.');
      setGuardianVerifyStep('verify');
      setGuardianTimer(VERIFY_TIME);
      setGuardianVerifyCode('');
      setGuardianCodeError(false);
    } catch (error: any) {
      console.error('SMS 발송 실패:', error);
      toast.dismiss(loadingToast);
      toast.error(error.message || '인증번호 발송에 실패했습니다.');
    } finally {
      setIsSendingGuardianSMS(false);
    }
  };

  // ✅ Edge Function으로 인증번호 검증 (DEMO_CODE 제거)
  const handleVerifyGuardianCode = async () => {
    const raw = guardianConsent.guardianPhone.replace(/-/g, '');
    setIsVerifyingGuardianCode(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-sms-code', {
        body: { phoneNumber: raw, code: guardianVerifyCode },
      });

      if (error) throw new Error(error.message || '인증에 실패했습니다.');
      if (!data?.success) {
        setGuardianCodeError(true);
        throw new Error(data?.error || '인증번호가 일치하지 않습니다.');
      }

      setIsGuardianVerified(true);
      setGuardianVerifyStep('input');
      toast.success('법정대리인 인증이 완료되었습니다.');
    } catch (error: any) {
      console.error('인증 실패:', error);
      setGuardianCodeError(true);
      toast.error(error.message || '인증번호가 일치하지 않거나 만료되었습니다.');
    } finally {
      setIsVerifyingGuardianCode(false);
    }
  };

  const handleAllAgree = () => {
    const isAllChecked = Object.values(agreedTerms).every(val => val);
    setAgreedTerms({
      service: !isAllChecked, location: !isAllChecked, privacy: !isAllChecked,
      sensitive: !isAllChecked, operation: !isAllChecked, youth: !isAllChecked, marketing: !isAllChecked,
    });
  };

  const handleTermToggle = (key: keyof typeof agreedTerms) => {
    setAgreedTerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenPolicy = (key: string) => {
    const url = policyLinks[key];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isRequiredAgreed = useMemo(() => {
    return agreedTerms.service && agreedTerms.location && agreedTerms.privacy &&
           agreedTerms.sensitive && agreedTerms.operation && agreedTerms.youth;
  }, [agreedTerms]);

  const isPasswordValid = useMemo(() => {
    return !passwordError && accountData.password.length > 0;
  }, [passwordError, accountData.password]);

  const isConfirmPasswordValid = useMemo(() => {
    return !confirmPasswordError && accountData.confirmPassword.length > 0 &&
           accountData.password === accountData.confirmPassword;
  }, [confirmPasswordError, accountData.confirmPassword, accountData.password]);

  const isGuardianConsentValid = useMemo(() => {
    if (!isMinor) return true;
    return guardianConsent.agreed &&
           guardianConsent.guardianName.trim() !== '' &&
           guardianConsent.guardianPhone.replace(/-/g, '').length >= 10 &&
           guardianConsent.relationship.trim() !== '' &&
           isGuardianVerified;
  }, [isMinor, guardianConsent, isGuardianVerified]);

  const isFormValid = useMemo(() => {
    return accountData.name.trim() !== '' &&
           accountData.email.trim() !== '' &&
           accountData.birthdate.length === 8 &&
           age !== null && age >= 0 &&
           isPasswordValid && isConfirmPasswordValid &&
           isRequiredAgreed && isGuardianConsentValid;
  }, [accountData, age, isPasswordValid, isConfirmPasswordValid, isRequiredAgreed, isGuardianConsentValid]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountData.name.trim()) return toast.error('이름을 입력해주세요.');
    if (!accountData.email.trim()) return toast.error('이메일을 입력해주세요.');
    if (!accountData.birthdate.trim() || accountData.birthdate.length !== 8)
      return toast.error('생년월일을 올바르게 입력해주세요.');
    if (age === null || age < 0) return toast.error('올바른 생년월일을 입력해주세요.');
    if (!isRequiredAgreed) return toast.error('필수 약관에 동의해 주세요.');
    if (isMinor && !isGuardianConsentValid) return toast.error('법정대리인 인증을 완료해주세요.');

    setIsLoading(true);
    try {
      // 1. Auth 회원가입
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: accountData.email.trim(),
        password: accountData.password,
        options: {
          data: {
            full_name: accountData.name.trim(),
            birthdate: accountData.birthdate,
            age: age,
            is_minor: isMinor,
            marketing_agreed: agreedTerms.marketing,
            ...(isMinor && {
              guardian_name: guardianConsent.guardianName,
              guardian_phone: guardianConsent.guardianPhone.replace(/-/g, ''),
              guardian_relationship: guardianConsent.relationship,
              guardian_verified: isGuardianVerified,
            }),
          },
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // ✅ 2. users 테이블: 명세서 허용 컬럼만 저장
        const { error: updateError } = await supabase
          .from('users')
          .upsert({
            id: authData.user.id,
            email: accountData.email.trim(),
            name: accountData.name.trim(),
            birthdate: accountData.birthdate,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (updateError) console.error('User Update Error (Non-fatal):', updateError);

        // ✅ 3. user_legal 테이블: 약관 및 보호자 정보 저장
        const legalData: any = {
          user_id: authData.user.id,
          is_terms_agreed: true,
          is_marketing_agreed: agreedTerms.marketing,
          is_minor: isMinor,
        };

        if (isMinor) {
          legalData.guardian_name = guardianConsent.guardianName;
          legalData.guardian_phone = guardianConsent.guardianPhone.replace(/-/g, '');
          legalData.guardian_relationship = guardianConsent.relationship;
          legalData.guardian_verified = isGuardianVerified;
        }

        const { error: legalError } = await supabase
          .from('user_legal')
          .upsert(legalData, { onConflict: 'user_id' });

        if (legalError) console.error('User Legal Error (Non-fatal):', legalError);

        // 4. 임시 세션 저장 후 전화번호 인증 페이지 이동
        sessionStorage.setItem('signup_email', accountData.email.trim());
        sessionStorage.setItem('signup_password', accountData.password);
        sessionStorage.setItem('signup_user_id', authData.user.id);

        toast.success('계정이 생성되었습니다.');
        navigate('/auth/phone', { replace: true });
      }
    } catch (error: any) {
      console.error('Signup Error:', error);
      let message = error.message || '회원가입 중 오류가 발생했습니다.';
      if (message.includes('Database error')) message = '서버 설정 오류입니다. (DB Trigger 확인 필요)';
      if (message.includes('User already registered')) message = '이미 가입된 이메일 주소입니다.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const termList = [
    { key: 'service',   label: '이용약관',                    required: true  },
    { key: 'location',  label: '위치기반서비스 이용약관',      required: true  },
    { key: 'privacy',   label: '개인정보처리방침',             required: true  },
    { key: 'sensitive', label: '민감정보 수집 및 이용 동의',   required: true  },
    { key: 'operation', label: '운영정책',                    required: true  },
    { key: 'youth',     label: '청소년보호정책',               required: true  },
    { key: 'marketing', label: '맞춤형 광고 안내',             required: false },
  ];

  const displayGuardianTime = `${Math.floor(guardianTimer / 60)}:${String(guardianTimer % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden p-6">
      <header className="h-14 flex items-center shrink-0 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-xl font-bold ml-1">회원가입</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-10">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-brand-DEFAULT mb-2">그레인 계정 만들기</h2>
            <p className="text-[#8E8E93] text-sm">서비스 이용을 위한 계정을 생성합니다.</p>
          </div>

          <form className="space-y-5" onSubmit={handleCreateAccount}>
            <div className="space-y-4">

              {/* 이름 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">이름(실명)</label>
                <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                  <User className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="name" type="text" value={accountData.name} onChange={handleAccountChange}
                    placeholder="실명으로 입력해 주세요"
                    className="bg-transparent text-white text-sm w-full focus:outline-none" />
                </div>
              </div>

              {/* 생년월일 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">생년월일</label>
                <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                  <Calendar className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="birthdate" type="text" value={formatBirthdate(accountData.birthdate)}
                    onChange={handleBirthdateChange} placeholder="YYYY-MM-DD (예: 2010-03-15)" maxLength={10}
                    className="bg-transparent text-white text-sm w-full focus:outline-none" />
                </div>
                <AnimatePresence>
                  {age !== null && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 ml-1 mt-2">
                      {age >= 14 ? (
                        <div className="flex items-center gap-2 text-green-500 text-xs">
                          <Check className="w-4 h-4" /><span>만 {age}세 (가입 가능)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-yellow-500 text-xs">
                          <AlertCircle className="w-4 h-4" /><span>만 {age}세 (법정대리인 동의 필요)</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 법정대리인 동의 섹션 */}
              <AnimatePresence>
                {isMinor && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex items-start gap-3">
                      <Shield className="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-white mb-1">법정대리인 동의 필요</h3>
                        <p className="text-xs text-[#8E8E93] leading-relaxed">
                          만 14세 미만 회원은 법정대리인(부모님 등)의 동의가 필요합니다.
                          법정대리인 정보를 입력하고 휴대폰 인증을 완료해주세요.
                        </p>
                      </div>
                    </div>

                    {/* 법정대리인 이름 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#8E8E93] ml-1">법정대리인 이름</label>
                      <div className="flex items-center bg-[#1C1C1E] rounded-xl px-4 py-3 border border-[#3A3A3C] focus-within:border-yellow-500 transition-colors">
                        <UserCheck className="w-5 h-5 text-[#636366] mr-3" />
                        <input type="text" value={guardianConsent.guardianName}
                          onChange={(e) => setGuardianConsent({ ...guardianConsent, guardianName: e.target.value })}
                          placeholder="부모님 또는 보호자 이름"
                          className="bg-transparent text-white text-sm w-full focus:outline-none"
                          disabled={guardianVerifyStep === 'verify'} />
                      </div>
                    </div>

                    {/* 관계 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#8E8E93] ml-1">관계</label>
                      <div className="grid grid-cols-4 gap-2">
                        {['부', '모', '조부모', '기타'].map((rel) => (
                          <button key={rel} type="button"
                            onClick={() => setGuardianConsent({ ...guardianConsent, relationship: rel })}
                            disabled={guardianVerifyStep === 'verify'}
                            className={`h-10 rounded-xl text-xs font-medium border transition-all disabled:opacity-50 ${
                              guardianConsent.relationship === rel
                                ? 'bg-yellow-500 border-yellow-500 text-white'
                                : 'bg-[#1C1C1E] border-[#3A3A3C] text-[#8E8E93]'
                            }`}
                          >{rel}</button>
                        ))}
                      </div>
                    </div>

                    {/* 법정대리인 전화번호 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#8E8E93] ml-1">법정대리인 전화번호</label>
                      <div className={`flex items-center bg-[#1C1C1E] rounded-xl px-4 py-3 border transition-colors ${
                        guardianVerifyStep === 'verify' ? 'opacity-50' : 'border-[#3A3A3C] focus-within:border-yellow-500'
                      }`}>
                        <Phone className="w-5 h-5 text-[#636366] mr-3" />
                        <input type="tel" value={formatGuardianPhone(guardianConsent.guardianPhone)}
                          onChange={(e) => setGuardianConsent({ ...guardianConsent, guardianPhone: e.target.value.replace(/[^0-9-]/g, '') })}
                          placeholder="010-0000-0000" maxLength={13}
                          className="bg-transparent text-white text-sm w-full focus:outline-none"
                          disabled={guardianVerifyStep === 'verify'} />
                      </div>

                      {guardianVerifyStep === 'input' && !isGuardianVerified && (
                        <button type="button" onClick={handleSendGuardianSMS}
                          disabled={isSendingGuardianSMS || !guardianConsent.guardianName.trim() || !guardianConsent.relationship || guardianConsent.guardianPhone.replace(/-/g, '').length < 10}
                          className="w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSendingGuardianSMS ? <><Loader2 className="w-5 h-5 animate-spin" />발송 중...</> : '인증번호 받기'}
                        </button>
                      )}

                      {isGuardianVerified && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <Check className="w-5 h-5 text-green-500" />
                          <span className="text-sm text-green-500 font-medium">법정대리인 인증 완료</span>
                        </motion.div>
                      )}
                    </div>

                    {/* 인증번호 입력 */}
                    <AnimatePresence>
                      {guardianVerifyStep === 'verify' && !isGuardianVerified && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                          <div className={`relative bg-[#1C1C1E] rounded-xl border ${guardianCodeError ? 'border-red-500' : 'border-[#3A3A3C]'}`}>
                            <input type="number" value={guardianVerifyCode}
                              onChange={(e) => { setGuardianVerifyCode(e.target.value.slice(0, 6)); setGuardianCodeError(false); }}
                              placeholder="000000"
                              className="w-full h-14 bg-transparent px-4 text-lg outline-none pr-20 text-white" autoFocus />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-500 text-sm font-mono font-bold">
                              {displayGuardianTime}
                            </span>
                          </div>
                          <button type="button" onClick={handleVerifyGuardianCode}
                            disabled={guardianVerifyCode.length !== 6 || isVerifyingGuardianCode}
                            className="w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                          >
                            {isVerifyingGuardianCode ? <><Loader2 className="w-5 h-5 animate-spin" />인증 중...</> : '인증 완료'}
                          </button>
                          <button type="button" onClick={handleSendGuardianSMS} disabled={isSendingGuardianSMS}
                            className="w-full text-[#8E8E93] text-sm hover:text-white transition-colors disabled:opacity-50">
                            {isSendingGuardianSMS ? '발송 중...' : '인증번호 재발송'}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 법정대리인 동의 체크 */}
                    {isGuardianVerified && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 p-3 bg-[#1C1C1E] rounded-xl cursor-pointer border border-[#3A3A3C] hover:border-yellow-500/50 transition-colors"
                        onClick={() => setGuardianConsent({ ...guardianConsent, agreed: !guardianConsent.agreed })}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${guardianConsent.agreed ? 'bg-yellow-500' : 'bg-[#3A3A3C]'}`}>
                          <Check className={`w-3 h-3 ${guardianConsent.agreed ? 'text-white' : 'text-[#636366]'}`} />
                        </div>
                        <div>
                          <p className="text-xs text-white font-medium mb-0.5">법정대리인 동의 확인</p>
                          <p className="text-[10px] text-[#8E8E93] leading-relaxed">
                            본인은 위 미성년자의 법정대리인으로서, 해당 미성년자의
                            서비스 이용 및 개인정보 처리에 동의합니다.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 이메일 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">이메일</label>
                <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                  <Mail className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="email" type="email" value={accountData.email} onChange={handleAccountChange}
                    placeholder="example@grayn.com"
                    className="bg-transparent text-white text-sm w-full focus:outline-none" />
                </div>
              </div>

              {/* 비밀번호 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호</label>
                <div className={`flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border transition-colors ${
                  passwordError && accountData.password ? 'border-red-500' :
                  isPasswordValid ? 'border-green-500' : 'border-[#3A3A3C] focus-within:border-brand-DEFAULT'
                }`}>
                  <Lock className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="password" type={showPassword ? 'text' : 'password'} value={accountData.password} onChange={handleAccountChange}
                    placeholder="8자리 이상, 대소문자/숫자/특수문자 포함"
                    className="bg-transparent text-white text-sm w-full focus:outline-none" />
                  <div className="flex items-center gap-2 ml-2">
                    {accountData.password && (
                      <button type="button" onClick={() => setAccountData({ ...accountData, password: '', confirmPassword: '' })} className="text-[#636366] hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[#636366] hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 비밀번호 확인 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호 확인</label>
                <div className={`flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border transition-colors ${
                  confirmPasswordError && accountData.confirmPassword ? 'border-red-500' :
                  isConfirmPasswordValid ? 'border-green-500' : 'border-[#3A3A3C] focus-within:border-brand-DEFAULT'
                }`}>
                  <Lock className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={accountData.confirmPassword} onChange={handleAccountChange}
                    placeholder="비밀번호 재입력"
                    className="bg-transparent text-white text-sm w-full focus:outline-none" />
                  <div className="flex items-center gap-2 ml-2">
                    {accountData.confirmPassword && (
                      <button type="button" onClick={() => setAccountData({ ...accountData, confirmPassword: '' })} className="text-[#636366] hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-[#636366] hover:text-white transition-colors">
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 약관 동의 */}
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C] cursor-pointer" onClick={handleAllAgree}>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${Object.values(agreedTerms).every(v => v) ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'}`}>
                    <Check className={`w-4 h-4 ${Object.values(agreedTerms).every(v => v) ? 'text-white' : 'text-[#636366]'}`} />
                  </div>
                  <span className="font-bold text-sm text-white">약관에 전체 동의합니다.</span>
                </div>
              </div>
              <div className="space-y-3 px-1">
                {termList.map((term) => (
                  <div key={term.key} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTermToggle(term.key as keyof typeof agreedTerms)}>
                      <Check className={`w-5 h-5 transition-colors ${agreedTerms[term.key as keyof typeof agreedTerms] ? 'text-brand-DEFAULT' : 'text-[#3A3A3C]'}`} />
                      <span className="text-sm text-[#8E8E93] group-hover:text-white transition-colors">
                        {term.label}{' '}
                        <span className={term.required ? 'text-brand-DEFAULT' : 'text-[#636366]'}>
                          ({term.required ? '필수' : '선택'})
                        </span>
                      </span>
                    </div>
                    <button type="button" onClick={() => handleOpenPolicy(term.key)} className="p-1 text-[#636366] hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 제출 버튼 */}
            <button type="submit" disabled={isLoading || !isFormValid}
              className={`w-full py-4 font-bold rounded-2xl mt-4 transition-all shadow-lg flex items-center justify-center gap-2 ${
                isFormValid ? 'bg-brand-DEFAULT text-white hover:bg-brand-hover' : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed border border-[#3A3A3C]'
              }`}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '본인인증 하기'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}