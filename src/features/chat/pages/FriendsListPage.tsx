import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { PanInfo } from 'framer-motion'; 
import { 
  Search, Settings, Star, MessageCircle, X, User as UserIcon, 
  UserPlus, MessageSquarePlus, CheckCircle2, Circle,
  Image as ImageIcon, Trash2, RefreshCw,
  ChevronRight, Users, Ban, AlertTriangle, BookUser
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface Friend {
  id: number;
  friend_user_id: string; 
  name: string;
  phone: string;
  status: string | null;
  avatar: string | null;
  bg: string | null;
  isFavorite: boolean;
  friendlyScore: number;
}

interface MyProfile {
  name: string;
  status: string;
  avatar: string | null;
  bg: string | null;
}

type StepType = 'permission' | 'complete' | 'list';
type ChatStepType = 'select-type' | 'select-friends';

// ✅ 실제 연락처 동기화 유틸리티
const requestContactsPermission = async (): Promise<boolean> => {
  try {
    // ✅ Web Contacts API 사용 (Chrome, Edge 등에서 지원)
    if ('contacts' in navigator && 'ContactsManager' in window) {
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      
      // @ts-ignore - Contacts API는 실험적 기능
      const contacts = await navigator.contacts.select(props, opts);
      
      if (contacts && contacts.length > 0) {
        // 연락처 정보를 localStorage에 저장
        const contactsData = contacts.map((contact: any) => ({
          name: contact.name?.[0] || '',
          phone: contact.tel?.[0] || ''
        }));
        localStorage.setItem('grayn_synced_contacts', JSON.stringify(contactsData));
        return true;
      }
      return false;
    } 
    
    // ✅ iOS PWA (Safari)
    // @ts-ignore
    if (window.webkit?.messageHandlers?.contacts) {
      return new Promise((resolve) => {
        // @ts-ignore
        window.webkit.messageHandlers.contacts.postMessage({ action: 'request' });
        
        // iOS에서 메시지 응답 대기
        // @ts-ignore
        window.handleContactsResponse = (granted: boolean) => {
          resolve(granted);
        };
      });
    }
    
    // ✅ Android PWA
    // @ts-ignore
    if (window.Android?.requestContacts) {
      // @ts-ignore
      const result = await window.Android.requestContacts();
      return result === 'granted';
    }
    
    // ✅ 지원하지 않는 브라우저
    toast('이 브라우저는 연락처 동기화를 지원하지 않습니다.', { icon: '⚠️' });
    return false;
    
  } catch (error) {
    console.error('Contacts permission error:', error);
    return false;
  }
};

// ✅ 동기화된 연락처 가져오기
const getSyncedContacts = (): Array<{ name: string; phone: string }> => {
  try {
    const data = localStorage.getItem('grayn_synced_contacts');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export default function FriendsListPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<StepType>(() => {
    const savedPermission = localStorage.getItem('grayn_contact_permission');
    return savedPermission === 'granted' ? 'list' : 'permission';
  });

  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [myProfile, setMyProfile] = useState<MyProfile>({
    name: '사용자',
    status: '',
    avatar: null,
    bg: null
  });

  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  
  const [blockTarget, setBlockTarget] = useState<Friend | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Friend | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // [추가] AI 점수 계산 중인지 여부
  const [calculatingScore, setCalculatingScore] = useState(false);

  // ✅ 실제 연락처 동기화 핸들러
  const handleAllowContacts = useCallback(async () => {
    const loadingToast = toast.loading('연락처 권한을 요청하는 중...');
    
    const granted = await requestContactsPermission();
    
    toast.dismiss(loadingToast);
    
    if (granted) {
      localStorage.setItem('grayn_contact_permission', 'granted');
      toast.success('연락처 동기화가 완료되었습니다!');
      setStep('complete');
      
      // ✅ 동기화된 연락처로 친구 자동 추가 (선택사항)
      await syncContactsToFriends();
      
      setTimeout(() => {
        setStep('list');
      }, 1500);
    } else {
      toast.error('연락처 권한이 거부되었습니다.');
    }
  }, []);

  // ✅ 동기화된 연락처를 friends 테이블에 자동 추가
  const syncContactsToFriends = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const contacts = getSyncedContacts();
      if (contacts.length === 0) return;

      const syncPromises = contacts.map(async (contact) => {
        if (!contact.phone) return;

        // 그레인 사용자 중 해당 전화번호가 있는지 확인
        const { data: users } = await supabase
          .from('users')
          .select('id, name, avatar, phone, status_message')
          .eq('phone', contact.phone)
          .neq('id', session.user.id)
          .maybeSingle();

        if (users) {
          // 이미 친구인지 확인
          const { data: existing } = await supabase
            .from('friends')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('friend_user_id', users.id)
            .maybeSingle();

          if (!existing) {
            // 친구 추가
            await supabase.from('friends').insert({
              user_id: session.user.id,
              friend_user_id: users.id,
              name: users.name,
              phone: users.phone,
              avatar: users.avatar,
              status: users.status_message,
              friendly_score: 50,
              is_favorite: false,
              is_blocked: false
            });
          }
        }
      });

      await Promise.all(syncPromises);
      toast.success('연락처에서 그레인 사용자를 찾았습니다!');
    } catch (error) {
      console.error('Sync contacts error:', error);
    }
  };

  const fetchMyProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('users')
        .select('name, avatar, bg_image, status_message')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch error:', error);
        return;
      }
      
      if (data) {
        setMyProfile({
          name: data.name || session.user.user_metadata?.name || session.user.user_metadata?.full_name || '사용자',
          status: data.status_message || '',
          avatar: data.avatar || null,
          bg: data.bg_image || null
        });
      } else {
        setMyProfile({
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || '사용자',
          status: '',
          avatar: null,
          bg: null
        });
      }
    } catch (e) { 
      console.error("MyProfile Load Error", e); 
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', session.user.id) 
        .or('is_blocked.eq.false,is_blocked.is.null') 
        .order('name', { ascending: true });

      if (error) throw error;

      if (data) {
        const formattedData: Friend[] = data.map((item: any) => ({
          id: item.id,
          friend_user_id: item.friend_user_id || '', 
          name: item.name,
          phone: item.phone,
          status: item.status,
          avatar: item.avatar,
          bg: item.bg,
          isFavorite: item.is_favorite || false,
          friendlyScore: item.friendly_score || 50 // 기본값 50
        }));
        setFriends(formattedData);
      }
    } catch (error) {
      console.error('Fetch Friends Error:', error);
      toast.error('친구 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyProfile();
    if (step === 'list') {
      fetchFriends();
    }
  }, [step, fetchFriends, fetchMyProfile]);
  
  const handleSaveMyProfile = useCallback(async (newProfile: MyProfile) => { 
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { error } = await supabase
        .from('users')
        .update({
          name: newProfile.name,
          status_message: newProfile.status,
          avatar: newProfile.avatar,
          bg_image: newProfile.bg
        })
        .eq('id', session.user.id);

      if (error) throw error;

      setMyProfile(newProfile); 
      setShowEditProfileModal(false); 
      toast.success('프로필이 업데이트되었습니다.'); 
    } catch (e) {
      console.error("Save Profile Error:", e);
      toast.error('수정에 실패했습니다.');
    }
  }, []);
  
  const toggleFavorite = useCallback(async (id: number) => {
    const targetFriend = friends.find(f => f.id === id);
    if (!targetFriend) return;

    const newStatus = !targetFriend.isFavorite;
    
    setFriends(prev => prev.map(f => 
      f.id === id ? { ...f, isFavorite: newStatus } : f
    ));
    
    if (selectedFriend?.id === id) { 
      setSelectedFriend(prev => prev ? { ...prev, isFavorite: newStatus } : null); 
    }

    try {
      const { error } = await supabase
        .from('friends')
        .update({ is_favorite: newStatus })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Toggle Favorite Error:', error);
      toast.error('변경사항 저장 실패');
      setFriends(prev => prev.map(f => 
        f.id === id ? { ...f, isFavorite: !newStatus } : f
      ));
    }
  }, [friends, selectedFriend]);

  // [고도화] AI 점수 분석 및 반영 함수
  const analyzeFriendlyScore = useCallback(async (friend: Friend) => {
    if (!friend.friend_user_id) return;
    
    setCalculatingScore(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      // 1. 공통 채팅방 찾기
      const sharedRoomId = [session.user.id, friend.friend_user_id].sort().join("_");
      
      // 2. 메시지 데이터 조회 (최대 100개)
      const { data: messages } = await supabase
        .from('messages')
        .select('sender_id, created_at')
        .eq('room_id', sharedRoomId)
        .order('created_at', { ascending: false })
        .limit(100);

      // 3. 점수 계산 알고리즘
      let score = 30; // 기본 점수
      
      if (messages && messages.length > 0) {
        // A. 대화량 점수 (최대 40점)
        const msgCount = messages.length;
        score += Math.min(msgCount, 40);

        // B. 최근 대화 점수 (최대 20점)
        const lastMsgTime = new Date(messages[0].created_at).getTime();
        const now = new Date().getTime();
        const daysDiff = (now - lastMsgTime) / (1000 * 3600 * 24);
        
        if (daysDiff < 1) score += 20;
        else if (daysDiff < 3) score += 15;
        else if (daysDiff < 7) score += 10;
        else score += 5;

        // C. 티키타카 밸런스 점수 (최대 10점)
        const myMsgCount = messages.filter(m => m.sender_id === session.user.id).length;
        const friendMsgCount = msgCount - myMsgCount;
        const balanceRatio = Math.abs(myMsgCount - friendMsgCount) / msgCount; // 0에 가까울수록 좋음
        
        if (balanceRatio < 0.2) score += 10;
        else if (balanceRatio < 0.4) score += 5;
      }

      // 100점 만점 처리
      const finalScore = Math.min(100, score);

      // 상태 업데이트
      setSelectedFriend(prev => prev ? { ...prev, friendlyScore: finalScore } : null);
      
      // DB 업데이트 (비동기, 굳이 기다리지 않음)
      supabase.from('friends').update({ friendly_score: finalScore }).eq('id', friend.id).then();

    } catch (error) {
      console.error('Score Analysis Error:', error);
    } finally {
      setCalculatingScore(false);
    }
  }, []);

  // 친구 선택 시 AI 분석 실행
  const handleFriendClick = (friend: Friend) => {
    setSelectedFriend(friend);
    analyzeFriendlyScore(friend); // 분석 시작
  };

  const handleEnterChat = useCallback(async (friend: Friend) => {
    const loadingToast = toast.loading("채팅방 연결 중...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || !friend.friend_user_id) {
        toast.dismiss(loadingToast);
        toast.error("채팅방 정보를 불러올 수 없습니다.");
        return;
      }

      const sharedRoomId = [session.user.id, friend.friend_user_id].sort().join("_");

      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('id', sharedRoomId)
        .maybeSingle();

      if (existingRoom) {
        toast.dismiss(loadingToast);
        setSelectedFriend(null);
        navigate(`/chat/room/${sharedRoomId}`);
        return;
      }

      const { error: roomError } = await supabase
        .from('chat_rooms')
        .insert([{ 
          id: sharedRoomId,
          title: friend.name,
          type: 'individual',
          created_by: session.user.id,
          last_message: '새로운 대화를 시작해보세요!',
          members_count: 2
        }]);

      if (roomError) {
        if (roomError.code !== '23505') {
          throw roomError;
        }
      }

      const { error: membersError } = await supabase
        .from('room_members')
        .upsert([
          { room_id: sharedRoomId, user_id: session.user.id, unread_count: 0 },
          { room_id: sharedRoomId, user_id: friend.friend_user_id, unread_count: 0 }
        ], { 
          onConflict: 'room_id,user_id',
          ignoreDuplicates: true 
        });

      if (membersError && membersError.code !== '23505') {
        throw membersError;
      }

      toast.dismiss(loadingToast);
      setSelectedFriend(null); 
      navigate(`/chat/room/${sharedRoomId}`); 
    } catch (e: any) {
      toast.dismiss(loadingToast);
      console.error("Chat Enter Error:", e);
      toast.error("채팅방 입장에 실패했습니다.");
    }
  }, [navigate]);

  const handleDeleteClick = useCallback((id: number) => {
    const target = friends.find(f => f.id === id);
    if (target) {
      setDeleteTarget(target);
    }
  }, [friends]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { error } = await supabase
        .from('friends')
        .delete()
        .match({ id: deleteTarget.id, user_id: session.user.id });

      if (error) throw error;

      setFriends(prev => prev.filter(f => f.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('친구가 삭제되었습니다.');
    } catch (error) {
      console.error('Delete Error:', error);
      toast.error('삭제에 실패했습니다.');
    }
  }, [deleteTarget]);

  const handleBlockConfirm = useCallback(async (friendId: number, options: { blockMessage: boolean, hideProfile: boolean }) => {
    const loadingToast = toast.loading('차단 처리 중...');
    try {
      const { error } = await supabase
        .from('friends')
        .update({ 
          is_blocked: true, 
          hide_profile: options.hideProfile 
        })
        .eq('id', friendId);

      if (error) throw error;

      setFriends(prev => prev.filter(f => f.id !== friendId));
      setSelectedFriend(null); 
      setBlockTarget(null);
      toast.dismiss(loadingToast);
      toast.success('차단되었습니다.');
    } catch (error) {
      console.error('Block Error:', error);
      toast.dismiss(loadingToast);
      toast.error("차단 처리에 실패했습니다.");
    }
  }, []);

  const handleGoFriends = useCallback(() => {
    navigate('/settings/friends');
    setIsSettingsOpen(false);
  }, [navigate]);

  const handleGoSettings = useCallback(() => {
    navigate('/main/settings');
    setIsSettingsOpen(false);
  }, [navigate]);

const filteredFriends = useMemo(() => {
  if (!searchQuery.trim()) return friends;
  const query = searchQuery.toLowerCase();
  return friends.filter(f => 
    (f.name && f.name.toLowerCase().includes(query)) || 
    (f.phone && f.phone.includes(query))
  );
}, [friends, searchQuery]);

  const { favorites, normals } = useMemo(() => {
    const favs = filteredFriends.filter(f => f.isFavorite);
    const norms = filteredFriends.filter(f => !f.isFavorite);
    const sortFn = (a: Friend, b: Friend) => a.name.localeCompare(b.name, 'ko');
    return { 
      favorites: favs.sort(sortFn), 
      normals: norms.sort(sortFn) 
    };
  }, [filteredFriends]);

  return (
    <div className="h-full w-full flex flex-col bg-dark-bg text-white">
      
      {step === 'permission' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center mb-6">
            <BookUser className="w-10 h-10 text-brand-DEFAULT" />
          </div>
          <h2 className="text-2xl font-bold mb-4">연락처 동기화</h2>
          <p className="text-[#8E8E93] text-sm leading-relaxed mb-10">
            그레인을 사용하는 친구들을 찾기 위해<br/>연락처 접근 권한이 필요합니다.
          </p>
          <button 
            onClick={handleAllowContacts}
            className="w-full h-14 bg-brand-DEFAULT text-white font-bold rounded-2xl hover:bg-brand-hover transition-all"
          >
            허용하기
          </button>
          <button 
            onClick={() => {
              localStorage.setItem('grayn_contact_permission', 'denied');
              setStep('list');
            }} 
            className="mt-4 text-[#8E8E93] text-sm"
          >
            나중에 할게요
          </button>
        </div>
      )}

      {step === 'complete' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </motion.div>
          <h2 className="text-xl font-bold">동기화 완료</h2>
        </div>
      )}

      {step === 'list' && (
        <>
          <header className="h-14 px-4 flex items-center justify-between bg-dark-bg sticky top-0 z-50 border-b border-[#2C2C2E] shrink-0">
            <h1 className="text-xl font-bold text-white ml-1">친구</h1>
            <div className="flex items-center gap-1 relative">
              <button 
                onClick={() => setIsSearching(!isSearching)} 
                className={`p-2 transition-colors ${isSearching ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
                aria-label="검색"
              >
                <Search className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setShowAddFriendModal(true)} 
                className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
                aria-label="친구 추가"
              >
                <UserPlus className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setShowCreateChatModal(true)} 
                className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
                aria-label="새 채팅"
              >
                <MessageSquarePlus className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                className={`p-2 transition-colors ${isSettingsOpen ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
                aria-label="설정"
              >
                <Settings className="w-6 h-6" />
              </button>

              <AnimatePresence>
                {isSettingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSettingsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      exit={{ opacity: 0, y: -10, scale: 0.95 }} 
                      className="absolute top-10 right-0 w-40 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl shadow-xl z-50 overflow-hidden py-1.5"
                    >
                      <button 
                        onClick={handleGoFriends} 
                        className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#3A3A3C] transition-colors"
                      >
                        친구 관리
                      </button>
                      <div className="h-[1px] bg-[#3A3A3C] mx-3 my-1" />
                      <button 
                        onClick={handleGoSettings} 
                        className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#3A3A3C] transition-colors"
                      >
                        전체 설정
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </header>

          <AnimatePresence>
            {isSearching && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="overflow-hidden px-5 py-2 bg-dark-bg shrink-0"
              >
                <div className="bg-[#2C2C2E] rounded-xl flex items-center px-4 py-2">
                  <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
                  <input 
                    type="text" 
                    placeholder="친구 이름 검색" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none" 
                    autoFocus 
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}>
                      <X className="w-4 h-4 text-[#8E8E93]" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-[50vh] text-[#8E8E93]">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                {!searchQuery && (
                  <div className="px-5">
                    <div 
                      onClick={() => setShowEditProfileModal(true)} 
                      className="py-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-xl px-2 transition-colors"
                    >
                      <div className="w-14 h-14 rounded-[20px] bg-[#3A3A3C] overflow-hidden relative border border-white/5 shadow-sm">
                        {myProfile.avatar ? (
                          <img src={myProfile.avatar} alt="Me" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#8E8E93]">
                            <UserIcon className="w-6 h-6 opacity-50"/>
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-[16px] font-bold">{myProfile.name}</h2>
                        <p className="text-xs text-[#8E8E93] mt-0.5">{myProfile.status || '상태메시지 설정'}</p>
                      </div>
                    </div>
                    <div className="h-[1px] bg-[#2C2C2E] w-full my-2" />
                  </div>
                )}

                {friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[40vh] text-[#8E8E93] px-10 text-center">
                    <UserIcon className="w-12 h-12 opacity-20 mb-4" />
                    <p className="text-sm">등록된 친구가 없습니다.<br/>친구를 추가하거나 동기화해보세요.</p>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    {favorites.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[11px] text-[#636366] font-medium mb-1 px-5 mt-2">즐겨찾기</p>
                        {favorites.map(f => (
                          <FriendItem 
                            key={f.id} 
                            friend={f} 
                            onClick={() => handleFriendClick(f)} // 수정된 핸들러 연결
                            onBlock={() => setBlockTarget(f)} 
                            onDelete={() => handleDeleteClick(f.id)} 
                          />
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] text-[#636366] font-medium mb-1 px-5 mt-2">친구 {normals.length}</p>
                      {normals.map(f => (
                        <FriendItem 
                          key={f.id} 
                          friend={f} 
                          onClick={() => handleFriendClick(f)} // 수정된 핸들러 연결
                          onBlock={() => setBlockTarget(f)} 
                          onDelete={() => handleDeleteClick(f.id)} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {selectedFriend && (
        <ModalBackdrop onClick={() => setSelectedFriend(null)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.9, opacity: 0, y: 20 }} 
            className="relative w-full max-w-[340px] bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl border border-[#2C2C2E]" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => toggleFavorite(selectedFriend.id)} 
              className="absolute top-4 left-4 z-20 p-2 rounded-full hover:bg-black/20"
            >
              <Star className={`w-6 h-6 ${selectedFriend.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-white/70'}`} />
            </button>
            <button 
              onClick={() => setSelectedFriend(null)} 
              className="absolute top-4 right-4 z-20 p-2 bg-black/30 rounded-full text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="h-64 bg-[#2C2C2E]">
              {selectedFriend.bg ? (
                <img src={selectedFriend.bg} className="w-full h-full object-cover" alt="Background" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E]" />
              )}
            </div>
            <div className="px-6 pb-8 -mt-12 relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full border-[3px] border-[#1C1C1E] bg-[#2C2C2E] overflow-hidden shadow-lg mb-4">
                {selectedFriend.avatar ? (
                  <img src={selectedFriend.avatar} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  <UserIcon className="w-10 h-10 opacity-50 m-auto mt-6" />
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{selectedFriend.name}</h3>
              {selectedFriend.status && <p className="text-[#8E8E93] text-sm mb-6">{selectedFriend.status}</p>}
              
              <div className="mb-6 flex flex-col items-center gap-1">
                <div className="text-[10px] text-brand-DEFAULT font-bold tracking-wider">AI SCORE</div>
                <div className="flex items-center gap-2 bg-[#2C2C2E] px-3 py-1 rounded-full border border-[#3A3A3C]">
                  {calculatingScore ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-gray-400" />
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${
                      selectedFriend.friendlyScore > 80 ? 'bg-green-500' : 
                      selectedFriend.friendlyScore > 40 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`} />
                  )}
                  <span className="text-xs font-mono font-bold">
                    {calculatingScore ? '분석 중...' : selectedFriend.friendlyScore}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-6 w-full justify-center">
                <button 
                  onClick={() => handleEnterChat(selectedFriend)} 
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="w-12 h-12 rounded-full bg-[#2C2C2E] group-hover:bg-[#3A3A3C] flex items-center justify-center text-white border border-[#3A3A3C] transition-colors">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-[#E5E5EA]">1:1 채팅</span>
                </button>
              </div>
            </div>
          </motion.div>
        </ModalBackdrop>
      )}

      <EditProfileModal 
        isOpen={showEditProfileModal} 
        onClose={() => setShowEditProfileModal(false)} 
        initialProfile={myProfile} 
        onSave={handleSaveMyProfile} 
      />
      <AddFriendModal 
        isOpen={showAddFriendModal} 
        onClose={() => setShowAddFriendModal(false)} 
        onFriendAdded={fetchFriends} 
      />
      <CreateChatModal 
        isOpen={showCreateChatModal} 
        onClose={() => setShowCreateChatModal(false)} 
        friends={friends} 
      />
      <BlockFriendModal 
        friend={blockTarget} 
        onClose={() => setBlockTarget(null)} 
        onConfirm={handleBlockConfirm} 
      />
      <DeleteFriendModal 
        friend={deleteTarget} 
        onClose={() => setDeleteTarget(null)} 
        onConfirm={handleDeleteConfirm} 
      />
    </div>
  );
}

function FriendItem({ friend, onClick, onBlock, onDelete }: { 
  friend: Friend; 
  onClick: () => void; 
  onBlock: () => void; 
  onDelete: () => void; 
}) {
  const controls = useAnimation();
  const SWIPE_WIDTH = -140; 
  
  const handleDragEnd = async (_: any, info: PanInfo) => { 
    if (info.offset.x < -50) {
      await controls.start({ x: SWIPE_WIDTH }); 
    } else {
      await controls.start({ x: 0 }); 
    }
  };
  
  const scoreColor = friend.friendlyScore >= 80 
    ? 'text-green-500' 
    : friend.friendlyScore >= 40 
    ? 'text-yellow-500' 
    : 'text-[#8E8E93]';
    
  return (
    <div className="relative w-full h-[72px] overflow-hidden border-b border-[#2C2C2E] last:border-none bg-dark-bg">
      <div className="absolute inset-y-0 right-0 flex h-full z-0" style={{ width: `140px` }}>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onBlock(); 
            controls.start({ x: 0 }); 
          }} 
          className="flex-1 h-full bg-[#3A3A3C] flex flex-col items-center justify-center text-[#E5E5EA] active:bg-[#48484A] transition-colors"
        >
          <Ban className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">차단</span>
        </button>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onDelete(); 
            controls.start({ x: 0 }); 
          }} 
          className="flex-1 h-full bg-[#FF203A] flex flex-col items-center justify-center text-white active:bg-red-600 transition-colors"
        >
          <Trash2 className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">삭제</span>
        </button>
      </div>
      <motion.div 
        drag="x" 
        dragConstraints={{ left: SWIPE_WIDTH, right: 0 }} 
        dragElastic={0.1} 
        onDragEnd={handleDragEnd} 
        animate={controls} 
        onClick={onClick} 
        className="relative w-full h-full bg-dark-bg flex items-center px-4 z-10 cursor-pointer active:bg-white/5 transition-colors" 
        style={{ touchAction: 'pan-y' }}
      >
        <div className="w-[48px] h-[48px] rounded-[18px] bg-[#3A3A3C] overflow-hidden flex-shrink-0 relative mr-4 border border-white/5 shadow-sm">
          {friend.avatar ? (
            <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#8E8E93]">
              <UserIcon className="w-6 h-6 opacity-50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[15px] font-medium text-white leading-tight truncate">{friend.name}</h4>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#2C2C2E] ${scoreColor}`}>
              {friend.friendlyScore}°
            </span>
          </div>
          {friend.status && <p className="text-[12px] text-[#8E8E93] mt-0.5 truncate">{friend.status}</p>}
        </div>
      </motion.div>
    </div>
  );
}

function BlockFriendModal({ friend, onClose, onConfirm }: { 
  friend: Friend | null; 
  onClose: () => void; 
  onConfirm: (id: number, options: { blockMessage: boolean, hideProfile: boolean }) => void; 
}) {
  const [blockMessage, setBlockMessage] = useState(true);
  const [hideProfile, setHideProfile] = useState(true);
  
  if (!friend) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        onClick={(e) => e.stopPropagation()} 
        className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]"
      >
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-4 text-center">{friend.name}님을 차단하시겠습니까?</h3>
          <p className="text-xs text-[#8E8E93] text-center mb-6 leading-relaxed">
            차단하면 서로에게 연락할 수 없습니다.<br/>차단 친구 관리에서 해제할 수 있습니다.
          </p>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-[#2C2C2E] rounded-xl cursor-pointer hover:bg-[#3A3A3C] transition-colors">
              <span className="text-sm text-white">메시지 차단</span>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                blockMessage ? 'bg-brand-DEFAULT border-brand-DEFAULT' : 'border-[#636366]'
              }`}>
                {blockMessage && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={blockMessage} 
                onChange={() => setBlockMessage(!blockMessage)} 
              />
            </label>
            <label className="flex items-center justify-between p-3 bg-[#2C2C2E] rounded-xl cursor-pointer hover:bg-[#3A3A3C] transition-colors">
              <span className="text-sm text-white">프로필 비공개</span>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                hideProfile ? 'bg-brand-DEFAULT border-brand-DEFAULT' : 'border-[#636366]'
              }`}>
                {hideProfile && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={hideProfile} 
                onChange={() => setHideProfile(!hideProfile)} 
              />
            </label>
          </div>
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button 
            onClick={onClose} 
            className="flex-1 text-[#8E8E93] font-medium text-[15px] hover:bg-[#2C2C2E] transition-colors border-r border-[#3A3A3C]"
          >
            취소
          </button>
          <button 
            onClick={() => onConfirm(friend.id, { blockMessage, hideProfile })} 
            className="flex-1 text-brand-DEFAULT font-bold text-[15px] hover:bg-[#2C2C2E] transition-colors"
          >
            확인
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteFriendModal({ friend, onClose, onConfirm }: { 
  friend: Friend | null; 
  onClose: () => void; 
  onConfirm: () => void; 
}) {
  if (!friend) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        onClick={(e) => e.stopPropagation()} 
        className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]"
      >
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-[#FF203A]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#FF203A]" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">{friend.name}님을 삭제하시겠습니까?</h3>
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            삭제된 친구는<br/>친구 추가 메뉴에서 다시 추가할 수 있습니다.
          </p>
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button 
            onClick={onClose} 
            className="flex-1 text-[#8E8E93] font-medium text-[15px] hover:bg-[#2C2C2E] transition-colors border-r border-[#3A3A3C]"
          >
            취소
          </button>
          <button 
            onClick={() => onConfirm()} 
            className="flex-1 text-[#FF203A] font-bold text-[15px] hover:bg-[#2C2C2E] transition-colors"
          >
            삭제
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EditProfileModal({ isOpen, onClose, initialProfile, onSave }: { 
  isOpen: boolean; 
  onClose: () => void; 
  initialProfile: MyProfile; 
  onSave: (p: MyProfile) => void 
}) {
  const [profile, setProfile] = useState(initialProfile);
  
  useEffect(() => { 
    if (isOpen) setProfile(initialProfile); 
  }, [isOpen, initialProfile]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      <div className="h-14 flex items-center justify-between px-4 bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <button onClick={onClose}>
          <X className="w-6 h-6 text-white" />
        </button>
        <span className="font-bold text-lg text-white">프로필 편집</span>
        <button 
          onClick={() => onSave(profile)} 
          className="text-brand-DEFAULT font-bold text-base"
        >
          완료
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-dark-bg">
        <div className="relative w-full">
          <div className="h-48 bg-[#2C2C2E] relative cursor-pointer group">
            {profile.bg ? (
              <img src={profile.bg} className="w-full h-full object-cover opacity-70" alt="bg" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#8E8E93] gap-2">
                <ImageIcon className="w-6 h-6"/>
                <span>배경 사진</span>
              </div>
            )}
          </div>
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-20">
            <div className="w-28 h-28 rounded-full border-4 border-dark-bg bg-[#3A3A3C] overflow-hidden cursor-pointer group relative">
              {profile.avatar ? (
                <img src={profile.avatar} className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" alt="avatar" />
              ) : (
                <UserIcon className="w-10 h-10 text-[#8E8E93] m-auto mt-7" />
              )}
            </div>
          </div>
        </div>
        <div className="mt-16 px-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">닉네임</label>
            <input 
              type="text" 
              value={profile.name} 
              onChange={(e) => setProfile({ ...profile, name: e.target.value })} 
              className="w-full bg-[#2C2C2E] rounded-xl px-4 py-3 text-white focus:outline-none" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">상태 메시지</label>
            <input 
              type="text" 
              value={profile.status} 
              onChange={(e) => setProfile({ ...profile, status: e.target.value })} 
              className="w-full bg-[#2C2C2E] rounded-xl px-4 py-3 text-white focus:outline-none" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AddFriendModal({ isOpen, onClose, onFriendAdded }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onFriendAdded?: () => void 
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async () => { 
    if (!phone.trim()) {
      toast.error('전화번호를 입력해주세요.');
      return;
    }
    
    setIsSearching(true);
    const loadingToast = toast.loading('그레인 사용자를 찾는 중...');

    try { 
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast.dismiss(loadingToast);
        return;
      }

      const cleanPhone = phone.replace(/[^0-9]/g, '');

      let query = supabase
        .from('users')
        .select('id, name, avatar, status_message, phone')
        .eq('phone', cleanPhone);

      if (name.trim()) {
        query = query.ilike('name', `%${name.trim()}%`);
      }

      const { data: users, error: searchError } = await query;

      if (searchError) throw searchError;

      if (!users || users.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('해당 전화번호로 가입된 사용자를 찾을 수 없습니다.');
        setShowResults(false);
        return;
      }

      const filtered = users.filter(u => u.id !== session.user.id);

      if (filtered.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('본인은 친구로 추가할 수 없습니다.');
        setShowResults(false);
        return;
      }

      toast.dismiss(loadingToast);
      setSearchResults(filtered);
      setShowResults(true);

    } catch (error: any) { 
      console.error("Search Error:", error);
      toast.dismiss(loadingToast);
      toast.error('검색에 실패했습니다.');
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (targetUser: any) => {
    const loadingToast = toast.loading('친구 추가 중...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast.dismiss(loadingToast);
        return;
      }

      const { data: alreadyFriend } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('friend_user_id', targetUser.id)
        .maybeSingle();

      if (alreadyFriend) {
        toast.dismiss(loadingToast);
        toast.error('이미 등록된 친구입니다.');
        return;
      }

      const { error: insertError } = await supabase
        .from('friends')
        .insert([{ 
          user_id: session.user.id,
          friend_user_id: targetUser.id,
          name: targetUser.name, 
          phone: targetUser.phone, 
          avatar: targetUser.avatar, 
          status: targetUser.status_message, 
          friendly_score: 50, 
          is_favorite: false, 
          is_blocked: false 
        }]); 

      if (insertError) throw insertError;

      toast.dismiss(loadingToast);
      toast.success(`${targetUser.name}님을 친구로 추가했습니다.`); 
      onFriendAdded?.(); 
      onClose(); 
    } catch (error: any) { 
      console.error("Friend Add Error:", error);
      toast.dismiss(loadingToast);
      toast.error('친구 추가에 실패했습니다.');
    }
  };

  useEffect(() => { 
    if (isOpen) { 
      setName(''); 
      setPhone(''); 
      setShowResults(false);
      setSearchResults([]);
    } 
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <ModalBackdrop onClick={onClose}>
      <div className="w-full max-w-[360px] bg-[#1C1C1E] rounded-3xl p-6 border border-[#2C2C2E] shadow-2xl max-h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-4">친구 추가</h3>
        
        {!showResults ? (
          <>
            <p className="text-xs text-[#8E8E93] mb-4 leading-relaxed">
              가입 시 등록한 전화번호로 친구를 찾습니다.<br/>
              이름은 선택사항입니다.
            </p>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="이름 (선택)" 
              className="w-full bg-[#2C2C2E] rounded-xl px-4 py-3 text-white mb-3 focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT" 
            />
            <input 
              type="tel" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="휴대폰 번호 (필수, - 없이 입력)" 
              className="w-full bg-[#2C2C2E] rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT" 
            />
            <button 
              onClick={handleSearch} 
              disabled={isSearching || !phone.trim()} 
              className="w-full h-12 bg-brand-DEFAULT text-white font-bold rounded-xl hover:bg-brand-hover disabled:opacity-50 transition-all"
            >
              {isSearching ? '검색 중...' : '검색하기'}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-[#8E8E93] mb-4">
              {searchResults.length}명의 사용자를 찾았습니다.
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
              {searchResults.map(user => (
                <div 
                  key={user.id}
                  className="flex items-center gap-3 p-3 bg-[#2C2C2E] rounded-xl hover:bg-[#3A3A3C] transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-[#3A3A3C] overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <UserIcon className="w-6 h-6 m-auto mt-3 text-[#8E8E93] opacity-50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{user.name}</p>
                    <p className="text-xs text-[#8E8E93]">{user.phone}</p>
                  </div>
                  <button
                    onClick={() => handleAddFriend(user)}
                    className="px-4 py-2 bg-brand-DEFAULT text-white text-sm font-bold rounded-lg hover:bg-brand-hover transition-colors"
                  >
                    추가
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setShowResults(false);
                setSearchResults([]);
              }}
              className="w-full h-12 bg-[#2C2C2E] text-white font-bold rounded-xl hover:bg-[#3A3A3C] transition-all"
            >
              다시 검색
            </button>
          </>
        )}
      </div>
    </ModalBackdrop>
  );
}

function CreateChatModal({ isOpen, onClose, friends }: { 
  isOpen: boolean; 
  onClose: () => void; 
  friends: Friend[]; 
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState<ChatStepType>('select-type');
  const [chatType, setChatType] = useState<'individual' | 'group'>('individual');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { 
    if (isOpen) {
      setStep('select-type');
      setSelectedIds([]);
      setSearchTerm(''); 
    }
  }, [isOpen]);

  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) return friends;
    const query = searchTerm.toLowerCase();
    return friends.filter(f => f.name.toLowerCase().includes(query));
  }, [friends, searchTerm]);

  const toggleSelection = useCallback((id: number) => { 
    if (chatType === 'individual') { 
      setSelectedIds([id]); 
    } else { 
      setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
      ); 
    } 
  }, [chatType]);

  const handleCreate = useCallback(async () => { 
    if (selectedIds.length === 0 || !user?.id) {
      toast.error('상대를 선택해주세요.');
      return;
    }
    
    const loadingToast = toast.loading('채팅방 생성 중...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast.dismiss(loadingToast);
        toast.error('로그인이 필요합니다.');
        return;
      }

      const isGroup = selectedIds.length > 1;
      let roomId = "";

      if (!isGroup) {
        const friendId = friends.find(f => f.id === selectedIds[0])?.friend_user_id;
        if (!friendId) {
          toast.dismiss(loadingToast);
          toast.error('친구 정보를 찾을 수 없습니다.');
          return;
        }

        roomId = [session.user.id, friendId].sort().join("_");

        const { data: existingRoom } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('id', roomId)
          .maybeSingle();

        if (existingRoom) {
          toast.dismiss(loadingToast);
          toast.success('기존 채팅방으로 이동합니다.');
          onClose();
          navigate(`/chat/room/${roomId}`);
          return;
        }

        const { error: roomError } = await supabase
          .from('chat_rooms')
          .insert([{ 
            id: roomId,
            title: friends.find(f => f.id === selectedIds[0])?.name || '새 대화',
            type: 'individual',
            created_by: session.user.id,
            last_message: '대화를 시작해보세요!',
            members_count: 2
          }]);

        if (roomError && roomError.code !== '23505') {
          throw roomError;
        }

        const { error: membersError } = await supabase
          .from('room_members')
          .upsert([
            { room_id: roomId, user_id: session.user.id, unread_count: 0 },
            { room_id: roomId, user_id: friendId, unread_count: 0 }
          ], {
            onConflict: 'room_id,user_id',
            ignoreDuplicates: true
          });

        if (membersError && membersError.code !== '23505') {
          throw membersError;
        }

      } else {
        roomId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        const title = `나 외 ${selectedIds.length}명`;

        const { error: roomError } = await supabase
          .from('chat_rooms')
          .insert([{ 
            id: roomId,
            title: title,
            type: 'group',
            created_by: session.user.id,
            last_message: '대화를 시작해보세요!',
            members_count: selectedIds.length + 1
          }]);

        if (roomError) throw roomError;

        const memberInserts = [
          { room_id: roomId, user_id: session.user.id, unread_count: 0 }
        ];

        selectedIds.forEach(selected => {
          const friendId = friends.find(f => f.id === selected)?.friend_user_id;
          if (friendId) {
            memberInserts.push({ room_id: roomId, user_id: friendId, unread_count: 0 });
          }
        });

        const { error: membersError } = await supabase
          .from('room_members')
          .insert(memberInserts);

        if (membersError) throw membersError;
      }

      toast.dismiss(loadingToast);
      toast.success(`${isGroup ? '그룹' : '1:1'} 채팅방이 생성되었습니다.`);
      onClose(); 
      navigate(`/chat/room/${roomId}`);
    } catch (e: any) {
      console.error('Create Chat Error:', e);
      toast.dismiss(loadingToast);
      toast.error('채팅방 생성에 실패했습니다.');
    }
  }, [selectedIds, user, friends, navigate, onClose]);

  if (!isOpen) return null;
  
  return (
    <ModalBackdrop onClick={onClose}>
      <motion.div 
        initial={{ y: 50, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-w-[340px] bg-[#1C1C1E] rounded-2xl overflow-hidden border border-[#2C2C2E] shadow-2xl h-[520px] flex flex-col"
      >
        <div className="h-14 bg-[#2C2C2E] flex items-center justify-between px-4 shrink-0">
          {step === 'select-friends' ? (
            <button onClick={() => setStep('select-type')}>
              <ChevronRight className="w-6 h-6 rotate-180 text-white" />
            </button>
          ) : (
            <span />
          )}
          <h3 className="text-white font-bold text-base">
            {step === 'select-type' ? '새로운 채팅' : chatType === 'group' ? '대화 상대 초대' : '대화 상대 선택'}
          </h3>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-[#8E8E93]" />
          </button>
        </div>

        {step === 'select-type' && (
          <div className="flex-1 p-6 flex flex-col gap-4 justify-center">
            <button 
              onClick={() => { 
                setChatType('individual'); 
                setStep('select-friends'); 
                setSelectedIds([]); 
              }} 
              className="flex items-center gap-4 p-5 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-brand-DEFAULT/10 flex items-center justify-center text-brand-DEFAULT group-hover:bg-brand-DEFAULT group-hover:text-white transition-colors">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">1:1 채팅</h4>
                <p className="text-xs text-[#8E8E93]">친구 한 명과 대화합니다.</p>
              </div>
            </button>
            <button 
              onClick={() => { 
                setChatType('group'); 
                setStep('select-friends'); 
                setSelectedIds([]); 
              }} 
              className="flex items-center gap-4 p-5 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-brand-DEFAULT/10 flex items-center justify-center text-brand-DEFAULT group-hover:bg-brand-DEFAULT group-hover:text-white transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">그룹 채팅</h4>
                <p className="text-xs text-[#8E8E93]">여러 친구와 함께 대화합니다.</p>
              </div>
            </button>
          </div>
        )}

        {step === 'select-friends' && (
          <>
            <div className="px-4 py-2 bg-[#1C1C1E] shrink-0">
              <div className="bg-[#2C2C2E] rounded-xl flex items-center px-3 py-2 border border-transparent focus-within:border-brand-DEFAULT/50 transition-all">
                <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
                <input 
                  type="text" 
                  placeholder="이름 검색" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none"
/>
{searchTerm && (
<button onClick={() => setSearchTerm('')}>
<X className="w-4 h-4 text-[#8E8E93]" />
</button>
)}
</div>
</div>

<div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {filteredFriends.length > 0 ? (
            filteredFriends.map(friend => { 
              const isSelected = selectedIds.includes(friend.id); 
              return (
                <div 
                  key={friend.id} 
                  onClick={() => toggleSelection(friend.id)} 
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-brand-DEFAULT/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                    {friend.avatar ? (
                      <img src={friend.avatar} className="w-full h-full object-cover" alt="Avatar"/>
                    ) : (
                      <UserIcon className="w-5 h-5 m-auto mt-2.5 opacity-50"/>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isSelected ? 'text-brand-DEFAULT' : 'text-white'}`}>
                      {friend.name}
                    </p>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="text-brand-DEFAULT w-5 h-5 fill-brand-DEFAULT/20" />
                  ) : (
                    <Circle className="text-[#3A3A3C] w-5 h-5" />
                  )}
                </div>
              ) 
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-[#636366]">
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-[#2C2C2E] shrink-0">
          <button 
            onClick={handleCreate} 
            disabled={selectedIds.length === 0} 
            className={`w-full h-12 rounded-xl font-bold text-white transition-all ${
              selectedIds.length > 0 
                ? 'bg-brand-DEFAULT hover:bg-brand-hover shadow-lg' 
                : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'
            }`}
          >
            {selectedIds.length}명과 시작하기
          </button>
        </div>
      </>
    )}
  </motion.div>
</ModalBackdrop>

);
}
function ModalBackdrop({ children, onClick }: {
children: React.ReactNode;
onClick?: () => void
}) {
return (
<div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClick}>
<motion.div
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
className="absolute inset-0 bg-black/70 backdrop-blur-sm"
/>
<div className="relative z-10 w-full flex justify-center pointer-events-none">
<div className="pointer-events-auto w-full flex justify-center">
{children}
</div>
</div>
</div>
);
}