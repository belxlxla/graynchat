import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import {
  Search, Settings, Star, MessageCircle, X, User as UserIcon,
  UserPlus, MessageSquarePlus, CheckCircle2, Circle,
  Image as ImageIcon, Trash2, RefreshCw,
  ChevronRight, Users, Ban, AlertTriangle, BookUser,
  Phone, ArrowLeft, HelpCircle, Sparkles, Camera, PenLine
} from 'lucide-react';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';
import {
  calculateFriendlyScore,
  updateFriendlyScoreInDB,
  getScoreColor,
  getScoreLabel,
  SCORE_EXPLANATION,
} from './friendlyScoreUtils';

// ── Types ────────────────────────────────────────────────────
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
interface MyProfile { name: string; status: string; avatar: string | null; bg: string | null; }
interface ScoreBreakdown {
  total: number;
  messageCount: number;
  recency: number;
  frequency: number;
  balance: number;
  duration: number;
  consistency: number;
}
type StepType     = 'permission' | 'complete' | 'list';
type ChatStepType = 'select-type' | 'select-friends';

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg:      '#212121',
  surface: '#2c2c2c',
  card:    '#333333',
  border:  'rgba(255,255,255,0.06)',
  muted:   'rgba(255,255,255,0.28)',
  red:     '#FF203A',
  sheet:   '#1d1d1d',
};

// ── Image Utils ──────────────────────────────────────────────
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(URL.createObjectURL(blob!)), 'image/jpeg'));
}

// ── Contacts utils ────────────────────────────────────────────
const requestContactsPermission = async (): Promise<boolean> => {
  try {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      // @ts-ignore
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      if (contacts?.length > 0) {
        localStorage.setItem('grayn_synced_contacts',
          JSON.stringify(contacts.map((c: any) => ({ name: c.name?.[0] || '', phone: c.tel?.[0] || '' }))));
        return true;
      }
      return false;
    }
    // @ts-ignore
    if (window.webkit?.messageHandlers?.contacts) {
      return new Promise(resolve => {
        // @ts-ignore
        window.webkit.messageHandlers.contacts.postMessage({ action: 'request' });
        // @ts-ignore
        window.handleContactsResponse = resolve;
      });
    }
    // @ts-ignore
    if (window.Android?.requestContacts) {
      // @ts-ignore
      return (await window.Android.requestContacts()) === 'granted';
    }
    toast('이 브라우저는 연락처 동기화를 지원하지 않습니다.', { icon: '⚠️' });
    return false;
  } catch (e) { console.error(e); return false; }
};

const getSyncedContacts = (): Array<{ name: string; phone: string }> => {
  try { return JSON.parse(localStorage.getItem('grayn_synced_contacts') || '[]'); }
  catch { return []; }
};

// ════════════════════════════════════════════════════════════
export default function FriendsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep]                               = useState<StepType>('list');
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [friends, setFriends]                         = useState<Friend[]>([]);
  const [isLoading, setIsLoading]                     = useState(true);
  const [myProfile, setMyProfile]                     = useState<MyProfile>({ name: '사용자', status: '', avatar: null, bg: null });
  const [selectedFriend, setSelectedFriend]           = useState<Friend | null>(null);
  const [showAddFriendModal, setShowAddFriendModal]   = useState(false);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [blockTarget, setBlockTarget]                 = useState<Friend | null>(null);
  const [deleteTarget, setDeleteTarget]               = useState<Friend | null>(null);
  const [isSearching, setIsSearching]                 = useState(false);
  const [searchQuery, setSearchQuery]                 = useState('');
  const [isSettingsOpen, setIsSettingsOpen]           = useState(false);
  const [calculatingScore, setCalculatingScore]       = useState(false);
  const [scoreBreakdown, setScoreBreakdown]           = useState<ScoreBreakdown | null>(null);
  const [showScoreInfo, setShowScoreInfo]             = useState(false);

  // ── Permission check ──────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setIsCheckingPermission(false); return; }
    const check = async () => {
      try {
        const { data } = await supabase.from('users').select('contact_permission')
          .eq('id', user.id).maybeSingle();
        const p = data?.contact_permission;
        setStep(p === 'granted' || p === 'denied' ? 'list' : 'permission');
      } catch { setStep('list'); }
      finally { setIsCheckingPermission(false); }
    };
    check();
  }, [user?.id]);

  const handleAllowContacts = useCallback(async () => {
    if (!user?.id) return;
    const t = toast.loading('연락처 권한 요청 중...');
    const granted = await requestContactsPermission();
    toast.dismiss(t);
    if (granted) {
      await supabase.from('users').update({ contact_permission: 'granted' }).eq('id', user.id);
      toast.success('연락처 동기화 완료!');
      setStep('complete');
      await syncContactsToFriends();
      setTimeout(() => setStep('list'), 1500);
    } else {
      await supabase.from('users').update({ contact_permission: 'denied' }).eq('id', user.id);
      toast.error('연락처 권한이 거부되었습니다.');
      setStep('list');
    }
  }, [user?.id]);

  const handleSkipContacts = useCallback(async () => {
    if (!user?.id) return;
    await supabase.from('users').update({ contact_permission: 'denied' }).eq('id', user.id);
    setStep('list');
  }, [user?.id]);

  const syncContactsToFriends = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const contacts = getSyncedContacts();
      if (!contacts.length) return;
      const tasks = contacts.map(async c => {
        if (!c.phone) return;
        const { data: u } = await supabase.from('users')
          .select('id,name,avatar,phone,status_message')
          .eq('phone', c.phone).neq('id', session.user.id).maybeSingle();
        if (!u) return;
        const { data: ex } = await supabase.from('friends').select('id')
          .eq('user_id', session.user.id).eq('friend_user_id', u.id).maybeSingle();
        if (!ex) await supabase.from('friends').insert({
          user_id: session.user.id, friend_user_id: u.id, name: u.name, phone: u.phone,
          avatar: u.avatar, status: u.status_message, friendly_score: 10, is_favorite: false, is_blocked: false,
        });
      });
      await Promise.all(tasks);
      if (tasks.length) toast.success(`${tasks.length}명의 그레인 사용자를 찾았습니다!`);
    } catch (e) { console.error(e); }
  };

  const fetchMyProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { data } = await supabase.from('users')
      .select('name,avatar,bg_image,status_message').eq('id', session.user.id).maybeSingle();
    setMyProfile({
      name:   data?.name || session.user.user_metadata?.name || session.user.user_metadata?.full_name || '사용자',
      status: data?.status_message || '',
      avatar: data?.avatar || null,
      bg:     data?.bg_image || null,
    });
  }, []);

  const fetchFriends = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data, error } = await supabase.from('friends').select('*')
        .eq('user_id', session.user.id)
        .or('is_blocked.eq.false,is_blocked.is.null')
        .order('name', { ascending: true });
      if (error) throw error;
      setFriends((data || []).map((item: any) => ({
        id: item.id, friend_user_id: item.friend_user_id || '',
        name: item.name, phone: item.phone, status: item.status,
        avatar: item.avatar, bg: item.bg,
        isFavorite: item.is_favorite || false, friendlyScore: item.friendly_score || 10,
      })));
    } catch { toast.error('친구 목록을 불러오는데 실패했습니다.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchMyProfile();
    if (step === 'list' && !isCheckingPermission) fetchFriends();
  }, [step, isCheckingPermission, fetchFriends, fetchMyProfile]);

  const handleSaveMyProfile = useCallback(async (p: MyProfile) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      await supabase.from('users').update({
        name: p.name, status_message: p.status, avatar: p.avatar, bg_image: p.bg,
      }).eq('id', session.user.id);
      setMyProfile(p); setShowEditProfileModal(false); toast.success('프로필 업데이트 완료');
    } catch { toast.error('수정에 실패했습니다.'); }
  }, []);

  const toggleFavorite = useCallback(async (id: number) => {
    const target = friends.find(f => f.id === id); if (!target) return;
    const ns = !target.isFavorite;
    setFriends(prev => prev.map(f => f.id === id ? { ...f, isFavorite: ns } : f));
    if (selectedFriend?.id === id) setSelectedFriend(prev => prev ? { ...prev, isFavorite: ns } : null);
    try { await supabase.from('friends').update({ is_favorite: ns }).eq('id', id); }
    catch { setFriends(prev => prev.map(f => f.id === id ? { ...f, isFavorite: !ns } : f)); }
  }, [friends, selectedFriend]);

  // ── AI 점수 계산 (고도화) ─────────────────────────────────
  const analyzeFriendlyScore = useCallback(async (friend: Friend) => {
    if (!friend.friend_user_id || !user?.id) return;
    setCalculatingScore(true);
    try {
      const breakdown = await calculateFriendlyScore(user.id, friend.friend_user_id, friend.id);
      setScoreBreakdown(breakdown);
      setSelectedFriend(prev => prev ? { ...prev, friendlyScore: breakdown.total } : null);
      setFriends(prev => prev.map(f => f.id === friend.id ? { ...f, friendlyScore: breakdown.total } : f));
      await updateFriendlyScoreInDB(friend.id, breakdown.total);
    } catch (e) { console.error(e); }
    finally { setCalculatingScore(false); }
  }, [user?.id]);

  const handleFriendClick = (f: Friend) => {
    setSelectedFriend(f);
    setScoreBreakdown(null);
    analyzeFriendlyScore(f);
  };

  const handleEnterChat = useCallback(async (friend: Friend) => {
    const t = toast.loading('채팅방 연결 중...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || !friend.friend_user_id) {
        toast.dismiss(t); toast.error('정보를 불러올 수 없습니다.'); return;
      }
      const roomId = [session.user.id, friend.friend_user_id].sort().join('_');
      const { data: ex } = await supabase.from('chat_rooms').select('id').eq('id', roomId).maybeSingle();
      if (!ex) {
        const { error: re } = await supabase.from('chat_rooms').insert([{
          id: roomId, title: friend.name, type: 'individual',
          created_by: session.user.id, last_message: '새로운 대화를 시작해보세요!', members_count: 2,
        }]);
        if (re && re.code !== '23505') throw re;
        await supabase.from('room_members').upsert([
          { room_id: roomId, user_id: session.user.id, unread_count: 0 },
          { room_id: roomId, user_id: friend.friend_user_id, unread_count: 0 },
        ], { onConflict: 'room_id,user_id', ignoreDuplicates: true });
      }
      toast.dismiss(t); setSelectedFriend(null); navigate(`/chat/room/${roomId}`);
    } catch { toast.dismiss(t); toast.error('채팅방 입장에 실패했습니다.'); }
  }, [navigate]);

  const handleDeleteClick  = useCallback((id: number) => {
    setDeleteTarget(friends.find(f => f.id === id) || null);
  }, [friends]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      await supabase.from('friends').delete().match({ id: deleteTarget.id, user_id: session.user.id });
      setFriends(prev => prev.filter(f => f.id !== deleteTarget.id));
      setDeleteTarget(null); toast.success('친구가 삭제되었습니다.');
    } catch { toast.error('삭제에 실패했습니다.'); }
  }, [deleteTarget]);

  const handleBlockConfirm = useCallback(async (id: number, opts: { blockMessage: boolean; hideProfile: boolean }) => {
    const t = toast.loading('차단 처리 중...');
    try {
      await supabase.from('friends').update({ is_blocked: true, hide_profile: opts.hideProfile }).eq('id', id);
      setFriends(prev => prev.filter(f => f.id !== id));
      setSelectedFriend(null); setBlockTarget(null);
      toast.dismiss(t); toast.success('차단되었습니다.');
    } catch { toast.dismiss(t); toast.error('차단 처리에 실패했습니다.'); }
  }, []);

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter(f => f.name?.toLowerCase().includes(q) || f.phone?.includes(q));
  }, [friends, searchQuery]);

  const { favorites, normals } = useMemo(() => {
    const sort = (a: Friend, b: Friend) => a.name.localeCompare(b.name, 'ko');
    return {
      favorites: filteredFriends.filter(f => f.isFavorite).sort(sort),
      normals:   filteredFriends.filter(f => !f.isFavorite).sort(sort),
    };
  }, [filteredFriends]);

  // ── Loading state ─────────────────────────────────────────
  if (isCheckingPermission) {
    return (
      <div className="h-full w-full flex items-center justify-center" style={{ background: T.bg }}>
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: T.red }} />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col relative" style={{ background: T.bg, color: '#fff' }}>

      {/* ── Permission screen ───────────────────────────── */}
      {step === 'permission' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center relative z-10">
          <div className="w-[68px] h-[68px] rounded-[22px] flex items-center justify-center mb-7"
            style={{ background: `${T.red}12`, border: `1.5px solid ${T.red}22` }}>
            <BookUser className="w-7 h-7" style={{ color: T.red }} />
          </div>
          <h2 className="text-[22px] font-bold tracking-tight mb-3">연락처 동기화</h2>
          <p className="text-[13px] leading-6 mb-10" style={{ color: T.muted }}>
            그레인을 사용하는 친구들을 찾기 위해<br />연락처 접근 권한이 필요합니다.
          </p>
          <button onClick={handleAllowContacts}
            className="w-full h-[52px] rounded-2xl text-white font-bold text-[15px] mb-3"
            style={{ background: T.red }}>
            허용하기
          </button>
          <button onClick={handleSkipContacts} className="text-[13px] py-2" style={{ color: T.muted }}>
            나중에 할게요
          </button>
        </div>
      )}

      {/* ── Sync complete ────────────────────────────────── */}
      {step === 'complete' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 relative z-10">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-[68px] h-[68px] rounded-[22px] flex items-center justify-center"
            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </motion.div>
          <p className="text-[17px] font-bold">동기화 완료</p>
        </div>
      )}

      {/* ── Main list view ───────────────────────────────── */}
      {step === 'list' && (
        <>
          {/* Header */}
          <header className="h-[54px] flex items-center justify-between px-4 shrink-0 relative z-20"
            style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
            <span className="text-[18px] font-bold tracking-tight pl-1">친구</span>

            <div className="flex items-center gap-0">
              {[
                { Icon: Search,            active: isSearching,    onClick: () => setIsSearching(s => !s) },
                { Icon: UserPlus,          active: false,           onClick: () => setShowAddFriendModal(true) },
                { Icon: MessageSquarePlus, active: false,           onClick: () => setShowCreateChatModal(true) },
                { Icon: Settings,          active: isSettingsOpen,  onClick: () => setIsSettingsOpen(s => !s) },
              ].map(({ Icon, active, onClick }, i) => (
                <button key={i} onClick={onClick}
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                  style={{ color: active ? T.red : 'rgba(255,255,255,0.7)' }}>
                  <Icon className="w-[21px] h-[21px]" />
                </button>
              ))}

              {/* Settings dropdown */}
              <AnimatePresence>
                {isSettingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      className="absolute top-12 right-2 w-[136px] z-50 rounded-2xl overflow-hidden py-1"
                      style={{ background: '#2a2a2a', border: `1px solid ${T.border}`, boxShadow: '0 8px 28px rgba(0,0,0,0.55)' }}>
                      <button onClick={() => { navigate('/settings/friends'); setIsSettingsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-white/5 transition-colors"
                        style={{ color: 'rgba(255,255,255,0.72)' }}>
                        친구 관리
                      </button>
                      <div className="h-[1px] mx-3" style={{ background: T.border }} />
                      <button onClick={() => { navigate('/main/settings'); setIsSettingsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-white/5 transition-colors"
                        style={{ color: 'rgba(255,255,255,0.72)' }}>
                        전체 설정
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </header>

          {/* Search bar */}
          <AnimatePresence>
            {isSearching && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden shrink-0 relative z-20"
                style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <Search className="w-4 h-4 shrink-0" style={{ color: T.muted }} />
                    <input autoFocus type="text" placeholder="이름으로 검색"
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent flex-1 text-[14px] focus:outline-none"
                      style={{ color: '#fff' }} />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')}>
                        <X className="w-3.5 h-3.5" style={{ color: T.muted }} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto pb-6 relative z-10" style={{ scrollbarWidth: 'none' }}>
            {isLoading ? (
              <div className="flex items-center justify-center h-[50vh]">
                <RefreshCw className="w-5 h-5 animate-spin" style={{ color: T.red }} />
              </div>
            ) : (
              <>
                {/* My profile */}
                {!searchQuery && (
                  <div className="px-4 pt-4 pb-1">
                    <div onClick={() => setShowEditProfileModal(true)}
                      className="flex items-center gap-3.5 px-3 py-3 rounded-2xl cursor-pointer transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]">
                      <div className="relative shrink-0">
                        <Av src={myProfile.avatar} size={56} r={20} ring={{ w: 2, c: 'rgba(255,255,255,0.1)' }} />
                        <span className="absolute -bottom-0.5 -right-0.5 w-[13px] h-[13px] rounded-full bg-green-500"
                          style={{ border: `2.5px solid ${T.bg}` }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-bold truncate text-white drop-shadow-md">{myProfile.name}</p>
                        <p className="text-[12px] mt-0.5 truncate text-white/60">
                          {myProfile.status || '상태메시지를 입력해보세요'}
                        </p>
                      </div>
                    </div>
                    <div className="h-[1px] mt-2 mx-2" style={{ background: 'rgba(255,255,255,0.1)' }} />
                  </div>
                )}

                {/* Empty */}
                {friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[44vh] gap-3 px-10 text-center">
                    <UserIcon className="w-10 h-10" style={{ opacity: 0.1 }} />
                    <p className="text-[13px] leading-6" style={{ color: T.muted }}>
                      아직 친구가 없습니다.<br />친구를 추가하거나 연락처를 동기화해보세요.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    {favorites.length > 0 && (
                      <>
                        <SectionLabel text={`즐겨찾기 ${favorites.length}`} />
                        {favorites.map(f => (
                          <FriendRow key={f.id} friend={f}
                            onClick={() => handleFriendClick(f)}
                            onBlock={() => setBlockTarget(f)}
                            onDelete={() => handleDeleteClick(f.id)} />
                        ))}
                      </>
                    )}
                    <SectionLabel text={`친구 ${normals.length}`} />
                    {normals.map(f => (
                      <FriendRow key={f.id} friend={f}
                        onClick={() => handleFriendClick(f)}
                        onBlock={() => setBlockTarget(f)}
                        onDelete={() => handleDeleteClick(f.id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Friend profile bottom sheet ───────────────────── */}
      <AnimatePresence>
        {selectedFriend && (
          <Sheet onClose={() => setSelectedFriend(null)} maxH="92dvh">
            {/* BG strip - [수정됨] 내가 설정한 배경화면을 모달 뒤에 은은하게 표시 */}
            {myProfile.bg && (
              <div className="absolute inset-0 z-[-1] overflow-hidden rounded-t-[24px]">
                 <img src={myProfile.bg} alt="" className="w-full h-full object-cover opacity-20 blur-sm" />
                 <div className="absolute inset-0 bg-[#1d1d1d]/80" />
              </div>
            )}
            
            <div className="relative h-20 shrink-0 overflow-hidden rounded-t-[24px]">
              {selectedFriend.bg
                ? <img src={selectedFriend.bg} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full" style={{ background: T.surface }} />
              }
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(29,29,29,0.97))' }} />
              <button onClick={() => toggleFavorite(selectedFriend.id)}
                className="absolute top-3 left-4 w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.4)' }}>
                <Star className={`w-4 h-4 ${selectedFriend.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
              </button>
              <button onClick={() => setSelectedFriend(null)}
                className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.4)' }}>
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Info */}
            <div className="px-5 pt-0 pb-28 flex flex-col items-center text-center -mt-10 relative z-10">
              <div className="mb-3.5" style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.6))' }}>
                <Av src={selectedFriend.avatar} size={76} r={22} ring={{ w: 3, c: T.sheet }} />
              </div>
              <h3 className="text-[19px] font-bold mb-0.5">{selectedFriend.name}</h3>
              {selectedFriend.status && (
                <p className="text-[13px] mb-4" style={{ color: T.muted }}>{selectedFriend.status}</p>
              )}

              {/* AI Score */}
              <div className="w-full max-w-[280px] px-4 py-3.5 rounded-2xl mb-2"
                style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                      style={{ background: `${T.red}15` }}>
                      <Sparkles className="w-3 h-3" style={{ color: T.red }} />
                      <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: T.red }}>AI 친밀도</span>
                    </div>
                    <button onClick={() => setShowScoreInfo(true)}
                      className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                      <HelpCircle className="w-3.5 h-3.5" style={{ color: T.muted }} />
                    </button>
                  </div>
                  {calculatingScore && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: T.muted }} />
                  )}
                </div>

                <div className="flex items-baseline justify-center gap-1.5 mb-1">
                  <span className="text-[32px] font-bold font-mono tabular-nums"
                    style={{ color: getScoreColor(selectedFriend.friendlyScore) }}>
                    {calculatingScore ? '...' : selectedFriend.friendlyScore}
                  </span>
                  <span className="text-[16px] font-medium" style={{ color: T.muted }}>점</span>
                </div>
                <p className="text-[12px] font-medium"
                  style={{ color: getScoreColor(selectedFriend.friendlyScore) }}>
                  {getScoreLabel(selectedFriend.friendlyScore)}
                </p>

                {/* Breakdown */}
                {scoreBreakdown && !calculatingScore && (
                  <div className="mt-4 pt-3 space-y-2"
                    style={{ borderTop: `1px solid ${T.border}` }}>
                    {[
                      { label: '메시지', value: scoreBreakdown.messageCount },
                      { label: '최근성', value: scoreBreakdown.recency },
                      { label: '빈도', value: scoreBreakdown.frequency },
                      { label: '균형', value: scoreBreakdown.balance },
                      { label: '기간', value: scoreBreakdown.duration },
                      { label: '지속성', value: scoreBreakdown.consistency },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1 rounded-full overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{
                                width: `${value}%`,
                                background: getScoreColor(value),
                              }} />
                          </div>
                          <span className="text-[11px] font-mono w-7 text-right tabular-nums"
                            style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA */}
              <button onClick={() => handleEnterChat(selectedFriend)}
                className="w-full h-[50px] rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2.5 mt-3"
                style={{ background: T.red }}>
                <MessageCircle className="w-[18px] h-[18px]" />
                1:1 채팅 시작
              </button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      {/* ── Score info modal ──────────────────────────────── */}
      <ScoreInfoModal isOpen={showScoreInfo} onClose={() => setShowScoreInfo(false)} />

      {/* ── All modals ────────────────────────────────────── */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        initialProfile={myProfile}
        onSave={handleSaveMyProfile} />
      <AddFriendModal
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        onFriendAdded={fetchFriends} />
      <CreateChatModal
        isOpen={showCreateChatModal}
        onClose={() => setShowCreateChatModal(false)}
        friends={friends} />
      <BlockFriendModal
        friend={blockTarget}
        onClose={() => setBlockTarget(null)}
        onConfirm={handleBlockConfirm} />
      <DeleteFriendModal
        friend={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm} />
    </div>
  );
}

// ── Av (Avatar) ───────────────────────────────────────────────
function Av({ src, size, r, ring }: {
  src: string | null; size: number; r: number;
  ring?: { w: number; c: string };
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: r, overflow: 'hidden', flexShrink: 0,
      background: T.card,
      border: ring ? `${ring.w}px solid ${ring.c}` : `1px solid ${T.border}`,
    }}>
      {src
        ? <img src={src} className="w-full h-full object-cover" alt="" />
        : <div className="w-full h-full flex items-center justify-center">
            <UserIcon style={{ width: size * 0.38, height: size * 0.38, color: T.muted }} />
          </div>
      }
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.08em] uppercase px-5 pt-4 pb-1.5"
      style={{ color: 'rgba(255,255,255,0.25)' }}>
      {text}
    </p>
  );
}

// ── Friend row ────────────────────────────────────────────────
function FriendRow({ friend, onClick, onBlock, onDelete }: {
  friend: Friend; onClick: () => void; onBlock: () => void; onDelete: () => void;
}) {
  const controls = useAnimation();
  const SWIPE    = -128;

  const handleDragEnd = async (_: any, info: PanInfo) => {
    await controls.start({ x: info.offset.x < -44 ? SWIPE : 0 });
  };

  const scoreColor = getScoreColor(friend.friendlyScore);

  return (
    <div className="relative h-[66px] overflow-hidden" style={{ background: T.bg }}>
      {/* Action strip */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: SWIPE * -1, zIndex: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); onBlock(); controls.start({ x: 0 }); }}
          className="flex-1 flex flex-col items-center justify-center gap-1"
          style={{ background: '#333' }}>
          <Ban className="w-[15px] h-[15px]" style={{ color: 'rgba(255,255,255,0.45)' }} />
          <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>차단</span>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); controls.start({ x: 0 }); }}
          className="flex-1 flex flex-col items-center justify-center gap-1"
          style={{ background: T.red }}>
          <Trash2 className="w-[15px] h-[15px] text-white" />
          <span className="text-[9px] font-medium text-white">삭제</span>
        </button>
      </div>

      {/* Draggable row */}
      <motion.div
        drag="x" dragConstraints={{ left: SWIPE, right: 0 }} dragElastic={0.05}
        onDragEnd={handleDragEnd} animate={controls}
        onClick={onClick}
        className="absolute inset-0 flex items-center px-4 cursor-pointer transition-colors active:bg-white/[0.04]"
        style={{ background: T.bg, touchAction: 'pan-y', zIndex: 10 }}>
        <Av src={friend.avatar} size={44} r={15} />
        <div className="flex-1 min-w-0 ml-3.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold truncate text-white/90">{friend.name}</span>
            <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: scoreColor }}>
              {friend.friendlyScore}°
            </span>
          </div>
          {friend.status && (
            <p className="text-[12px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {friend.status}
            </p>
          )}
        </div>
      </motion.div>

      {/* Divider */}
      <div className="absolute bottom-0 left-[60px] right-0 h-[1px] z-20" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  );
}

// ── Sheet (bottom sheet wrapper) ──────────────────────────────
function Sheet({ children, onClose, maxH = 'auto' }: {
  children: React.ReactNode; onClose: () => void; maxH?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)' }} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 30, mass: 0.85 }}
        className="relative z-10 w-full flex flex-col"
        style={{
          background: T.sheet, maxHeight: maxH,
          borderRadius: '24px 24px 0 0',
          borderTop: `1px solid ${T.border}`,
        }}
        onClick={e => e.stopPropagation()}>
        {children}
      </motion.div>
    </div>
  );
}

// ── Score info modal ──────────────────────────────────────────
function ScoreInfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <Sheet onClose={onClose} maxH="85dvh">
        <div className="px-5 pt-3 pb-12 overflow-y-auto">
          {/* Title */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: T.red }} />
              <h3 className="text-[18px] font-bold">{SCORE_EXPLANATION.title}</h3>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: T.surface }}>
              <X className="w-4 h-4" style={{ color: T.muted }} />
            </button>
          </div>

          <p className="text-[13px] leading-relaxed mb-6" style={{ color: T.muted }}>
            {SCORE_EXPLANATION.description}
          </p>

          {/* Components */}
          <div className="mb-6">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              점수 구성 요소
            </p>
            <div className="space-y-2">
              {SCORE_EXPLANATION.components.map(({ label, weight, desc }) => (
                <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: T.surface }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold">{label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${T.red}15`, color: T.red }}>
                        {weight}%
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Levels */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              점수 레벨
            </p>
            <div className="space-y-1.5">
              {SCORE_EXPLANATION.levels.map(({ min, label, color, emoji }) => (
                <div key={label} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: T.surface }}>
                  <span className="text-lg">{emoji}</span>
                  <div className="flex-1">
                    <span className="text-[13px] font-semibold">{label}</span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums" style={{ color }}>
                    {min}+
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    </AnimatePresence>
  );
}

// ── Block friend modal ────────────────────────────────────────
function BlockFriendModal({ friend, onClose, onConfirm }: {
  friend: Friend | null; onClose: () => void;
  onConfirm: (id: number, opts: { blockMessage: boolean; hideProfile: boolean }) => void;
}) {
  const [blockMessage, setBlockMessage] = useState(true);
  const [hideProfile,  setHideProfile]  = useState(true);
  if (!friend) return null;
  return (
    <AnimatePresence>
      <Sheet onClose={onClose}>
        <div className="px-5 pt-3 pb-10">
          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center mx-auto mb-5"
            style={{ background: `${T.red}12`, border: `1px solid ${T.red}22` }}>
            <Ban className="w-5 h-5" style={{ color: T.red }} />
          </div>
          <h3 className="text-[17px] font-bold text-center mb-1.5">{friend.name}님 차단</h3>
          <p className="text-[12px] text-center leading-relaxed mb-6" style={{ color: T.muted }}>
            차단하면 서로에게 연락할 수 없습니다.<br />차단 목록에서 언제든 해제할 수 있어요.
          </p>
          <div className="space-y-2 mb-6">
            {[
              { label: '메시지 차단',  v: blockMessage, fn: () => setBlockMessage(p => !p) },
              { label: '프로필 비공개', v: hideProfile,  fn: () => setHideProfile(p => !p) },
            ].map(({ label, v, fn }) => (
              <button key={label} onClick={fn}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl"
                style={{ background: T.surface, border: `1px solid ${v ? `${T.red}25` : T.border}` }}>
                <span className="text-[14px]">{label}</span>
                <div className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: v ? T.red : 'transparent', border: `1.5px solid ${v ? T.red : T.muted}` }}>
                  {v && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 h-[50px] rounded-2xl text-[14px] font-semibold"
              style={{ background: T.surface, color: T.muted }}>취소</button>
            <button onClick={() => onConfirm(friend.id, { blockMessage, hideProfile })}
              className="flex-1 h-[50px] rounded-2xl text-[14px] font-bold text-white"
              style={{ background: T.red }}>차단하기</button>
          </div>
        </div>
      </Sheet>
    </AnimatePresence>
  );
}

// ── Delete friend modal ───────────────────────────────────────
function DeleteFriendModal({ friend, onClose, onConfirm }: {
  friend: Friend | null; onClose: () => void; onConfirm: () => void;
}) {
  if (!friend) return null;
  return (
    <AnimatePresence>
      <Sheet onClose={onClose}>
        <div className="px-5 pt-3 pb-10 text-center">
          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center mx-auto mb-5"
            style={{ background: `${T.red}12`, border: `1px solid ${T.red}22` }}>
            <AlertTriangle className="w-5 h-5" style={{ color: T.red }} />
          </div>
          <h3 className="text-[17px] font-bold mb-2">{friend.name}님을 삭제할까요?</h3>
          <p className="text-[13px] leading-relaxed mb-7" style={{ color: T.muted }}>
            친구 추가에서 다시 추가할 수 있습니다.
          </p>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 h-[50px] rounded-2xl text-[14px] font-semibold"
              style={{ background: T.surface, color: T.muted }}>취소</button>
            <button onClick={onConfirm} className="flex-1 h-[50px] rounded-2xl text-[14px] font-bold text-white"
              style={{ background: T.red }}>삭제하기</button>
          </div>
        </div>
      </Sheet>
    </AnimatePresence>
  );
}

// ── Edit profile (full-screen) ────────────────────────────────
function EditProfileModal({ isOpen, onClose, initialProfile, onSave }: {
  isOpen: boolean; onClose: () => void; initialProfile: MyProfile; onSave: (p: MyProfile) => void;
}) {
  // ── States for editing
  const [p, setP] = useState(initialProfile);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [currentImageType, setCurrentImageType] = useState<'avatar' | 'bg'>('avatar');
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => { if (isOpen) setP(initialProfile); }, [isOpen, initialProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'bg') => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        setTempImageSrc(reader.result as string);
        setCurrentImageType(type);
        setIsCropOpen(true);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropSave = async () => {
    if (!tempImageSrc || !croppedAreaPixels || !user) return;
    try {
      const croppedImageUrl = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      // Upload to storage
      const res = await fetch(croppedImageUrl);
      const blob = await res.blob();
      const filePath = `${user.id}/${currentImageType}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, blob);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(filePath);

      setP(prev => ({ ...prev, [currentImageType === 'avatar' ? 'avatar' : 'bg']: publicUrl }));
      setIsCropOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('이미지 업로드 실패');
    }
  };

  const handleResetImage = async (type: 'avatar' | 'bg') => {
    setP(prev => ({ ...prev, [type === 'avatar' ? 'avatar' : 'bg']: null }));
    toast.success('기본 이미지로 설정되었습니다.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: T.bg }}>
      {/* ── Image Cropper Overlay ── */}
      <AnimatePresence>
        {isCropOpen && tempImageSrc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-5 bg-black/80 backdrop-blur-md z-10 sticky top-0">
              <button onClick={() => setIsCropOpen(false)} className="p-2 -ml-2 text-white">
                <X className="w-7 h-7" />
              </button>
              <span className="font-bold text-lg text-white">이미지 편집</span>
              <button
                onClick={handleCropSave}
                className="px-5 py-2 rounded-full font-black text-sm text-white shadow-lg active:scale-95 transition-all"
                style={{ background: '#FF203A' }}
              >
                완료
              </button>
            </div>
            <div className="relative flex-1 bg-black">
              <Cropper
                image={tempImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={currentImageType === 'avatar' ? 1 : 16 / 9}
                onCropChange={setCrop}
                onCropComplete={(_, p) => setCroppedAreaPixels(p)}
                onZoomChange={setZoom}
                cropShape={currentImageType === 'avatar' ? 'round' : 'rect'}
                showGrid={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="h-[54px] flex items-center justify-between px-4 shrink-0"
        style={{ borderBottom: `1px solid ${T.border}` }}>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ color: T.muted }}>
          <X className="w-5 h-5" />
        </button>
        <span className="text-[16px] font-bold">프로필 편집</span>
        <button onClick={() => onSave(p)}
          className="px-3 py-1.5 rounded-xl text-[14px] font-bold"
          style={{ color: T.red, background: `${T.red}12` }}>
          완료
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* BG Section - Clickable wrapper */}
        <div 
           className="relative h-44 group overflow-hidden cursor-pointer" 
           style={{ background: T.surface }}
           onClick={() => bgInputRef.current?.click()} // Main area triggers upload
        >
          {p.bg
            ? <img src={p.bg} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt="" />
            : <div className="w-full h-full flex items-center justify-center gap-2" style={{ color: T.muted }}>
                <ImageIcon className="w-5 h-5" />
                <span className="text-[13px]">배경 사진 추가</span>
              </div>
          }
          
          {/* Controls Overlay - Visible on hover/tap */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              {/* Pill Container - Stop propagation to separate actions */}
              <div 
                className="flex items-center gap-1 p-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 pointer-events-auto shadow-xl transform scale-95 group-hover:scale-100 transition-transform"
                onClick={e => e.stopPropagation()}
              >
                  {/* Change Button */}
                  <button 
                    onClick={() => bgInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                  >
                     <Camera className="w-4 h-4 text-[#FF203A]" />
                     <span className="text-[12px] font-medium text-white">변경</span>
                  </button>

                  {/* Divider */}
                  {p.bg && <div className="w-[1px] h-4 bg-white/20" />}

                  {/* Remove Button */}
                  {p.bg && (
                    <button 
                      onClick={() => handleResetImage('bg')}
                      className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                    >
                       <X className="w-4 h-4" />
                    </button>
                  )}
              </div>
          </div>
          <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'bg')} onClick={e => e.stopPropagation()} />
        </div>

        {/* Avatar Section */}
        <div className="flex justify-center -mt-10 mb-7 relative z-10">
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <div className="transition-transform group-hover:scale-[1.02]" style={{ filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.55))' }}>
              <Av src={p.avatar} size={88} r={28} ring={{ w: 3, c: T.bg }} />
            </div>
            
            {/* Avatar Edit Controls */}
            <div className="absolute inset-0 rounded-[28px] bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                 <div 
                    className="flex items-center gap-1 p-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 pointer-events-auto shadow-lg"
                    onClick={e => e.stopPropagation()}
                 >
                     <button onClick={() => avatarInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <Camera className="w-4 h-4 text-[#FF203A]" />
                     </button>
                     
                     {p.avatar && (
                       <>
                         <div className="w-[1px] h-4 bg-white/20" />
                         <button onClick={() => handleResetImage('avatar')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-4 h-4 text-white/80" />
                         </button>
                       </>
                     )}
                 </div>
            </div>
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} onClick={e => e.stopPropagation()} />
          </div>
        </div>

        {/* Fields */}
        <div className="px-5 space-y-4 pb-12">
          {[
            { label: '닉네임',     key: 'name'   as const, v: p.name },
            { label: '상태 메시지', key: 'status' as const, v: p.status },
          ].map(({ label, key, v }) => (
            <div key={key}>
              <p className="text-[11px] font-semibold tracking-[0.08em] uppercase px-1 mb-2"
                style={{ color: 'rgba(255,255,255,0.18)' }}>{label}</p>
              <div className="relative group">
                <input type="text" value={v}
                  onChange={e => setP(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full px-4 py-3.5 rounded-2xl text-[14px] focus:outline-none transition-all"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, color: '#fff' }} />
                <PenLine className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#FF203A] transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Add friend modal ──────────────────────────────────────────
function AddFriendModal({ isOpen, onClose, onFriendAdded }: {
  isOpen: boolean; onClose: () => void; onFriendAdded?: () => void;
}) {
  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [isBusy,      setIsBusy]      = useState(false);
  const [results,     setResults]     = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (isOpen) { setName(''); setPhone(''); setResults([]); setShowResults(false); }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!phone.trim()) { toast.error('전화번호를 입력해주세요.'); return; }
    setIsBusy(true);
    const t = toast.loading('사용자 검색 중...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { toast.dismiss(t); return; }
      const clean = phone.replace(/[^0-9]/g, '');
      let q = supabase.from('users').select('id,name,avatar,status_message,phone').eq('phone', clean);
      if (name.trim()) q = q.ilike('name', `%${name.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      toast.dismiss(t);
      const filtered = (data || []).filter((u: any) => u.id !== session.user.id);
      if (!filtered.length) { toast.error('사용자를 찾을 수 없습니다.'); return; }
      setResults(filtered); setShowResults(true);
    } catch { toast.dismiss(t); toast.error('검색에 실패했습니다.'); }
    finally { setIsBusy(false); }
  };

  const handleAdd = async (u: any) => {
    const t = toast.loading('친구 추가 중...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { toast.dismiss(t); return; }
      const { data: dup } = await supabase.from('friends').select('id')
        .eq('user_id', session.user.id).eq('friend_user_id', u.id).maybeSingle();
      if (dup) { toast.dismiss(t); toast.error('이미 등록된 친구입니다.'); return; }
      await supabase.from('friends').insert([{
        user_id: session.user.id, friend_user_id: u.id, name: u.name, phone: u.phone,
        avatar: u.avatar, status: u.status_message, friendly_score: 10, is_favorite: false, is_blocked: false,
      }]);
      toast.dismiss(t); toast.success(`${u.name}님을 추가했습니다.`);
      onFriendAdded?.(); onClose();
    } catch { toast.dismiss(t); toast.error('친구 추가에 실패했습니다.'); }
  };

  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <Sheet onClose={onClose}>
        <div className="px-5 pt-3 pb-24">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[18px] font-bold">
              {showResults ? `${results.length}명 찾음` : '친구 추가'}
            </h3>
            {showResults && (
              <button onClick={() => { setShowResults(false); setResults([]); }}
                className="flex items-center gap-1 text-[13px]" style={{ color: T.muted }}>
                <ArrowLeft className="w-4 h-4" />
                다시 검색
              </button>
            )}
          </div>

          {!showResults ? (
            <>
              <p className="text-[12px] leading-relaxed mb-5" style={{ color: T.muted }}>
                가입 시 등록한 전화번호로 친구를 찾습니다.
              </p>
              <div className="space-y-2.5 mb-5">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <UserIcon className="w-4 h-4 shrink-0" style={{ color: T.muted }} />
                  <input type="text" placeholder="이름 (선택)" value={name}
                    onChange={e => setName(e.target.value)}
                    className="bg-transparent flex-1 text-[14px] focus:outline-none" style={{ color: '#fff' }} />
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <Phone className="w-4 h-4 shrink-0" style={{ color: T.muted }} />
                  <input type="tel" placeholder="전화번호 필수 (- 없이)" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="bg-transparent flex-1 text-[14px] focus:outline-none" style={{ color: '#fff' }} />
                </div>
              </div>
              <button onClick={handleSearch} disabled={isBusy || !phone.trim()}
                className="w-full h-[50px] rounded-2xl font-bold text-[15px] text-white transition-all"
                style={{ background: phone.trim() ? T.red : T.surface, opacity: phone.trim() ? 1 : 0.4 }}>
                {isBusy ? '검색 중...' : '검색하기'}
              </button>
            </>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {results.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <Av src={u.avatar} size={42} r={14} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate">{u.name}</p>
                    <p className="text-[11px] truncate" style={{ color: T.muted }}>{u.phone}</p>
                  </div>
                  <button onClick={() => handleAdd(u)}
                    className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold text-white shrink-0"
                    style={{ background: T.red }}>
                    추가
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Sheet>
    </AnimatePresence>
  );
}

// ── Create chat modal ─────────────────────────────────────────
function CreateChatModal({ isOpen, onClose, friends }: {
  isOpen: boolean; onClose: () => void; friends: Friend[];
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step,        setStep]       = useState<ChatStepType>('select-type');
  const [chatType,    setChatType]   = useState<'individual' | 'group'>('individual');
  const [selectedIds, setSelected]   = useState<number[]>([]);
  const [search,      setSearch]     = useState('');

  useEffect(() => {
    if (isOpen) { setStep('select-type'); setSelected([]); setSearch(''); }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return friends;
    return friends.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  }, [friends, search]);

  const toggle = useCallback((id: number) => {
    setSelected(prev =>
      chatType === 'individual' ? [id] : prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, [chatType]);

  const handleCreate = useCallback(async () => {
    if (!selectedIds.length || !user?.id) { toast.error('상대를 선택해주세요.'); return; }
    const t = toast.loading('채팅방 생성 중...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { toast.dismiss(t); return; }
      const isGroup = selectedIds.length > 1;
      let roomId = '';

      if (!isGroup) {
        const fid = friends.find(f => f.id === selectedIds[0])?.friend_user_id;
        if (!fid) { toast.dismiss(t); toast.error('친구 정보를 찾을 수 없습니다.'); return; }
        roomId = [session.user.id, fid].sort().join('_');
        const { data: ex } = await supabase.from('chat_rooms').select('id').eq('id', roomId).maybeSingle();
        if (ex) { toast.dismiss(t); toast.success('기존 채팅방으로 이동합니다.'); onClose(); navigate(`/chat/room/${roomId}`); return; }
        const { error: re } = await supabase.from('chat_rooms').insert([{
          id: roomId, title: friends.find(f => f.id === selectedIds[0])?.name || '새 대화',
          type: 'individual', created_by: session.user.id, last_message: '대화를 시작해보세요!', members_count: 2,
        }]);
        if (re && re.code !== '23505') throw re;
        await supabase.from('room_members').upsert([
          { room_id: roomId, user_id: session.user.id, unread_count: 0 },
          { room_id: roomId, user_id: fid, unread_count: 0 },
        ], { onConflict: 'room_id,user_id', ignoreDuplicates: true });
      } else {
        roomId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const { error: re } = await supabase.from('chat_rooms').insert([{
          id: roomId, title: `나 외 ${selectedIds.length}명`, type: 'group',
          created_by: session.user.id, last_message: '대화를 시작해보세요!', members_count: selectedIds.length + 1,
        }]);
        if (re) throw re;
        const members = [{ room_id: roomId, user_id: session.user.id, unread_count: 0 }];
        selectedIds.forEach(id => {
          const fid = friends.find(f => f.id === id)?.friend_user_id;
          if (fid) members.push({ room_id: roomId, user_id: fid, unread_count: 0 });
        });
        await supabase.from('room_members').insert(members);
      }
      toast.dismiss(t); toast.success(`${isGroup ? '그룹' : '1:1'} 채팅방이 생성되었습니다.`);
      onClose(); navigate(`/chat/room/${roomId}`);
    } catch { toast.dismiss(t); toast.error('채팅방 생성에 실패했습니다.'); }
  }, [selectedIds, user, friends, navigate, onClose]);

  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <Sheet onClose={onClose} maxH="88dvh">
        <div className="flex flex-col" style={{ maxHeight: '88dvh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0">
            {step === 'select-friends'
              ? <button onClick={() => setStep('select-type')}
                  className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ color: T.muted }}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              : <span className="w-8" />
            }
            <span className="text-[16px] font-bold">
              {step === 'select-type' ? '새로운 채팅' : chatType === 'group' ? '멤버 초대' : '대화 상대'}
            </span>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: T.surface }}>
              <X className="w-3.5 h-3.5" style={{ color: T.muted }} />
            </button>
          </div>

          {step === 'select-type' && (
            <div className="px-5 pb-28 space-y-3">
              {[
                { type: 'individual' as const, Icon: UserIcon, label: '1:1 채팅', desc: '친구 한 명과 대화합니다' },
                { type: 'group'      as const, Icon: Users,    label: '그룹 채팅', desc: '여러 친구와 함께 대화합니다' },
              ].map(({ type, Icon, label, desc }) => (
                <button key={type}
                  onClick={() => { setChatType(type); setStep('select-friends'); setSelected([]); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left"
                  style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{ background: `${T.red}12`, color: T.red }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-semibold">{label}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: T.muted }}>{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: T.muted }} />
                </button>
              ))}
            </div>
          )}

          {step === 'select-friends' && (
            <>
              {/* Search */}
              <div className="px-5 pb-3 shrink-0">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                  style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <Search className="w-4 h-4 shrink-0" style={{ color: T.muted }} />
                  <input type="text" placeholder="이름 검색" value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-transparent flex-1 text-[13px] focus:outline-none" style={{ color: '#fff' }} />
                  {search && (
                    <button onClick={() => setSearch('')}>
                      <X className="w-3.5 h-3.5" style={{ color: T.muted }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Friend list */}
              <div className="flex-1 overflow-y-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
                {filtered.length === 0
                  ? <div className="flex items-center justify-center h-28 text-[13px]" style={{ color: T.muted }}>
                      검색 결과가 없습니다
                    </div>
                  : filtered.map(f => {
                    const sel = selectedIds.includes(f.id);
                    return (
                      <div key={f.id} onClick={() => toggle(f.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer mb-1 transition-colors"
                        style={{
                          background: sel ? `${T.red}10` : 'transparent',
                          border: `1px solid ${sel ? `${T.red}22` : 'transparent'}`,
                        }}>
                        <Av src={f.avatar} size={40} r={13} />
                        <span className="flex-1 text-[14px] font-medium truncate"
                          style={{ color: sel ? T.red : 'rgba(255,255,255,0.8)' }}>
                          {f.name}
                        </span>
                        {sel
                          ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: T.red }} />
                          : <Circle      className="w-5 h-5 shrink-0" style={{ color: 'rgba(255,255,255,0.12)' }} />
                        }
                      </div>
                    );
                  })
                }
              </div>

              {/* CTA */}
              <div className="px-5 pt-3 pb-28 shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
                <button onClick={handleCreate} disabled={!selectedIds.length}
                  className="w-full h-[50px] rounded-2xl font-bold text-[15px] text-white mt-1 transition-all"
                  style={{ background: selectedIds.length ? T.red : T.surface, opacity: selectedIds.length ? 1 : 0.4 }}>
                  {selectedIds.length > 0 ? `${selectedIds.length}명과 시작하기` : '대화 상대를 선택하세요'}
                </button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    </AnimatePresence>
  );
}