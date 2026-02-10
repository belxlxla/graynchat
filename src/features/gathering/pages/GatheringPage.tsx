import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, LayoutGrid, Plus, Search,
  Lock, Users, Heart, MessageCircle,
  Eye, Flame, X, Loader2, AlertCircle, RefreshCw,
  ChevronRight, ArrowLeft, User, Sparkles, Zap, Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

type GatheringTab = 'chat' | 'board';

const CHAT_CATEGORIES = ['전체', '일상', '게임', '음악', '스터디', '운동', '여행', '맛집', '기타'];
const BOARD_CATEGORIES = ['전체', '일상', '질문', '정보', '유머', '감동', '고민'];

interface GatheringRoom {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: string;
  is_locked: boolean;
  max_participants: number;
  participant_count: number;
  thumbnail_color: string;
  created_at: string;
  host_name?: string;
  is_active?: boolean;
}

interface GatheringPost {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  content: string;
  category: string;
  image_urls: string[];
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
}

// ── 유틸리티: 시간 포맷 ────────────────────────────────────
const getTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
};

// ── 나가기 확인 모달 ────────────────────────────────────────
function ExitConfirmModal({ onConfirm, onCancel }: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 8 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative z-10 w-full max-w-[300px] rounded-[24px] overflow-hidden bg-[#1C1C1E] border border-white/10 shadow-2xl"
      >
        <div className="px-6 pt-8 pb-6 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-[#FF203A]/10 border border-[#FF203A]/20">
            <ArrowLeft className="w-6 h-6 text-[#FF203A]" />
          </div>
          <p className="text-[10px] tracking-[0.15em] font-bold uppercase mb-2 text-white/30">
            Grayn Gathering
          </p>
          <h3 className="text-[17px] font-bold text-white/90 mb-2">
            게더링을 나갈까요?
          </h3>
          <p className="text-[13px] leading-relaxed text-white/50">
            채팅 메인화면으로 이동합니다.
          </p>
        </div>
        <div className="flex border-t border-white/10">
          <motion.button
            whileTap={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            onClick={onCancel}
            className="flex-1 py-4 text-[14px] text-white/50 border-r border-white/10 font-medium"
          >
            머무르기
          </motion.button>
          <motion.button
            whileTap={{ backgroundColor: 'rgba(255,32,58,0.1)' }}
            onClick={onConfirm}
            className="flex-1 py-4 text-[14px] text-[#FF203A] font-bold"
          >
            나가기
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ── 비밀번호 모달 ────────────────────────────────────────────
function PasswordModal({ room, onConfirm, onClose }: {
  room: GatheringRoom;
  onConfirm: (pw: string) => void;
  onClose: () => void;
}) {
  const [pw, setPw] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%', opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className="relative z-10 w-full max-w-sm sm:rounded-[28px] rounded-t-[28px] bg-[#1C1C1E] border-t sm:border border-white/10 p-6 pb-10 shadow-2xl"
      >
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-6 sm:hidden" />
        
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#FF203A]/10 flex items-center justify-center mx-auto mb-3 text-[#FF203A]">
            <Lock className="w-5 h-5" />
          </div>
          <p className="text-[11px] tracking-wider text-[#FF203A] font-bold uppercase mb-1">Private Room</p>
          <h3 className="text-[18px] font-bold text-white mb-1">{room.title}</h3>
          <p className="text-[13px] text-white/40">입장을 위해 비밀번호를 입력해주세요.</p>
        </div>

        <input
          type="password" value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm(pw)}
          placeholder="비밀번호"
          className="w-full rounded-2xl px-4 py-4 text-[16px] text-center focus:outline-none mb-4 transition-all placeholder-white/20 bg-[#111] border border-white/10 text-white focus:border-[#FF203A]/50"
          autoFocus
        />
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onConfirm(pw)}
          className="w-full py-4 rounded-2xl text-[14px] font-bold text-white bg-[#FF203A] shadow-lg shadow-[#FF203A]/20"
        >
          입장하기
        </motion.button>
      </motion.div>
    </div>
  );
}

// ── 게더링 챗 탭 (리스트형 -> 카드형 개선) ─────────────────
function GatheringChatTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<GatheringRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [selectedRoom, setSelectedRoom] = useState<GatheringRoom | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => setIsLoading(false), 5000);
    fetchRooms();

    const channel = supabase.channel('gathering_rooms_list_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gathering_rooms' }, (payload) => {
          if (payload.eventType === 'DELETE') setRooms((prev) => prev.filter((r) => r.id !== payload.old.id));
          else if (payload.eventType === 'INSERT') fetchRooms();
          else if (payload.eventType === 'UPDATE') setRooms((prev) => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } as GatheringRoom : r));
      })
      .subscribe();

    return () => { 
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        supabase.removeChannel(channel);
    };
  }, []);

  const fetchRooms = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.from('gathering_rooms').select('*').eq('is_active', true).order('participant_count', { ascending: false });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (error) { if (error.code !== 'PGRST116') console.error(error); setRooms([]); return; }
      
      const list = data || [];
      if (list.length === 0) { setRooms([]); setIsLoading(false); return; }
      
      const hostIds = [...new Set(list.map((r) => r.host_id))].filter(Boolean);
      let userMap = new Map<string, string>();
      if (hostIds.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', hostIds);
        userMap = new Map(usersData?.map((u) => [u.id, u.name]) || []);
      }
      setRooms(list.map((r) => ({ ...r, host_name: userMap.get(r.host_id) || '알 수 없음' })));
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error(err);
      setRooms([]);
    } finally { setIsLoading(false); }
  };

  const handleJoinRoom = async (room: GatheringRoom, password?: string) => {
    if (!user) return toast.error('로그인이 필요합니다.');
    if (isJoining) return;
    setIsJoining(true);
    try {
      if (room.is_locked && password !== undefined) {
        const { data } = await supabase.from('gathering_rooms').select('password').eq('id', room.id).single();
        if (data?.password !== password) { toast.error('비밀번호가 틀렸습니다.'); return; }
      }
      const { data: existing } = await supabase.from('gathering_room_members').select('id').eq('room_id', room.id).eq('user_id', user.id).maybeSingle();
      if (!existing) await supabase.from('gathering_room_members').insert({ room_id: room.id, user_id: user.id });
      setSelectedRoom(null);
      navigate(`/gathering/chat/${room.id}`);
    } catch { toast.error('입장에 실패했습니다.'); }
    finally { setIsJoining(false); }
  };

  const filtered = rooms.filter((r) => {
    const matchCat = activeCategory === '전체' || r.category === activeCategory;
    const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Intro Section */}
      <div className="px-5 pt-2 pb-6">
        <div className="mb-4">
            <h2 className="text-[22px] font-bold text-white leading-tight">
                취향이 맞는<br/>친구들을 만나보세요 <span className="text-[#FF203A]">.</span>
            </h2>
            <p className="text-[13px] text-white/40 mt-2">
                실시간으로 소통하며 새로운 인연을 만들어보세요.
            </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3 bg-[#1C1C1E] border border-white/5 focus-within:border-[#FF203A]/50 transition-colors">
          <Search className="w-4 h-4 shrink-0 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="관심사나 제목으로 검색해보세요"
            className="bg-transparent text-[14px] w-full focus:outline-none placeholder-white/20 text-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X className="w-4 h-4 text-white/30" />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="px-5 pb-2 flex gap-2 overflow-x-auto custom-scrollbar">
        {CHAT_CATEGORIES.map((cat) => (
          <motion.button
            key={cat}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap border ${
              activeCategory === cat
                ? 'bg-white text-black border-white'
                : 'bg-[#1C1C1E] text-white/40 border-white/5 hover:border-white/20'
            }`}
          >
            {cat}
          </motion.button>
        ))}
      </div>

      {/* List */}
      <div className="px-5 py-4 space-y-3 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-white/30 text-[13px]">
            개설된 채팅방이 없습니다.<br/>새로운 모임을 시작해보세요!
          </div>
        ) : (
          filtered.map((room, idx) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
                <button
                    onClick={() => room.is_locked ? setSelectedRoom(room) : handleJoinRoom(room)}
                    className="w-full bg-[#1C1C1E] border border-white/5 rounded-[20px] p-4 text-left active:scale-[0.98] transition-transform flex items-start gap-4"
                >
                    <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-[20px] font-bold shrink-0"
                         style={{ background: `${room.thumbnail_color || '#FF203A'}15`, color: room.thumbnail_color || '#FF203A' }}>
                        {room.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            {room.is_locked && <Lock className="w-3 h-3 text-[#FF203A]" />}
                            <span className="text-[12px] text-[#FF203A] font-medium bg-[#FF203A]/10 px-1.5 rounded-[4px]">{room.category}</span>
                            <span className="text-[11px] text-white/30">• {getTimeAgo(room.created_at)}</span>
                        </div>
                        <h3 className="text-[15px] font-bold text-white/90 truncate mb-1">{room.title}</h3>
                        <p className="text-[13px] text-white/40 truncate">{room.description || '대화에 참여해보세요!'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-white/40 bg-white/5 px-2 py-1 rounded-lg">
                            <Users className="w-3 h-3" />
                            <span className="text-[11px] font-medium">{room.participant_count}</span>
                        </div>
                    </div>
                </button>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {selectedRoom && (
          <PasswordModal room={selectedRoom} onConfirm={(pw) => handleJoinRoom(selectedRoom, pw)} onClose={() => setSelectedRoom(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 게더링 보드 탭 (당근 동네생활 스타일 개선) ────────────────
function GatheringBoardTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<GatheringPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [showMyPostsOnly, setShowMyPostsOnly] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => setIsLoading(false), 5000);
    fetchPosts();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('gathering_posts').select('*').order('created_at', { ascending: false }).limit(50);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (error) { if (error.code !== 'PGRST116') console.error(error); setPosts([]); return; }
      
      const list = data || [];
      const sortedList = list.sort((a, b) => {
        const isMyA = a.author_id === user?.id ? 1 : 0;
        const isMyB = b.author_id === user?.id ? 1 : 0;
        return isMyB - isMyA;
      });
      setPosts(sortedList);
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPosts([]);
    } finally { setIsLoading(false); }
  };

  const filtered = showMyPostsOnly
    ? posts.filter(p => p.author_id === user?.id)
    : (activeCategory === '전체' ? posts : posts.filter(p => p.category === activeCategory));

  return (
    <div className="flex-1 overflow-y-auto">
        {/* Intro */}
        <div className="px-5 pt-2 pb-6">
            <div className="mb-4">
                <h2 className="text-[22px] font-bold text-white leading-tight">
                    이웃들과 나누는<br/>소소한 이야기 <span className="text-[#FF203A]">.</span>
                </h2>
                <p className="text-[13px] text-white/40 mt-2">
                    궁금한 점이나 일상을 공유하고 공감을 얻어보세요.
                </p>
            </div>
            
            {/* Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowMyPostsOnly(!showMyPostsOnly)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all shrink-0 ${
                        showMyPostsOnly ? 'bg-[#FF203A] border-[#FF203A] text-white' : 'bg-[#1C1C1E] border-white/10 text-white/60'
                    }`}
                >
                    <User className="w-3.5 h-3.5" /> 내 글
                </motion.button>
                <div className="w-[1px] h-4 bg-white/10 shrink-0 mx-1" />
                {!showMyPostsOnly && BOARD_CATEGORIES.map((cat) => (
                    <motion.button
                        key={cat}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all shrink-0 ${
                            activeCategory === cat ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/10'
                        }`}
                    >
                        {cat}
                    </motion.button>
                ))}
            </div>
        </div>

        {/* Post List */}
        <div className="pb-24">
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
            ) : filtered.length === 0 ? (
                <div className="py-20 text-center text-white/30 text-[13px]">
                    게시글이 없습니다.<br/>첫 번째 이야기를 들려주세요!
                </div>
            ) : (
                <div className="divide-y divide-white/5">
                    {filtered.map((post, idx) => {
                        const isMyPost = post.author_id === user?.id;
                        const hasImage = post.image_urls && post.image_urls.length > 0;
                        
                        return (
                            <motion.button
                                key={post.id}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => navigate(`/gathering/post/${post.id}`)}
                                className="w-full text-left px-5 py-5 active:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[11px] font-bold bg-[#2C2C2E] text-white/70 px-1.5 py-0.5 rounded-[4px]">{post.category}</span>
                                    {isMyPost && <span className="text-[10px] font-bold text-[#111] bg-[#FF203A] px-1.5 py-0.5 rounded-[4px]">MY</span>}
                                    <span className="text-[11px] text-white/30">{getTimeAgo(post.created_at)}</span>
                                </div>

                                <div className="flex justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-[16px] font-bold text-white/90 mb-1.5 leading-snug line-clamp-2">{post.title}</h3>
                                        <p className="text-[14px] text-white/50 line-clamp-2 leading-relaxed">{post.content}</p>
                                    </div>
                                    {hasImage && (
                                        <div className="w-[72px] h-[72px] rounded-xl bg-[#2C2C2E] overflow-hidden shrink-0 border border-white/5 relative">
                                            <img src={post.image_urls[0]} alt="" className="w-full h-full object-cover" />
                                            {post.image_urls.length > 1 && (
                                                <div className="absolute bottom-0 right-0 bg-black/60 px-1.5 py-0.5 rounded-tl-lg text-[9px] font-bold text-white backdrop-blur-sm">
                                                    +{post.image_urls.length - 1}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 mt-3 text-[12px] text-white/30">
                                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {post.like_count}</span>
                                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.comment_count}</span>
                                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {post.view_count}</span>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────
export default function GatheringPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<GatheringTab>('chat');
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      setShowExitModal(true);
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleExit = () => {
    setShowExitModal(false);
    navigate('/chat', { replace: true });
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#080808] text-white">
      {/* 헤더 */}
      <header className="px-5 pt-6 pb-0 sticky top-0 z-20 bg-[#080808]/90 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowExitModal(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </motion.button>
            <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-[#FF203A] uppercase mb-0.5">Grayn</p>
                <h1 className="text-[20px] font-bold text-white">게더링</h1>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(activeTab === 'chat' ? '/gathering/create-room' : '/gathering/create-post')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-black shadow-lg shadow-white/10 hover:bg-white/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        {/* 탭 */}
        <div className="flex gap-8 border-b border-white/10">
          {(['chat', 'board'] as const).map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative pb-3 text-[16px] font-medium transition-colors ${
                  activeTab === tab ? 'text-white' : 'text-white/40'
              }`}
            >
              {tab === 'chat' ? '게더링 챗' : '그레인 보드'}
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full"
                />
              )}
            </motion.button>
          ))}
        </div>
      </header>

      {/* 콘텐츠 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {activeTab === 'chat' ? <GatheringChatTab /> : <GatheringBoardTab />}
        </motion.div>
      </AnimatePresence>

      {/* 나가기 확인 모달 */}
      <AnimatePresence>
        {showExitModal && (
          <ExitConfirmModal
            onConfirm={handleExit}
            onCancel={() => setShowExitModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}