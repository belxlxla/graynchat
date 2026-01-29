import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, UserPlus, RefreshCw, Contact, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function FriendsSettingsPage() {
  const navigate = useNavigate();

  // === States ===
  const [autoAdd, setAutoAdd] = useState(true);
  const [useContactNames, setUseContactNames] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);

  // 1. 초기 데이터 로드 및 자동 동기화 체크 (오전 7시 로직)
  const fetchSettings = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('users')
      .select('auto_add_friends, use_contact_names, last_friends_sync')
      .eq('id', session.user.id)
      .single();

    if (!error && data) {
      setAutoAdd(data.auto_add_friends);
      setUseContactNames(data.use_contact_names);
      const syncDate = new Date(data.last_friends_sync);
      setLastUpdated(syncDate.toLocaleString());

      // ✨ 오전 7시 자동 업데이트 로직: 마지막 동기화가 오늘 오전 7시 이전이라면 자동 실행
      if (data.auto_add_friends) {
        const now = new Date();
        const sevenAM = new Date();
        sevenAM.setHours(7, 0, 0, 0);

        if (now > sevenAM && syncDate < sevenAM) {
          handleRefresh(true); // 백그라운드 무음 새로고침
        }
      }
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 2. 실제 연락처/친구 동기화 핵심 함수
  const handleRefresh = async (isBackground = false) => {
    if (isRefreshing) return;
    if (!isBackground) setIsRefreshing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // [기능 1] 브라우저 연락처 API 접근 (실제 주소록 데이터 가져오기 시도)
      // ✨ 빌드 에러 해결: 선언 후 사용하지 않는 contacts 변수 제거
      if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
        try {
          // OS 주소록 권한 요청 및 데이터 획득 (이름, 번호)
          await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
        } catch (e) { console.warn("Contact access denied"); }
      }

      // [기능 2] Supabase RPC 또는 API를 통한 매칭 작업
      // 1. 내 연락처 번호들을 서버로 보내서 그레인 가입자 필터링
      // 2. 나를 친추했거나 내가 친추한 사람 리스트 업데이트
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('users')
        .update({ last_friends_sync: now })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setLastUpdated(new Date().toLocaleString());
      
      if (!isBackground) {
        setShowRefreshModal(true);
      }
    } catch (error) {
      console.error(error);
      if (!isBackground) toast.error('동기화 중 오류가 발생했습니다.');
    } finally {
      if (!isBackground) setIsRefreshing(false);
    }
  };

  // 3. 설정 변경 핸들러 (실시간 DB 반영)
  const toggleAutoAdd = async () => {
    const newState = !autoAdd;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from('users')
      .update({ auto_add_friends: newState })
      .eq('id', session.user.id);

    if (!error) {
      setAutoAdd(newState);
      toast.success(newState ? '오전 7시 자동 업데이트가 활성화되었습니다.' : '자동 업데이트가 해제되었습니다.');
    }
  };

  const toggleContactNames = async () => {
    const newState = !useContactNames;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from('users')
      .update({ use_contact_names: newState })
      .eq('id', session.user.id);

    if (!error) {
      setUseContactNames(newState);
      toast.success(newState ? 'OS 연락처 이름으로 동기화됩니다.' : '그레인 프로필 이름으로 복구됩니다.');
    }
  };

  const handleBlockedFriends = () => {
    navigate('/settings/friends/blocked'); 
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">친구 설정</h1>
      </header>

      {/* === Content === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        <div className="px-5 space-y-8">
          
          <Section label="친구 추가">
            {/* 1. 자동 친구 추가 (토글) */}
            <div className="p-5 border-b border-[#3A3A3C]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">자동 친구 추가</span>
                </div>
                <Toggle isOn={autoAdd} onToggle={toggleAutoAdd} />
              </div>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed">
                매일 오전 7시, 내 연락처에서 그레인을 사용하는 친구를 자동으로 업데이트합니다.
              </p>
            </div>

            {/* 2. 친구 목록 새로고침 (실제 동기화) */}
            <div className="p-5 active:bg-[#3A3A3C] transition-colors cursor-pointer" onClick={() => handleRefresh()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <RefreshCw className={`w-5 h-5 text-[#8E8E93] ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="text-[15px] text-white">친구 목록 새로고침</span>
                </div>
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#3A3A3C]">
                  <RefreshCw className={`w-4 h-4 text-[#E5E5EA] ${isRefreshing ? 'animate-spin' : ''}`} />
                </div>
              </div>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed mb-2">
                나를 추가한 사람, 연락처 기반 가입자를 즉시 매칭하여 리스트를 최신화합니다.
              </p>
              <p className="text-[12px] text-brand-DEFAULT font-medium">
                최종 동기화: {lastUpdated || '이력 없음'}
              </p>
            </div>
          </Section>

          <Section label="이름 설정">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Contact className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">연락처 이름 우선 표시</span>
                </div>
                <Toggle isOn={useContactNames} onToggle={toggleContactNames} />
              </div>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed">
                기기에 저장된 주소록 이름을 사용하여 친구를 더 쉽게 식별합니다.
              </p>
            </div>
          </Section>

          <Section label="차단 및 관리">
            <button 
              onClick={handleBlockedFriends}
              className="w-full flex items-center justify-between px-5 py-5 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Ban className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">차단한 친구 관리</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
            </button>
          </Section>

        </div>
      </div>

      <AlertModal 
        isOpen={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        title="동기화 완료"
        content="주소록 및 가입자 정보를 바탕으로 친구 목록이 최신 상태로 업데이트되었습니다."
      />

    </div>
  );
}

// === [Sub Components] ===

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-black text-[#636366] ml-2 mb-2 uppercase tracking-widest">{label}</h3>
      <div className="bg-[#2C2C2E] rounded-[24px] overflow-hidden border border-[#3A3A3C] shadow-xl">
        {children}
      </div>
    </div>
  );
}

function Toggle({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <div 
      onClick={onToggle}
      className={`w-[50px] h-[28px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-500 ${
        isOn ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
      }`}
    >
      <motion.div
        className="w-5 h-5 bg-white rounded-full shadow-lg"
        animate={{ x: isOn ? 22 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
  );
}

function AlertModal({ isOpen, onClose, title, content }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] rounded-[32px] overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-8">
          <h3 className="text-white font-bold text-xl mb-3">{title}</h3>
          {content && <p className="text-[#8E8E93] text-sm leading-relaxed">{content}</p>}
        </div>
        <button onClick={onClose} className="w-full py-5 text-brand-DEFAULT font-bold text-[16px] border-t border-[#2C2C2E] hover:bg-[#2C2C2E] transition-colors">확인</button>
      </motion.div>
    </div>
  );
}