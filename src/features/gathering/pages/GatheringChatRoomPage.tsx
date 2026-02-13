import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Users, LogOut,
  Loader2, Crown, Hash, X,
  Plus, ImageIcon, Camera, FileText, Smile,
  ChevronLeft, ChevronRight, Download, Trash2, Rocket, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── 유틸 ────────────────────────────────────────────────────
const getFileType = (content: string) => {
  if (!content) return 'text';
  const hasExtension = content.includes('.');
  if (hasExtension) {
    const ext = content.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['mp4', 'mov', 'webm', 'avi', 'm4v'].includes(ext || '')) return 'video';
    if (['pdf'].includes(ext || '')) return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp'].includes(ext || '')) return 'office';
    if (['txt', 'log', 'md', 'json'].includes(ext || '')) return 'text-file';
  }
  if (content.includes('gathering-uploads') || content.includes('chat-uploads')) return 'file';
  return 'text';
};

const getFileName = (url: string) => {
  try {
    const decodedUrl = decodeURIComponent(url);
    const rawName = decodedUrl.split('/').pop() || 'file';
    if (rawName.includes('___')) return rawName.split('___')[1];
    return rawName.replace(/^\d+_/, '');
  } catch {
    return '첨부파일';
  }
};

const BUCKET_NAME = 'gathering-uploads';

// ─── 타입 ────────────────────────────────────────────────────
interface ChatMessage {
  id: number;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  created_at: string;
}

interface RoomInfo {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: string;
  participant_count: number;
  max_participants: number;
  is_locked: boolean;
}

// ─── 공통 바텀시트 ───────────────────────────────────────────
function BottomSheet({
  isOpen, onClose, children, maxH = 'max-h-[90vh]',
}: {
  isOpen: boolean; onClose: () => void; children: React.ReactNode; maxH?: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.9 }}
            className={`relative z-10 bg-[#1c1c1c] rounded-t-[28px] ${maxH} flex flex-col overflow-hidden`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-[3px] bg-white/10 rounded-full" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════
export default function GatheringChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [room, setRoom]                             = useState<RoomInfo | null>(null);
  const [messages, setMessages]                     = useState<ChatMessage[]>([]);
  const [input, setInput]                           = useState('');
  const [isSending, setIsSending]                   = useState(false);
  const [isLoading, setIsLoading]                   = useState(true);
  const [realParticipantCount, setRealParticipantCount] = useState<number>(0);
  const [showMembers, setShowMembers]               = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm]     = useState(false);
  const [isMenuOpen, setIsMenuOpen]                 = useState(false);
  const [showEmojiModal, setShowEmojiModal]         = useState(false);
  const [isViewerOpen, setIsViewerOpen]             = useState(false);
  const [initialImageIndex, setInitialImageIndex]   = useState(0);
  const [members, setMembers]                       = useState<{ id: string; name: string; avatar: string | null }[]>([]);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const channelRef     = useRef<RealtimeChannel | null>(null);
  const messageIdsRef  = useRef<Set<number>>(new Set());
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef    = useRef<HTMLInputElement>(null);

  const isHost = room?.host_id === user?.id;

  const allImages = useMemo(() =>
    messages.filter(m => m.content && getFileType(m.content) === 'image').map(m => m.content),
  [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  // ── 초기 데이터 ─────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    
    const loadInitialData = async () => {
      try {
        // 1. 방 정보 로드
        const { data: roomData } = await supabase.from('gathering_rooms').select('*').eq('id', roomId).single();
        if (roomData) setRoom(roomData);

        // 2. 참여자 수 로드
        const { count } = await supabase.from('gathering_room_members')
          .select('*', { count: 'exact', head: true }).eq('room_id', roomId);
        if (count !== null) setRealParticipantCount(count);

        // 3. 메시지 로드
        const { data: msgData } = await supabase.from('gathering_messages').select('*')
          .eq('room_id', roomId).order('created_at', { ascending: true }); // limit 제거 또는 적절히 조정

        if (msgData) { 
          // 중복 방지를 위한 ID 초기화
          messageIdsRef.current = new Set(msgData.map(m => m.id));
          setMessages(msgData); 
        }
      } catch {
        toast.error('채팅방 정보를 불러올 수 없습니다.');
        navigate('/main/gathering');
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [roomId, navigate]);

  // ── 실시간 구독 (수정됨: Date.now() 제거) ────────────────
  useEffect(() => {
    if (!roomId) return;

    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // ✅ 중요: 채널 이름을 고정해야 서로 통신이 됩니다. (Date.now() 제거)
    const channelName = `gathering_room_${roomId}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'gathering_messages', 
          filter: `room_id=eq.${roomId}` 
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          
          // 이미 존재하는 메시지인지 확인 (내가 보낸 메시지 중복 방지)
          if (messageIdsRef.current.has(newMsg.id)) return;
          
          messageIdsRef.current.add(newMsg.id);
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'gathering_room_members', 
          filter: `room_id=eq.${roomId}` 
        },
        async () => {
          // 멤버 변경 시 카운트 업데이트
          const { count } = await supabase.from('gathering_room_members')
            .select('*', { count: 'exact', head: true }).eq('room_id', roomId);
          if (count !== null) setRealParticipantCount(count);
        }
      )
      .on('postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'gathering_rooms', 
          filter: `id=eq.${roomId}` 
        },
        () => { 
          toast('방장이 채팅방을 종료했습니다.'); 
          navigate('/main/gathering', { replace: true }); 
        }
      )
      .subscribe((status) => { 
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Connected to chat: ${channelName}`); 
        }
      });

    channelRef.current = channel;

    return () => { 
      console.log('Cleaning up channel...'); 
      supabase.removeChannel(channel); 
    };
  }, [roomId, navigate]);

  // 스크롤 자동 이동
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ── 메시지 전송 ─────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !user || isSending) return;
    const content = input.trim();
    setInput('');
    setIsSending(true);
    setIsMenuOpen(false);

    // 낙관적 UI 업데이트를 위한 임시 ID 생성
    // DB의 ID 타입(int vs uuid)에 따라 충돌 가능성이 있으므로 음수나 timestamp 사용
    const tempId = Date.now(); 

    const optimisticMsg: ChatMessage = {
      id: tempId, 
      user_id: user.id, 
      user_name: '나',
      user_avatar: null, 
      content, 
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const { data: userData } = await supabase.from('users').select('name, avatar').eq('id', user.id).single();
      
      const { data: insertedMsg, error } = await supabase.from('gathering_messages').insert({
        room_id: roomId, 
        user_id: user.id,
        user_name: userData?.name || '사용자',
        user_avatar: userData?.avatar || null, 
        content,
      }).select().single();

      if (error) throw error;

      if (insertedMsg) {
        // 실제 ID 등록
        messageIdsRef.current.add(insertedMsg.id);
        // 낙관적 메시지를 실제 메시지로 교체
        setMessages(prev => prev.map(m => m.id === tempId ? insertedMsg : m));
      }
    } catch (err) {
      console.error(err);
      toast.error('메시지 전송 실패');
      setInput(content); // 실패 시 입력창 복구
      setMessages(prev => prev.filter(m => m.id !== tempId)); // 낙관적 메시지 제거
    } finally {
      setIsSending(false);
    }
  };

  // ── 파일 업로드 ─────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId || !user) return;
    const uploadToast = toast.loading('파일 업로드 중...');
    setIsMenuOpen(false);
    try {
      const { data: userData } = await supabase.from('users').select('name, avatar').eq('id', user.id).single();
      const fileName = `${Date.now()}___${file.name.replace(/[^a-zA-Z0-9가-힣.]/g, '_')}`;
      const filePath = `${roomId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      
      const { data: insertedMsg, error: insertError } = await supabase.from('gathering_messages').insert({
        room_id: roomId, user_id: user.id,
        user_name: userData?.name || '사용자',
        user_avatar: userData?.avatar || null, content: publicUrl,
      }).select().single();

      if (insertError) throw insertError;
      
      if (insertedMsg) {
        messageIdsRef.current.add(insertedMsg.id);
        // 파일은 낙관적 업데이트 없이 바로 리얼타임/응답으로 처리
      }

      toast.success('전송 완료', { id: uploadToast });
    } catch {
      toast.error('전송 실패', { id: uploadToast });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  // ── 나가기/삭제 ─────────────────────────────────────────
  const handleLeaveOrDeleteRoom = async () => {
    if (!user || !roomId) return;
    try {
      if (isHost) {
        // 호스트는 방을 삭제
        await supabase.from('gathering_rooms').delete().eq('id', roomId);
        toast.success('게더링 챗을 삭제했습니다.');
      } else {
        // 일반 멤버는 나가기
        await supabase.from('gathering_room_members').delete()
          .eq('room_id', roomId).eq('user_id', user.id);
        toast.success('게더링 챗을 나갔습니다.');
      }
      navigate('/main/gathering', { replace: true });
    } catch {
      toast.error('요청 처리에 실패했습니다.');
    }
  };

  // ── 멤버 로드 ────────────────────────────────────────────
  const loadMembers = async () => {
    const { data } = await supabase.from('gathering_room_members').select('user_id').eq('room_id', roomId);
    if (data) {
      const ids = data.map(m => m.user_id);
      const { data: usersData } = await supabase.from('users').select('id, name, avatar').in('id', ids);
      setMembers(usersData || []);
    }
    setShowMembers(true);
  };

  const getTimeStr = (dateStr: string) => {
    const d = new Date(dateStr);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h >= 12 ? '오후' : '오전'} ${h % 12 || 12}:${m}`;
  };

  const getDayStr = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  // ── 메시지 콘텐츠 ────────────────────────────────────────
  const renderMessageContent = (msg: ChatMessage, isMe: boolean) => {
    const type = getFileType(msg.content);

    if (type === 'image') {
      return (
        <div className={`rounded-[18px] overflow-hidden max-w-[220px] border cursor-pointer ${
          isMe ? 'border-white/[0.08]' : 'border-white/[0.06]'
        }`}>
          <img
            src={msg.content} alt=""
            className="w-full h-auto object-cover"
            onClick={() => {
              const idx = allImages.indexOf(msg.content);
              if (idx !== -1) { setInitialImageIndex(idx); setIsViewerOpen(true); }
            }}
          />
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div className="rounded-[18px] overflow-hidden max-w-[240px] bg-black border border-white/[0.06]">
          <video src={msg.content} controls playsInline className="w-full h-auto" />
        </div>
      );
    }

    if (['pdf', 'file', 'office', 'text-file'].includes(type)) {
      return (
        <div className={`flex items-stretch max-w-[260px] rounded-[18px] border overflow-hidden ${
          isMe ? 'bg-[#FF203A]/8 border-[#FF203A]/15' : 'bg-[#2a2a2a] border-white/[0.07]'
        }`}>
          <button
            onClick={() => window.open(msg.content, '_blank')}
            className="flex-1 flex items-center gap-3 p-3 hover:bg-white/[0.04] transition-colors text-left"
          >
            <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
              isMe ? 'bg-[#FF203A]/15' : 'bg-[#FF203A]/10'
            }`}>
              <FileText className="w-5 h-5 text-[#FF203A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/88 truncate font-medium">{getFileName(msg.content)}</p>
              <p className="text-[10px] text-white/28 uppercase tracking-wider mt-0.5">{type.replace('-file', '')}</p>
            </div>
          </button>
          <div className="w-px bg-white/[0.06] self-stretch" />
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = msg.content;
              a.download = getFileName(msg.content);
              a.click();
            }}
            className="px-3 flex items-center text-white/28 hover:text-white/60 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      );
    }

    // 텍스트 메시지
    return (
      <div className={`px-[14px] py-[9px] text-[14.5px] leading-[1.55] break-words ${
        isMe
          ? 'bg-[#FF203A] text-white rounded-[18px] rounded-tr-[5px]'
          : 'bg-[#2a2a2a] text-white/90 rounded-[18px] rounded-tl-[5px] border border-white/[0.07]'
      }`}>
        {msg.content}
      </div>
    );
  };

  // ── 로딩 ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#212121]">
        <Loader2 className="w-[18px] h-[18px] animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#212121] text-white overflow-hidden">

      {/* ───────── 헤더 ───────── */}
      <header className="h-[54px] px-3 flex items-center gap-2 shrink-0 bg-[#212121]/90 backdrop-blur-xl border-b border-white/[0.05] z-20">
        <button
          onClick={() => navigate('/main/gathering')}
          className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/55 hover:bg-white/[0.07] hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[15.5px] font-semibold text-white/90 tracking-tight">
              {room?.title}
            </h2>
            {room?.category && (
              <span className="text-[10px] shrink-0 px-2 py-[3px] rounded-full bg-white/[0.06] text-white/32 border border-white/[0.06] leading-none">
                {room.category}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/25 mt-[2px] tabular-nums">
            {realParticipantCount}명 참여 중
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={loadMembers}
            className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/38 hover:bg-white/[0.07] hover:text-white/75 transition-colors"
          >
            <Users className="w-[17px] h-[17px]" />
          </button>
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className={`w-9 h-9 flex items-center justify-center rounded-[12px] transition-colors ${
              isHost
                ? 'text-white/32 hover:bg-[#FF203A]/10 hover:text-[#FF203A]'
                : 'text-white/32 hover:bg-white/[0.07] hover:text-white/75'
            }`}
          >
            {isHost ? <Trash2 className="w-[17px] h-[17px]" /> : <LogOut className="w-[17px] h-[17px]" />}
          </button>
        </div>
      </header>

      {/* ───────── 메시지 영역 ───────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-[52px] h-[52px] rounded-[17px] bg-white/[0.04] flex items-center justify-center">
              <Hash className="w-6 h-6 text-white/15" />
            </div>
            <p className="text-[13px] text-white/20">대화를 시작해보세요!</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe      = msg.user_id === user?.id;
          const prevMsg   = messages[idx - 1];
          const showDay   = !prevMsg || getDayStr(msg.created_at) !== getDayStr(prevMsg.created_at);
          const showAvatar = !isMe && (!prevMsg || prevMsg.user_id !== msg.user_id || showDay);

          return (
            <div key={msg.id}>
              {/* 날짜 구분선 */}
              {showDay && (
                <div className="flex items-center gap-3 py-5">
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[11px] text-white/20 px-3 py-[5px] bg-white/[0.04] rounded-full border border-white/[0.05]">
                    {getDayStr(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${
                  showAvatar ? 'mt-4' : 'mt-1'
                }`}
              >
                {/* 상대방 아바타 */}
                {!isMe && (
                  <div className="w-[30px] h-[30px] shrink-0 mb-[18px]">
                    {showAvatar ? (
                      <div className="w-[30px] h-[30px] rounded-[10px] bg-[#2e2e2e] border border-white/[0.06] overflow-hidden flex items-center justify-center text-[12px] font-medium text-white/40">
                        {msg.user_avatar
                          ? <img src={msg.user_avatar} className="w-full h-full object-cover" alt="" />
                          : msg.user_name?.charAt(0)}
                      </div>
                    ) : (
                      <div className="w-[30px]" />
                    )}
                  </div>
                )}

                <div className={`max-w-[73%] flex flex-col gap-[3px] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* 발신자 이름 + 호스트 뱃지 */}
                  {!isMe && showAvatar && (
                    <div className="flex items-center gap-1.5 ml-1 mb-[1px]">
                      <span className="text-[11.5px] text-white/32 font-medium">{msg.user_name}</span>
                      {room?.host_id === msg.user_id && (
                        <Crown className="w-3 h-3 text-yellow-500/65" />
                      )}
                    </div>
                  )}

                  <div className="flex items-end gap-1.5">
                    {isMe && (
                      <span className="text-[10px] text-white/20 mb-[3px] tabular-nums shrink-0">
                        {getTimeStr(msg.created_at)}
                      </span>
                    )}
                    {renderMessageContent(msg, isMe)}
                    {!isMe && (
                      <span className="text-[10px] text-white/20 mb-[3px] tabular-nums shrink-0">
                        {getTimeStr(msg.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ───────── 입력창 ───────── */}
      <div className="px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] bg-[#212121]/95 backdrop-blur-xl border-t border-white/[0.05] flex items-end gap-2 shrink-0 z-30">
        {/* 플러스 버튼 */}
        <button
          onClick={() => setIsMenuOpen(true)}
          className="w-[38px] h-[38px] flex items-center justify-center rounded-[12px] bg-[#2a2a2a] border border-white/[0.07] text-white/45 hover:text-white/75 hover:bg-[#303030] transition-colors shrink-0 mb-0.5"
        >
          <Plus className="w-[17px] h-[17px]" />
        </button>

        {/* 텍스트 입력 */}
        <div className="flex-1 bg-[#2a2a2a] rounded-[18px] border border-white/[0.07] flex items-end px-[14px] py-[9px] min-h-[40px] focus-within:border-white/[0.12] transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="메시지를 입력하세요"
            rows={1}
            className="flex-1 bg-transparent text-[14.5px] text-white/90 focus:outline-none resize-none max-h-[100px] placeholder-white/20 leading-[1.45]"
            style={{ padding: 0 }}
          />
        </div>

        {/* 전송 버튼 */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className={`w-[38px] h-[38px] flex items-center justify-center rounded-[12px] transition-all shrink-0 mb-0.5 ${
            input.trim()
              ? 'bg-[#FF203A] text-white shadow-lg shadow-[#FF203A]/25'
              : 'bg-[#2a2a2a] text-white/20 border border-white/[0.07]'
          }`}
        >
          {isSending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-[15px] h-[15px]" />
          }
        </button>
      </div>

      {/* 히든 파일 인풋 */}
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" ref={docInputRef} onChange={handleFileUpload} className="hidden" />

      {/* ───────── 첨부 바텀시트 ───────── */}
      <BottomSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} maxH="max-h-[36vh]">
        <div className="px-5 pt-2 pb-8">
          <p className="text-[10.5px] font-semibold text-white/25 uppercase tracking-widest mb-5">첨부하기</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                ref: fileInputRef, Icon: ImageIcon, label: '앨범',
                gradient: 'from-blue-500/18 to-blue-600/10', iconColor: 'text-blue-400',
              },
              {
                ref: cameraInputRef, Icon: Camera, label: '카메라',
                gradient: 'from-green-500/18 to-green-600/10', iconColor: 'text-green-400',
              },
              {
                ref: docInputRef, Icon: FileText, label: '파일',
                gradient: 'from-purple-500/18 to-purple-600/10', iconColor: 'text-purple-400',
              },
            ].map(({ ref, Icon, label, gradient, iconColor }) => (
              <button
                key={label}
                onClick={() => { ref.current?.click(); setIsMenuOpen(false); }}
                className="flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
              >
                <div className={`w-[56px] h-[56px] rounded-[18px] bg-gradient-to-br ${gradient} border border-white/[0.07] flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <span className="text-[11.5px] text-white/40">{label}</span>
              </button>
            ))}
            <button
              onClick={() => { setShowEmojiModal(true); setIsMenuOpen(false); }}
              className="flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
            >
              <div className="w-[56px] h-[56px] rounded-[18px] bg-gradient-to-br from-yellow-500/18 to-orange-500/10 border border-white/[0.07] flex items-center justify-center">
                <Smile className="w-6 h-6 text-yellow-400" />
              </div>
              <span className="text-[11.5px] text-white/40">이모티콘</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ───────── 나가기 확인 바텀시트 ───────── */}
      <BottomSheet isOpen={showLeaveConfirm} onClose={() => setShowLeaveConfirm(false)} maxH="max-h-[46vh]">
        <div className="px-6 pt-3 pb-2 text-center">
          <div className={`w-[56px] h-[56px] rounded-[20px] flex items-center justify-center mx-auto mb-4 ${
            isHost ? 'bg-[#FF203A]/10' : 'bg-white/[0.05]'
          }`}>
            {isHost
              ? <Trash2 className="w-6 h-6 text-[#FF203A]" />
              : <LogOut className="w-6 h-6 text-white/40" />
            }
          </div>
          <h3 className="text-[18px] font-bold text-white mb-2 tracking-tight">
            {isHost ? '게더링을 종료할까요?' : '게더링을 나갈까요?'}
          </h3>
          <p className="text-[13.5px] text-white/35 leading-relaxed whitespace-pre-line">
            {isHost
              ? '방장이 나가면 게더링과 모든 대화 내용이\n영구적으로 삭제됩니다.'
              : '목록으로 돌아갑니다.\n언제든 다시 참여할 수 있습니다.'
            }
          </p>
        </div>
        <div className="px-4 pb-8 pt-4 flex gap-2.5 shrink-0">
          <button
            onClick={() => setShowLeaveConfirm(false)}
            className="flex-1 h-[50px] bg-[#2c2c2c] hover:bg-[#333] text-white/60 font-semibold rounded-2xl text-[15px] transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleLeaveOrDeleteRoom}
            className="flex-1 h-[50px] bg-[#FF203A] hover:bg-[#e01c34] text-white font-bold rounded-2xl text-[15px] transition-colors"
          >
            {isHost ? '종료 및 삭제' : '나가기'}
          </button>
        </div>
      </BottomSheet>

      {/* ───────── 멤버 바텀시트 ───────── */}
      <BottomSheet isOpen={showMembers} onClose={() => setShowMembers(false)} maxH="max-h-[75vh]">
        <div className="flex items-center justify-between px-5 pt-2 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[18px] font-bold text-white tracking-tight">참여자</h3>
            <span className="text-[12px] font-semibold text-[#FF203A] bg-[#FF203A]/10 px-2.5 py-[3px] rounded-full tabular-nums">
              {members.length}
            </span>
          </div>
          <button
            onClick={() => setShowMembers(false)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/35 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-8">
          <div className="space-y-0.5">
            {members.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-2 py-3 rounded-[16px] hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-[42px] h-[42px] rounded-[14px] bg-[#2e2e2e] border border-white/[0.06] overflow-hidden flex items-center justify-center text-[14px] font-medium text-white/38 shrink-0">
                  {m.avatar
                    ? <img src={m.avatar} className="w-full h-full object-cover" alt="" />
                    : m.name?.charAt(0)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-medium text-white/82">{m.name}</p>
                  {room?.host_id === m.id && (
                    <div className="flex items-center gap-1 mt-[2px]">
                      <Crown className="w-3 h-3 text-yellow-500/65" />
                      <span className="text-[11px] text-yellow-500/60 font-medium">호스트</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>

      {/* ───────── 이모티콘 바텀시트 ───────── */}
      <BottomSheet isOpen={showEmojiModal} onClose={() => setShowEmojiModal(false)} maxH="max-h-[52vh]">
        <div className="px-6 pt-3 pb-8 text-center relative overflow-hidden">
          {/* 배경 글로우 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-52 h-52 bg-[#FF203A]/8 blur-[60px] rounded-full pointer-events-none" />

          <div className="relative flex justify-center mb-5">
            <div className="w-[68px] h-[68px] rounded-[22px] bg-[#2a2a2a] border border-white/[0.07] flex items-center justify-center">
              <Rocket className="w-8 h-8 text-[#FF203A]" />
            </div>
            <motion.div
              className="absolute -top-2 -right-1"
              animate={{ y: [0, -7, 0], rotate: [0, 18, -8], scale: [1, 1.15, 1] }}
              transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
            >
              <Sparkles className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.55)]" />
            </motion.div>
          </div>

          <h3 className="text-[20px] font-bold text-white mb-2 tracking-tight relative">곧 만나요!</h3>
          <p className="text-[13.5px] text-white/35 leading-relaxed mb-7 relative">
            더 풍부한 감정 표현을 위해<br />
            <span className="text-[#FF203A] font-semibold">이모티콘 기능</span>을 준비하고 있습니다.
          </p>

          <button
            onClick={() => setShowEmojiModal(false)}
            className="w-full h-[50px] bg-[#2a2a2a] border border-white/[0.07] rounded-2xl text-white/60 font-semibold text-[15px] hover:bg-[#303030] transition-colors relative"
          >
            확인
          </button>
        </div>
      </BottomSheet>

      {/* ───────── 이미지 뷰어 ───────── */}
      <ImageViewerModal
        isOpen={isViewerOpen}
        initialIndex={initialImageIndex}
        images={allImages}
        onClose={() => setIsViewerOpen(false)}
      />
    </div>
  );
}

// ─── 이미지 뷰어 모달 ────────────────────────────────────────
function ImageViewerModal({ isOpen, initialIndex, images, onClose }: {
  isOpen: boolean; initialIndex: number; images: string[]; onClose: () => void;
}) {
  const [index, setIndex]         = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => { if (isOpen) setIndex(initialIndex); }, [isOpen, initialIndex]);

  const paginate = (d: number) => {
    const n = index + d;
    if (n >= 0 && n < images.length) { setDirection(d); setIndex(n); }
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -50 && index < images.length - 1) paginate(1);
    else if (info.offset.x > 50 && index > 0) paginate(-1);
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-black/98 backdrop-blur-2xl">
      {/* 상단 바 */}
      <div className="absolute top-0 left-0 w-full px-4 py-4 flex items-center justify-between z-20">
        <span className="text-white/45 text-[12px] font-mono bg-white/[0.07] px-3 py-1 rounded-full tabular-nums">
          {index + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-white/[0.08] rounded-full text-white/55 hover:bg-white/[0.14] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 좌우 버튼 (데스크탑) */}
      {index > 0 && (
        <button
          onClick={() => paginate(-1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.14] rounded-full text-white/45 hover:text-white z-20 hidden md:flex transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          onClick={() => paginate(1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.14] rounded-full text-white/45 hover:text-white z-20 hidden md:flex transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* 이미지 */}
      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={index}
            src={images[index]}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? 500 : -500, opacity: 0, scale: 0.92 }),
              center: { x: 0, opacity: 1, scale: 1 },
              exit:  (d: number) => ({ x: d < 0 ? 500 : -500, opacity: 0, scale: 0.92 }),
            }}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            className="absolute max-w-full max-h-full object-contain touch-none cursor-grab active:cursor-grabbing"
            alt=""
          />
        </AnimatePresence>
      </div>
    </div>
  );
}