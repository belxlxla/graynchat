import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, LayoutGrid, Plus, Search,
  Lock, Users, Heart, MessageCircle,
  Eye, Flame, X, Loader2, AlertCircle, RefreshCw,
  ChevronRight, User, TrendingUp, Clock,
  Coffee, Gamepad2, Music, GraduationCap, Activity,
  Plane, Utensils, Hash, HelpCircle, Info, Smile,
  Brain, Crown,
  UsersRound, Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

type GatheringTab = 'chat' | 'board';
type BoardSort = 'latest' | 'popular' | 'comments';

// ── 카테고리 아이콘 & 컬러 ─────────────────────────────────
const CHAT_CATEGORIES = ['전체', '일상', '게임', '음악', '스터디', '운동', '여행', '맛집', '기타'];
const BOARD_CATEGORIES = ['전체', '일상', '질문', '정보', '유머', '감동', '고민'];

const CAT_ICON: Record<string, React.ElementType> = {
  '일상': Coffee, '게임': Gamepad2, '음악': Music, '스터디': GraduationCap,
  '운동': Activity, '여행': Plane, '맛집': Utensils, '기타': Hash,
  '질문': HelpCircle, '정보': Info, '유머': Smile, '감동': Heart, '고민': Brain,
};

const CAT_COLOR: Record<string, string> = {
  '일상': '#7B96B8', '게임': '#9B72CF', '음악': '#CF5252',
  '스터디': '#52A878', '운동': '#CF8C3C', '여행': '#3CA8A0',
  '맛집': '#CF9E30', '기타': '#8C9CA8',
  '질문': '#4A90CF', '정보': '#30BFA0',
  '유머': '#CFBB30', '감동': '#CF3C7A', '고민': '#8C52CF',
};

// ── 인터페이스 ────────────────────────────────────────────
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
        <button onClick={onClose}
          className="absolute top-5 right-5 w-7 h-7 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
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
          className="w-full rounded-2xl px-4 py-3.5 text-sm text-center focus:outline-none mb-4 placeholder-white/20"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.2em',
          }}
          autoFocus
        />
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => onConfirm(pw)}
          className="w-full py-3.5 rounded-2xl text-[13px]"
          style={{ background: '#FF203A', color: 'white', fontWeight: 500 }}>
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
  // UI-only: 내가 만든 방만 보기 (기존 로직 유지, 렌더링만 필터)
  const [showMineOnly, setShowMineOnly] = useState(false);

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

  // UI-only 필터 (fetched 데이터에서 렌더링 시 분리)
  const filtered = rooms.filter((r) => {
    if (showMineOnly && r.host_id !== user?.id) return false;
    const matchCat = activeCategory === '전체' || r.category === activeCategory;
    const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // 내가 만든 방 / 남이 만든 방 분리 렌더용
  const myRooms = filtered.filter(r => r.host_id === user?.id);
  const otherRooms = filtered.filter(r => r.host_id !== user?.id);

  return (
    <div className="flex-1 overflow-y-auto">

      {/* ── 검색 + 필터 바 ── */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        {/* 검색 */}
        <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="채팅방 검색"
            className="bg-transparent text-[13px] w-full focus:outline-none placeholder-white/18"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }} onClick={() => setSearchQuery('')}>
                <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.22)' }} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* 내 방 / 전체 토글 */}
        <div className="flex gap-2">
          {[
            { key: false, label: '전체 채팅방', icon: UsersRound },
            { key: true, label: '내가 만든 그룹 채팅방', icon: Crown },
          ].map(({ key, label, icon: Icon }) => (
            <motion.button key={String(key)} whileTap={{ scale: 0.94 }}
              onClick={() => setShowMineOnly(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[12px] transition-all"
              style={
                showMineOnly === key
                  ? { background: key ? 'rgba(255,32,58,0.12)' : 'rgba(255,255,255,0.08)',
                      color: key ? '#FF203A' : 'rgba(255,255,255,0.75)',
                      border: key ? '1px solid rgba(255,32,58,0.25)' : '1px solid rgba(255,255,255,0.12)',
                      fontWeight: 600 }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.28)',
                      border: '1px solid rgba(255,255,255,0.06)' }
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── 카테고리 칩 ── */}
      <div className="px-4 pb-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {CHAT_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          const color = CAT_COLOR[cat] || '#7B96B8';
          const Icon = CAT_ICON[cat];
          return (
            <motion.button key={cat} whileTap={{ scale: 0.93 }}
              onClick={() => setActiveCategory(cat)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] transition-all"
              style={
                isActive
                  ? { background: `${color}20`, color: color, border: `1px solid ${color}50`, fontWeight: 600 }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              {Icon && <Icon className="w-3 h-3" />}
              {cat}
            </motion.button>
          );
        })}
      </div>

      {/* ── 방 목록 ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.18)' }}>채팅방 불러오는 중</p>
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 px-8 text-center">
          <AlertCircle className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.12)' }} />
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{errorMsg}</p>
          <motion.button whileTap={{ scale: 0.96 }} onClick={fetchRooms}
            className="flex items-center gap-1.5 text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <RefreshCw className="w-3 h-3" /> 다시 시도
          </motion.button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
          <UsersRound className="w-8 h-8 mb-1" style={{ color: 'rgba(255,255,255,0.08)' }} />
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {showMineOnly ? '내가 만든 채팅방이 없습니다' : '채팅방이 없습니다'}
          </p>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.13)' }}>첫 번째 방을 개설해보세요</p>
        </div>
      ) : (
        <div className="px-4 pb-10 space-y-2">

          {/* 내가 만든 방 섹션 */}
          {!showMineOnly && myRooms.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-1 pt-1 pb-2">
                <Crown className="w-3 h-3" style={{ color: '#FF203A' }} />
                <span className="text-[10px] font-bold tracking-[0.1em] uppercase"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>내가 만든 방</span>
                <span className="text-[10px] font-bold" style={{ color: 'rgba(255,32,58,0.5)' }}>{myRooms.length}</span>
              </div>
              {myRooms.map((room, idx) => (
                <RoomCard key={room.id} room={room} idx={idx} isMyRoom
                  onJoin={handleJoinRoom} onSelect={setSelectedRoom} />
              ))}
              {otherRooms.length > 0 && (
                <div className="flex items-center gap-2 px-1 pt-3 pb-2">
                  <UsersRound className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <span className="text-[10px] font-bold tracking-[0.1em] uppercase"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>다른 사람들의 그룹 채팅방</span>
                  <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>{otherRooms.length}</span>
                </div>
              )}
              {otherRooms.map((room, idx) => (
                <RoomCard key={room.id} room={room} idx={idx} isMyRoom={false}
                  onJoin={handleJoinRoom} onSelect={setSelectedRoom} />
              ))}
            </>
          )}

          {/* 전체 or 내 방만 보기 */}
          {(showMineOnly || myRooms.length === 0) && filtered.map((room, idx) => (
            <RoomCard key={room.id} room={room} idx={idx} isMyRoom={room.host_id === user?.id}
              onJoin={handleJoinRoom} onSelect={setSelectedRoom} />
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

// ── 채팅방 카드 컴포넌트 ─────────────────────────────────────
function RoomCard({ room, idx, isMyRoom, onJoin, onSelect }: {
  room: GatheringRoom;
  idx: number;
  isMyRoom: boolean;
  onJoin: (room: GatheringRoom, pw?: string) => void;
  onSelect: (room: GatheringRoom) => void;
}) {
  const catColor = CAT_COLOR[room.category] || '#7B96B8';
  const CIcon = CAT_ICON[room.category] || Hash;
  const fillPct = room.max_participants > 0
    ? Math.min((room.participant_count / room.max_participants) * 100, 100) : 0;
  const isAlmostFull = fillPct >= 80;

  return (
    <motion.button
      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03, duration: 0.18 }}
      whileTap={{ scale: 0.984 }}
      onClick={() => room.is_locked ? onSelect(room) : onJoin(room)}
      className="w-full rounded-2xl text-left overflow-hidden group relative"
      style={{
        background: isMyRoom ? 'rgba(255,32,58,0.04)' : 'rgba(255,255,255,0.025)',
        border: isMyRoom ? '1px solid rgba(255,32,58,0.18)' : '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* 내 방 - 좌측 강조 바 */}
      {isMyRoom && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
          style={{ background: '#FF203A' }} />
      )}

      <div className="flex items-start gap-3.5 px-4 pt-4 pb-3 pl-5">
        {/* 카테고리 아이콘 */}
        <div className="w-11 h-11 rounded-[13px] shrink-0 flex items-center justify-center"
          style={{ background: `${catColor}16`, border: `1px solid ${catColor}28`, color: catColor }}>
          <CIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          {/* 제목 행 */}
          <div className="flex items-center gap-2 mb-0.5">
            {isMyRoom && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-0.5"
                style={{ background: 'rgba(255,32,58,0.15)', color: '#FF203A' }}>
                <Crown className="w-2.5 h-2.5" /> HOST
              </span>
            )}
            <span className="text-[14px] font-medium truncate"
              style={{ color: 'rgba(255,255,255,0.86)', letterSpacing: '-0.015em' }}>
              {room.title}
            </span>
            {room.is_locked && (
              <Lock className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
            )}
            {isAlmostFull && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: 'rgba(255,32,58,0.12)', color: '#FF203A' }}>FULL</span>
            )}
          </div>

          {/* 설명 */}
          {room.description ? (
            <p className="text-[12px] truncate mb-2.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {room.description}
            </p>
          ) : <div className="mb-2" />}

          {/* 메타 */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: `${catColor}14`, border: `1px solid ${catColor}25` }}>
              <CIcon className="w-2.5 h-2.5" style={{ color: catColor }} />
              <span className="text-[10px] font-medium" style={{ color: catColor }}>{room.category}</span>
            </div>
            <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {/* 라이브 점 */}
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                  style={{ background: isMyRoom ? '#FF203A' : catColor }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ background: isMyRoom ? '#FF203A' : catColor }} />
              </span>
              <Users className="w-3 h-3 ml-0.5" />
              <span className="text-[11px] tabular-nums">
                {room.participant_count}
                {room.max_participants > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>/{room.max_participants}</span>
                )}
              </span>
            </div>
            {room.host_name && !isMyRoom && (
              <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <User className="w-2.5 h-2.5" />
                <span className="text-[11px] truncate max-w-[60px]">{room.host_name}</span>
              </div>
            )}
          </div>
        </div>

        <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'rgba(255,255,255,0.1)' }} />
      </div>

      {/* 참여율 바 */}
      {room.max_participants > 0 && (
        <div className="h-[2px] mx-4 mb-3 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.7, delay: idx * 0.03 + 0.1, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: isAlmostFull ? '#FF203A' : catColor, opacity: 0.5 }}
          />
        </div>
      )}
    </motion.button>
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
  // UI-only 정렬 (fetch 로직 미변경, 클라이언트 정렬)
  const [sortBy, setSortBy] = useState<BoardSort>('latest');

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

  // UI-only 정렬 (클라이언트 사이드)
  const getSorted = (arr: GatheringPost[]) => {
    if (sortBy === 'popular') return [...arr].sort((a, b) => b.like_count - a.like_count);
    if (sortBy === 'comments') return [...arr].sort((a, b) => b.comment_count - a.comment_count);
    return arr;
  };

  const baseFiltered = showMyPostsOnly
    ? posts.filter(p => p.author_id === user?.id)
    : (activeCategory === '전체' ? posts : posts.filter(p => p.category === activeCategory));

  const filtered = getSorted(baseFiltered);
  const hotPosts = [...posts].sort((a, b) => b.like_count - a.like_count).filter(p => p.like_count >= 3).slice(0, 3);

  const getAvatarColor = (name: string) => {
    const palette = ['#FF203A', '#7B96B8', '#52A878', '#9B72CF', '#CF8C3C', '#3CA8A0'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  };

  const extractFirstImage = (content: string): string | null => {
    const match = content.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|gif|webp)/i);
    return match ? match[0] : null;
  };

  const isNewPost = (dateStr: string) => Date.now() - new Date(dateStr).getTime() < 3600000 * 3;

  const SORT_OPTIONS: { key: BoardSort; label: string; icon: React.ElementType }[] = [
    { key: 'latest', label: '최신순', icon: Clock },
    { key: 'popular', label: '인기순', icon: Flame },
    { key: 'comments', label: '댓글순', icon: MessageCircle },
  ];

  const myPosts = filtered.filter(p => p.author_id === user?.id);
  const otherPosts = filtered.filter(p => p.author_id !== user?.id);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── 스티키 컨트롤 영역 ── */}
      <div className="shrink-0 pt-4 pb-3" style={{ background: '#080808' }}>

        {/* 카테고리 + 내 글 필터 — 한 줄 스크롤 */}
        <div className="flex items-center gap-2 px-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

          {/* 내 글만 토글 */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setShowMyPostsOnly(!showMyPostsOnly)}
            className="shrink-0 flex items-center gap-1.5 rounded-full text-[12px] transition-all"
            style={
              showMyPostsOnly
                ? {
                    padding: '7px 14px',
                    background: '#FF203A',
                    color: '#fff',
                    fontWeight: 600,
                  }
                : {
                    padding: '7px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.45)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }
            }
          >
            <Pencil className="w-3 h-3" />
            내 글
          </motion.button>

          {/* 구분선 */}
          <div className="shrink-0 w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* 카테고리 칩 */}
          {!showMyPostsOnly && BOARD_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            const color = CAT_COLOR[cat] || '#7B96B8';
            const Icon = CAT_ICON[cat];
            return (
              <motion.button key={cat} whileTap={{ scale: 0.93 }}
                onClick={() => setActiveCategory(cat)}
                className="shrink-0 flex items-center gap-1.5 rounded-full text-[12px] transition-all"
                style={
                  isActive
                    ? {
                        padding: '7px 14px',
                        background: `${color}1E`,
                        color: color,
                        border: `1px solid ${color}40`,
                        fontWeight: 600,
                      }
                    : {
                        padding: '7px 14px',
                        color: 'rgba(255,255,255,0.3)',
                        border: '1px solid transparent',
                      }
                }
              >
                {cat !== '전체' && Icon && <Icon className="w-3 h-3" />}
                {cat}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── 스크롤 영역 ── */}
      <div className="flex-1 overflow-y-auto">

        {/* 인기글 */}
        <AnimatePresence>
          {!showMyPostsOnly && !isLoading && !errorMsg && hotPosts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="mx-4 mt-2 mb-5 rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.055)',
              }}
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,130,40,0.12)' }}>
                    <TrendingUp className="w-3 h-3" style={{ color: 'rgba(255,150,50,0.9)' }} />
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '-0.01em' }}>
                    지금 인기
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
                  좋아요 많은 순
                </span>
              </div>

              {/* 리스트 */}
              {hotPosts.map((post, i) => (
                <motion.button key={post.id} whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/gathering/post/${post.id}`)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left"
                  style={{ borderBottom: i < hotPosts.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                >
                  {/* 순위 */}
                  <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-black tabular-nums"
                    style={{
                      background: i === 0 ? 'rgba(255,32,58,0.12)' : i === 1 ? 'rgba(255,130,40,0.1)' : 'rgba(255,255,255,0.04)',
                      color: i === 0 ? '#FF203A' : i === 1 ? 'rgba(255,150,50,0.85)' : 'rgba(255,255,255,0.25)',
                    }}>
                    {i + 1}
                  </div>
                  <p className="flex-1 text-[13px] truncate" style={{ color: 'rgba(255,255,255,0.68)', letterSpacing: '-0.015em' }}>
                    {post.title}
                  </p>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1" style={{ color: 'rgba(255,32,58,0.55)' }}>
                      <Heart className="w-3 h-3" />
                      <span className="text-[11px] tabular-nums">{post.like_count}</span>
                    </div>
                    <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.18)' }}>
                      <MessageCircle className="w-3 h-3" />
                      <span className="text-[11px] tabular-nums">{post.comment_count}</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 섹션 헤더: 카운트 + 정렬 ── */}
        {!isLoading && !errorMsg && (
          <div className="flex items-center justify-between px-4 mb-3">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
              {showMyPostsOnly ? '내가 쓴 글' : activeCategory === '전체' ? '전체' : activeCategory}
              <span className="ml-1.5 font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {filtered.length}
              </span>
            </span>

            {/* 정렬 세그먼트 */}
            <div className="flex items-center gap-0.5 rounded-xl p-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {SORT_OPTIONS.map(({ key, label, icon: SIcon }) => (
                <motion.button key={key} whileTap={{ scale: 0.93 }}
                  onClick={() => setSortBy(key)}
                  className="flex items-center gap-1 rounded-lg text-[11px] transition-all"
                  style={
                    sortBy === key
                      ? {
                          padding: '5px 10px',
                          background: 'rgba(255,255,255,0.09)',
                          color: 'rgba(255,255,255,0.78)',
                          fontWeight: 600,
                        }
                      : {
                          padding: '5px 10px',
                          color: 'rgba(255,255,255,0.3)',
                        }
                  }
                >
                  <SIcon className="w-3 h-3" />
                  {label}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ── 게시글 리스트 ── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>게시글 불러오는 중</p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 px-8 text-center">
            <AlertCircle className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.1)' }} />
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{errorMsg}</p>
            <motion.button whileTap={{ scale: 0.96 }} onClick={fetchPosts}
              className="flex items-center gap-1.5 text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <RefreshCw className="w-3 h-3" /> 다시 시도
            </motion.button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
            <LayoutGrid className="w-8 h-8 mb-1" style={{ color: 'rgba(255,255,255,0.06)' }} />
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {showMyPostsOnly ? '작성한 글이 없습니다' : '게시글이 없습니다'}
            </p>
            {!showMyPostsOnly && (
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.12)' }}>
                첫 번째 글을 작성해보세요
              </p>
            )}
          </div>
        ) : (
          <div className="px-4 space-y-2 pb-10">
            {/* 내 글 섹션 (전체 보기 시) */}
            {!showMyPostsOnly && myPosts.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-1 pb-1.5">
                  <Pencil className="w-3 h-3" style={{ color: '#FF203A' }} />
                  <span className="text-[10px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: 'rgba(255,255,255,0.25)' }}>내가 쓴 글</span>
                  <span className="text-[10px] font-bold ml-0.5" style={{ color: 'rgba(255,32,58,0.45)' }}>
                    {myPosts.length}
                  </span>
                </div>
                {myPosts.map((post, idx) => (
                  <PostCard key={post.id} post={post} idx={idx} isMyPost
                    getTimeAgo={getTimeAgo} getAvatarColor={getAvatarColor}
                    extractFirstImage={extractFirstImage} isNewPost={isNewPost}
                    onPress={() => navigate(`/gathering/post/${post.id}`)} />
                ))}
                {otherPosts.length > 0 && (
                  <div className="flex items-center gap-2 pt-3 pb-1.5">
                    <Users className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.22)' }} />
                    <span className="text-[10px] font-bold tracking-[0.08em] uppercase"
                      style={{ color: 'rgba(255,255,255,0.25)' }}>커뮤니티 글</span>
                    <span className="text-[10px] font-bold ml-0.5" style={{ color: 'rgba(255,255,255,0.18)' }}>
                      {otherPosts.length}
                    </span>
                  </div>
                )}
                {otherPosts.map((post, idx) => (
                  <PostCard key={post.id} post={post} idx={idx} isMyPost={false}
                    getTimeAgo={getTimeAgo} getAvatarColor={getAvatarColor}
                    extractFirstImage={extractFirstImage} isNewPost={isNewPost}
                    onPress={() => navigate(`/gathering/post/${post.id}`)} />
                ))}
              </>
            )}

            {/* 내 글만 보기 or 내 글 없음 */}
            {(showMyPostsOnly || myPosts.length === 0) && filtered.map((post, idx) => (
              <PostCard key={post.id} post={post} idx={idx} isMyPost={post.author_id === user?.id}
                getTimeAgo={getTimeAgo} getAvatarColor={getAvatarColor}
                extractFirstImage={extractFirstImage} isNewPost={isNewPost}
                onPress={() => navigate(`/gathering/post/${post.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 게시글 카드 컴포넌트 ──────────────────────────────────────
function PostCard({ post, idx, isMyPost, getTimeAgo, getAvatarColor, extractFirstImage, isNewPost, onPress }: {
  post: GatheringPost;
  idx: number;
  isMyPost: boolean;
  getTimeAgo: (d: string) => string;
  getAvatarColor: (n: string) => string;
  extractFirstImage: (c: string) => string | null;
  isNewPost: (d: string) => boolean;
  onPress: () => void;
}) {
  const catColor = CAT_COLOR[post.category] || '#7B96B8';
  const avatarColor = getAvatarColor(post.author_name);
  const isHot = post.like_count >= 3;
  const isNew = isNewPost(post.created_at);
  const thumbImage = extractFirstImage(post.content);
  const CIcon = CAT_ICON[post.category] || Hash;

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.015, duration: 0.16 }}
      whileTap={{ scale: 0.985 }}
      onClick={onPress}
      className="w-full text-left rounded-2xl overflow-hidden relative"
      style={{
        background: isMyPost ? 'rgba(255,32,58,0.035)' : 'rgba(255,255,255,0.025)',
        border: isMyPost ? '1px solid rgba(255,32,58,0.14)' : '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* 내 글 — 좌측 컬러 바 */}
      {isMyPost && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
          style={{ background: '#FF203A' }} />
      )}

      <div className={`pt-4 pb-3.5 pr-4 ${isMyPost ? 'pl-5' : 'pl-4'}`}>

        {/* 메타 행 */}
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          {isMyPost && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(255,32,58,0.14)', color: '#FF203A' }}>
              <Pencil className="w-2 h-2" /> MY
            </span>
          )}
          {isHot && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(255,130,40,0.1)', color: 'rgba(255,150,50,0.9)' }}>
              <Flame className="w-2 h-2" /> HOT
            </span>
          )}
          {isNew && !isHot && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(82,168,120,0.12)', color: 'rgba(100,185,130,0.9)' }}>
              NEW
            </span>
          )}
          {/* 카테고리 뱃지 */}
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: `${catColor}14`, border: `1px solid ${catColor}28` }}>
            <CIcon className="w-2.5 h-2.5" style={{ color: catColor }} />
            <span className="text-[10px] font-medium" style={{ color: catColor }}>{post.category}</span>
          </div>
          {/* 시간 */}
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <Clock className="w-2.5 h-2.5" />
            {getTimeAgo(post.created_at)}
          </span>
        </div>

        {/* 제목 + 썸네일 */}
        <div className="flex gap-3 mb-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium leading-[1.45] mb-1.5 line-clamp-2"
              style={{ color: 'rgba(255,255,255,0.84)', letterSpacing: '-0.018em' }}>
              {post.title}
            </p>
            <p className="text-[12px] leading-relaxed line-clamp-2"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              {post.content}
            </p>
          </div>
          {thumbImage && (
            <div className="shrink-0 w-[68px] h-[68px] rounded-xl overflow-hidden mt-0.5"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <img src={thumbImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* 푸터: 작성자 + 통계 */}
        <div className="flex items-center gap-2 mt-3">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt=""
              className="w-[18px] h-[18px] rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold"
              style={{ background: `${avatarColor}20`, color: avatarColor }}>
              {post.author_name.charAt(0)}
            </div>
          )}
          <span className="text-[11px] truncate max-w-[72px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {post.author_name}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1"
              style={{ color: post.like_count > 0 ? 'rgba(255,32,58,0.62)' : 'rgba(255,255,255,0.16)' }}>
              <Heart className="w-3 h-3" />
              <span className="text-[11px] tabular-nums">{post.like_count}</span>
            </div>
            <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <MessageCircle className="w-3 h-3" />
              <span className="text-[11px] tabular-nums">{post.comment_count}</span>
            </div>
            <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.13)' }}>
              <Eye className="w-3 h-3" />
              <span className="text-[11px] tabular-nums">
                {post.view_count >= 1000 ? `${(post.view_count / 1000).toFixed(1)}k` : post.view_count}
              </span>
            </div>
          </div>
        </div>

      </div>
    </motion.button>
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
          <div>
            <p className="text-[10px] tracking-[0.16em] uppercase" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Grayn
            </p>
            <h1 className="text-[22px]" style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              게더링
            </h1>
          </div>
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
            <motion.button key={tab} whileTap={{ scale: 0.97 }}
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
                <motion.div layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ background: 'rgba(255,255,255,0.65)' }} />
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