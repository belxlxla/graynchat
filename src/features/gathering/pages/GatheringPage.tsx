import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, LayoutGrid, Plus, Search,
  Lock, Users, Heart, MessageCircle,
  Eye, Flame, X, Loader2, AlertCircle, RefreshCw,
  ChevronRight, User
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
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
}

// ── 비밀번호 모달 ────────────────────────────────────────────
function PasswordModal({ room, onConfirm, onClose }: {
  room: GatheringRoom;
  onConfirm: (pw: string) => void;
  onClose: () => void;
}) {
  const [pw, setPw] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="relative z-10 w-full max-w-lg rounded-t-[28px] px-6 pt-5 pb-12"
        style={{ background: '#111111', borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="w-9 h-[3px] rounded-full mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-7 h-7 flex items-center justify-center rounded-full transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <p className="text-[11px] tracking-[0.1em] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          비공개 채팅방
        </p>
        <h3 className="text-[17px] mb-6" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 450, letterSpacing: '-0.02em' }}>
          {room.title}
        </h3>
        <input
          type="password" value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm(pw)}
          placeholder="비밀번호"
          className="w-full rounded-2xl px-4 py-3.5 text-sm text-center focus:outline-none mb-4 transition-all placeholder-white/20"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.2em',
          }}
          autoFocus
        />
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onConfirm(pw)}
          className="w-full py-3.5 rounded-2xl text-[13px] transition-all"
          style={{ background: '#FF203A', color: 'white', fontWeight: 500 }}
        >
          입장하기
        </motion.button>
      </motion.div>
    </div>
  );
}

// ── 게더링 챗 탭 ──────────────────────────────────────────
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

  const fetchRooms = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('gathering_rooms')
        .select('*')
        .order('participant_count', { ascending: false });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (error) {
        if (error.code !== 'PGRST116') console.error('Error fetching rooms:', error);
        setRooms([]);
        return;
      }

      const list = data || [];
      if (list.length === 0) { setRooms([]); setIsLoading(false); return; }

      const hostIds = [...new Set(list.map((r) => r.host_id))].filter(Boolean);
      let userMap = new Map<string, string>();
      if (hostIds.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', hostIds);
        userMap = new Map(usersData?.map((u) => [u.id, u.name]) || []);
      }

      const activeRooms = list.filter(r => r.is_active !== false);
      setRooms(activeRooms.map((r) => ({ ...r, host_name: userMap.get(r.host_id) || '알 수 없음' })));
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Fetch error:', err);
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    timeoutRef.current = setTimeout(() => { setIsLoading(false); }, 8000);
    fetchRooms();

    const channel = supabase.channel(`gathering_rooms_sync_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gathering_rooms' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setRooms((prev) => prev.filter((r) => r.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          fetchRooms();
        } else if (payload.eventType === 'UPDATE') {
          setRooms((prev) => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } as GatheringRoom : r));
        }
      })
      .subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleJoinRoom = async (room: GatheringRoom, password?: string) => {
    if (!user) return toast.error('로그인이 필요합니다.');
    if (isJoining) return;
    setIsJoining(true);
    try {
      if (room.is_locked && password !== undefined) {
        const { data } = await supabase.from('gathering_rooms').select('password').eq('id', room.id).single();
        if (data?.password !== password) { toast.error('비밀번호가 틀렸습니다.'); setIsJoining(false); return; }
      }
      const { data: existing } = await supabase
        .from('gathering_room_members').select('id')
        .eq('room_id', room.id).eq('user_id', user.id).maybeSingle();

      if (!existing) {
        await supabase.from('gathering_room_members').insert({ room_id: room.id, user_id: user.id });
      }
      setSelectedRoom(null);
      navigate(`/gathering/chat/${room.id}`);
    } catch {
      toast.error('입장에 실패했습니다.');
    } finally {
      setIsJoining(false);
    }
  };

  const filtered = rooms.filter((r) => {
    const matchCat = activeCategory === '전체' || r.category === activeCategory;
    const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 검색 */}
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="채팅방 검색"
            className="bg-transparent text-sm w-full focus:outline-none placeholder-white/20"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 카테고리 */}
      <div className="px-5 pb-5 flex flex-wrap gap-2">
        {CHAT_CATEGORIES.map((cat) => (
          <motion.button
            key={cat}
            whileTap={{ scale: 0.93 }}
            onClick={() => setActiveCategory(cat)}
            className="px-3 py-1.5 rounded-full text-xs transition-all"
            style={
              activeCategory === cat
                ? { background: 'rgba(255,32,58,0.12)', color: '#FF203A', border: '1px solid rgba(255,32,58,0.25)' }
                : { background: 'transparent', color: 'rgba(255,255,255,0.32)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            {cat}
          </motion.button>
        ))}
      </div>

      {/* 방 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgba(255,255,255,0.18)' }} />
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
          <AlertCircle className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.12)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>{errorMsg}</p>
          <motion.button whileTap={{ scale: 0.96 }} onClick={fetchRooms}
            className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
            <RefreshCw className="w-3 h-3" /> 다시 시도
          </motion.button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.22)' }}>채팅방이 없습니다</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.13)' }}>첫 번째 방을 개설해보세요</p>
        </div>
      ) : (
        <div className="px-5 space-y-2 pb-8">
          {filtered.map((room, idx) => (
            <motion.button
              key={room.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.045, duration: 0.22 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => room.is_locked ? setSelectedRoom(room) : handleJoinRoom(room)}
              className="w-full flex items-center gap-3.5 p-4 rounded-2xl text-left group transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.055)' }}
            >
              <div
                className="w-12 h-12 rounded-[14px] shrink-0 flex items-center justify-center text-[17px]"
                style={{
                  background: `${room.thumbnail_color || '#FF203A'}18`,
                  color: room.thumbnail_color || '#FF203A',
                  fontWeight: 600,
                }}
              >
                {room.title.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[14px] truncate" style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 450, letterSpacing: '-0.01em' }}>
                    {room.title}
                  </span>
                  {room.is_locked && <Lock className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.18)' }} />}
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.26)' }}>{room.category}</span>
                  <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                  <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <Users className="w-3 h-3" />
                    <span className="text-[11px]">{room.participant_count}명</span>
                  </div>
                </div>
              </div>
              <ChevronRight
                className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: 'rgba(255,255,255,0.14)' }}
              />
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedRoom && (
          <PasswordModal
            room={selectedRoom}
            onConfirm={(pw) => handleJoinRoom(selectedRoom, pw)}
            onClose={() => setSelectedRoom(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 게더링 보드 탭 ─────────────────────────────────────────
function GatheringBoardTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<GatheringPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [showMyPostsOnly, setShowMyPostsOnly] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setErrorMsg('연결 시간이 초과됐습니다.');
    }, 5000);
    fetchPosts();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const fetchPosts = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('gathering_posts').select('*')
        .order('created_at', { ascending: false }).limit(50);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (error) {
        setErrorMsg(error.code === '42P01' ? '테이블을 먼저 생성해주세요.' : error.message);
        setPosts([]); return;
      }

      const list = data || [];
      const sortedList = list.sort((a, b) => {
        const isMyA = a.author_id === user?.id ? 1 : 0;
        const isMyB = b.author_id === user?.id ? 1 : 0;
        return isMyB - isMyA;
      });

      setPosts(sortedList);
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setErrorMsg(err?.message || '오류가 발생했습니다.');
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  const filtered = showMyPostsOnly
    ? posts.filter(p => p.author_id === user?.id)
    : (activeCategory === '전체' ? posts : posts.filter(p => p.category === activeCategory));

  const hotPosts = posts.filter((p) => p.like_count >= 3).slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 인기글 */}
      <AnimatePresence>
        {!showMyPostsOnly && !isLoading && !errorMsg && hotPosts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mx-5 mt-4 mb-4 rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-3.5 h-3.5" style={{ color: 'rgba(255,140,50,0.75)' }} />
              <span className="text-[11px] tracking-[0.06em]" style={{ color: 'rgba(255,255,255,0.3)' }}>인기</span>
            </div>
            <div className="space-y-2.5">
              {hotPosts.map((post, i) => (
                <motion.button
                  key={post.id}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/gathering/post/${post.id}`)}
                  className="w-full flex items-center gap-3 text-left group"
                >
                  <span className="text-[11px] shrink-0 tabular-nums w-4"
                    style={{ color: i === 0 ? '#FF203A' : 'rgba(255,255,255,0.2)', fontWeight: 600 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-[13px] truncate flex-1 transition-colors" style={{ color: 'rgba(255,255,255,0.58)' }}>
                    {post.title}
                  </p>
                  <div className="flex items-center gap-1 shrink-0" style={{ color: 'rgba(255,32,58,0.55)' }}>
                    <Heart className="w-3 h-3" />
                    <span className="text-[11px]">{post.like_count}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 카테고리 및 내 글 필터 */}
      <div className="px-5 pb-4 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setShowMyPostsOnly(!showMyPostsOnly)}
          className="px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 shrink-0"
          style={
            showMyPostsOnly
              ? { background: '#FF203A', color: 'white', border: '1px solid #FF203A' }
              : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }
          }
        >
          <User className="w-3 h-3" /> 내 글
        </motion.button>

        <div className="w-[1px] h-3 bg-white/10 mx-1 shrink-0" />

        {!showMyPostsOnly && BOARD_CATEGORIES.map((cat) => (
          <motion.button
            key={cat}
            whileTap={{ scale: 0.93 }}
            onClick={() => setActiveCategory(cat)}
            className="px-3 py-1.5 rounded-full text-xs transition-all shrink-0"
            style={
              activeCategory === cat
                ? { background: 'rgba(255,32,58,0.12)', color: '#FF203A', border: '1px solid rgba(255,32,58,0.25)' }
                : { background: 'transparent', color: 'rgba(255,255,255,0.32)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            {cat}
          </motion.button>
        ))}
      </div>

      {/* 게시글 리스트 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgba(255,255,255,0.18)' }} />
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
          <AlertCircle className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.12)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>{errorMsg}</p>
          <motion.button whileTap={{ scale: 0.96 }} onClick={fetchPosts}
            className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
            <RefreshCw className="w-3 h-3" /> 다시 시도
          </motion.button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {showMyPostsOnly ? '작성한 글이 없습니다' : '게시글이 없습니다'}
          </p>
          {!showMyPostsOnly && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.13)' }}>첫 번째 글을 작성해보세요</p>}
        </div>
      ) : (
        <div className="pb-8">
          {filtered.map((post, idx) => {
            const isMyPost = post.author_id === user?.id;
            return (
              <motion.button
                key={post.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.025 }}
                whileTap={{ scale: 0.995 }}
                onClick={() => navigate(`/gathering/post/${post.id}`)}
                className="w-full px-5 py-4 text-left transition-colors relative"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isMyPost && (
                    <span className="text-[10px] font-bold text-[#111] bg-[#FF203A] px-1.5 py-0.5 rounded-md">MY</span>
                  )}
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{post.category}</span>
                  <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.18)' }}>{getTimeAgo(post.created_at)}</span>
                </div>
                <p className="text-[14px] leading-snug mb-1.5 line-clamp-2"
                  style={{ color: 'rgba(255,255,255,0.78)', letterSpacing: '-0.01em', fontWeight: 450 }}>
                  {post.title}
                </p>
                <p className="text-[12px] line-clamp-1 mb-3" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {post.content}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{post.author_name}</span>
                  <div className="flex items-center gap-3 ml-auto">
                    <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <Heart className="w-3 h-3" /><span className="text-[11px]">{post.like_count}</span>
                    </div>
                    <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <MessageCircle className="w-3 h-3" /><span className="text-[11px]">{post.comment_count}</span>
                    </div>
                    <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.13)' }}>
                      <Eye className="w-3 h-3" /><span className="text-[11px]">{post.view_count}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────
export default function GatheringPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<GatheringTab>('chat');

  return (
    <div className="h-full w-full flex flex-col" style={{ background: '#080808', color: 'white' }}>
      {/* 헤더 */}
      <header className="px-5 pt-6 pb-0 sticky top-0 z-10" style={{ background: '#080808' }}>
        <div className="flex items-center justify-between mb-5">
          {/* 타이틀 */}
          <div>
            <p className="text-[10px] tracking-[0.16em] uppercase" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Grayn
            </p>
            <h1 className="text-[22px]" style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              게더링
            </h1>
          </div>

          {/* 글쓰기 / 방 만들기 버튼 */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(activeTab === 'chat' ? '/gathering/create-room' : '/gathering/create-post')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] transition-all"
            style={{
              background: 'rgba(255,32,58,0.1)',
              border: '1px solid rgba(255,32,58,0.2)',
              color: '#FF203A',
              fontWeight: 500,
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            {activeTab === 'chat' ? '방 만들기' : '글쓰기'}
          </motion.button>
        </div>

        {/* 탭 */}
        <div className="flex gap-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
          {(['chat', 'board'] as const).map((tab) => (
            <motion.button
              key={tab}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(tab)}
              className="relative pb-3 text-[13px] transition-colors"
              style={{
                color: activeTab === tab ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                fontWeight: activeTab === tab ? 500 : 400,
                letterSpacing: '-0.01em',
              }}
            >
              <span className="flex items-center gap-1.5">
                {tab === 'chat'
                  ? <><MessageSquare className="w-3.5 h-3.5" />챗</>
                  : <><LayoutGrid className="w-3.5 h-3.5" />보드</>
                }
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ background: 'rgba(255,255,255,0.65)' }}
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
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="flex-1 flex flex-col overflow-hidden mt-1"
        >
          {activeTab === 'chat' ? <GatheringChatTab /> : <GatheringBoardTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}