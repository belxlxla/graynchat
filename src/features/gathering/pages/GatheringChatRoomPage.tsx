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

// --- 유틸리티 함수 ---
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
  if (content.includes('gathering-uploads') || content.includes('chat-uploads')) {
      return 'file';
  }
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

export default function GatheringChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // 참여자 수 정확도를 위한 별도 상태
  const [realParticipantCount, setRealParticipantCount] = useState<number>(0);
  
  // 모달 및 메뉴 상태
  const [showMembers, setShowMembers] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  
  // 이미지 뷰어 상태
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  const [members, setMembers] = useState<{ id: string; name: string; avatar: string | null }[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const messageIdsRef = useRef<Set<number>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const isHost = room?.host_id === user?.id;

  const allImages = useMemo(() => {
    return messages
      .filter(m => m.content && getFileType(m.content) === 'image')
      .map(m => m.content);
  }, [messages]);

  // 텍스트 입력창 높이 자동 조절 (UX 개선)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  // 초기 데이터 로드
  useEffect(() => {
    if (!roomId) return;

    const loadInitialData = async () => {
      try {
        // 1. 방 정보 로드
        const { data: roomData } = await supabase
          .from('gathering_rooms')
          .select('*')
          .eq('id', roomId)
          .single();
        
        if (roomData) setRoom(roomData);

        // 2. 실제 참여자 수 카운트 (정확성 보장)
        const { count } = await supabase
          .from('gathering_room_members')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId);
        
        if (count !== null) setRealParticipantCount(count);

        // 3. 메시지 로드
        const { data: msgData } = await supabase
          .from('gathering_messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })
          .limit(100);

        if (msgData) {
          setMessages(msgData);
          msgData.forEach((m) => messageIdsRef.current.add(m.id));
        }
      } catch (error) {
        console.error('Error loading chat:', error);
        toast.error('채팅방 정보를 불러올 수 없습니다.');
        navigate('/main/gathering');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [roomId, navigate]);

  // 실시간 구독 (메시지 + 멤버 변동 + 방 삭제 감지)
  useEffect(() => {
    if (!roomId) return;

    // 🔥 채널 이름에 타임스탬프를 넣어 유니크하게 생성 (연결 끊김 방지)
    const channel = supabase.channel(`gathering_room_${roomId}_${Date.now()}`)
      // 메시지 수신
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gathering_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (messageIdsRef.current.has(newMsg.id)) return;
          messageIdsRef.current.add(newMsg.id);
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      // 멤버 변경 시 참여자 수 업데이트
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'gathering_room_members', filter: `room_id=eq.${roomId}` },
        async () => {
           const { count } = await supabase
             .from('gathering_room_members')
             .select('*', { count: 'exact', head: true })
             .eq('room_id', roomId);
           if (count !== null) setRealParticipantCount(count);
        }
      )
      // 방 삭제 감지 (방장이 삭제했을 때 다른 인원들 튕기게)
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'gathering_rooms', filter: `id=eq.${roomId}` },
        () => {
          toast('방장이 채팅방을 종료했습니다.');
          navigate('/main/gathering', { replace: true });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Chatroom subscribed');
        }
      });

    channelRef.current = channel;
    
    // 컴포넌트 언마운트 시 채널 삭제
    return () => { 
        console.log('Cleaning up channel...');
        supabase.removeChannel(channel); 
    };
  }, [roomId, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || isSending) return;
    const content = input.trim();
    setInput('');
    setIsSending(true);
    setIsMenuOpen(false);

    try {
      // 1. 낙관적 업데이트 (화면에 먼저 표시)
      const optimisticMsg: ChatMessage = {
        id: Date.now(), // 임시 ID
        user_id: user.id,
        user_name: '나', // 로컬 표시용
        user_avatar: null, // 로컬 표시용
        content: content,
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // 2. 실제 DB 전송
      const { data: userData } = await supabase.from('users').select('name, avatar').eq('id', user.id).single();
      
      const { data: insertedMsg, error } = await supabase.from('gathering_messages').insert({
        room_id: roomId, 
        user_id: user.id,
        user_name: userData?.name || '사용자',
        user_avatar: userData?.avatar || null, 
        content,
      }).select().single();

      if (error) throw error;

      // 3. 성공 시 ID 교체 (중복 방지)
      if (insertedMsg) {
         messageIdsRef.current.add(insertedMsg.id);
         setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? insertedMsg : m));
      }

    } catch (err) {
      console.error(err);
      toast.error('메시지 전송 실패');
      setInput(content); // 실패 시 입력창 복구
      // 실패한 메시지 제거
      setMessages(prev => prev.filter(m => m.content !== content));
    } finally { 
      setIsSending(false); 
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId || !user) return;

    const uploadToast = toast.loading('파일 업로드 중...');
    setIsMenuOpen(false);

    try {
      const { data: userData } = await supabase.from('users').select('name, avatar').eq('id', user.id).single();
      
      const fileName = `${Date.now()}___${file.name.replace(/[^a-zA-Z0-9가-힣.]/g, '_')}`;
      const filePath = `${roomId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME) 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      await supabase.from('gathering_messages').insert({
        room_id: roomId, 
        user_id: user.id,
        user_name: userData?.name || '사용자',
        user_avatar: userData?.avatar || null, 
        content: publicUrl,
      });

      toast.success('전송 완료', { id: uploadToast });
    } catch (error) {
      console.error('Upload Error:', error);
      toast.error('전송 실패', { id: uploadToast });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  // 방 나가기 또는 삭제 처리 (핵심 로직 수정)
  const handleLeaveOrDeleteRoom = async () => {
    if (!user || !roomId) return;
    
    try {
      if (isHost) {
        // 방장인 경우: 방 자체를 삭제 (Cascade 설정이 있다면 메시지/멤버 자동 삭제)
        // Cascade가 없더라도 최소한 방 목록에서는 사라짐
        await supabase.from('gathering_rooms').delete().eq('id', roomId);
        toast.success('게더링 챗을 삭제했습니다.');
      } else {
        // 일반 멤버인 경우: 멤버 테이블에서만 삭제
        await supabase.from('gathering_room_members').delete()
          .eq('room_id', roomId).eq('user_id', user.id);
        toast.success('게더링 챗을 나갔습니다.');
      }
      // 정확한 경로로 이동
      navigate('/main/gathering', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('요청 처리에 실패했습니다. (DB 설정 확인 필요)'); 
    }
  };

  const loadMembers = async () => {
    const { data } = await supabase.from('gathering_room_members').select('user_id').eq('room_id', roomId);
    if (data) {
      const ids = data.map((m) => m.user_id);
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

  const renderMessageContent = (msg: ChatMessage, isMe: boolean) => {
    const type = getFileType(msg.content);

    if (type === 'image') {
      return (
        <div className={`rounded-2xl overflow-hidden cursor-pointer max-w-[220px] shadow-sm ${isMe ? 'bg-[#FF203A]/10' : 'bg-[#2C2C2E]'}`}
             style={{ border: isMe ? '1px solid rgba(255, 32, 58, 0.2)' : '1px solid rgba(255,255,255,0.08)' }}>
          <img 
            src={msg.content} 
            alt="첨부 이미지" 
            className="w-full h-auto object-cover" 
            onClick={() => {
              const idx = allImages.indexOf(msg.content);
              if (idx !== -1) {
                setInitialImageIndex(idx);
                setIsViewerOpen(true);
              }
            }}
          />
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div className="rounded-2xl overflow-hidden max-w-[240px] bg-black border border-white/10">
          <video src={msg.content} controls playsInline className="w-full h-auto" />
        </div>
      );
    }

    if (['pdf', 'file', 'office', 'text-file'].includes(type)) {
        return (
          <div className={`flex items-center gap-0 p-1 rounded-2xl max-w-[260px] border transition-colors ${
            isMe ? 'bg-[#FF203A]/10 border-[#FF203A]/20' : 'bg-[#2C2C2E] border-[#3A3A3C]'
          }`}>
            <div 
              onClick={() => window.open(msg.content, '_blank')} 
              className="flex-1 flex items-center gap-3 p-2.5 cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isMe ? 'bg-[#FF203A]/20 border-[#FF203A]/30' : 'bg-[#3A3A3C] border-white/5'}`}>
                <FileText className={`w-5 h-5 ${isMe ? 'text-[#FF203A]' : 'text-white/80'}`} />
              </div>
              <div className="flex-1 min-w-0 mr-1">
                <p className="text-[13px] text-white truncate font-medium">{getFileName(msg.content)}</p>
                <p className="text-[10px] text-[#8E8E93] uppercase tracking-wide">{type}</p>
              </div>
            </div>
            <div className={`h-8 w-[1px] mx-1 ${isMe ? 'bg-[#FF203A]/20' : 'bg-white/10'}`} />
            <button 
              onClick={() => {
                const a = document.createElement('a');
                a.href = msg.content;
                a.download = getFileName(msg.content);
                a.click();
              }} 
              className="p-3 text-[#8E8E93] hover:text-white transition-all"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        );
    }

    return (
        <div
            className={`px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-sm transition-all ${
              isMe
                ? 'bg-[#FF203A] text-white rounded-[20px] rounded-tr-none'
                : 'bg-[#2C2C2E] text-white/90 rounded-[20px] rounded-tl-none border border-[#3A3A3C]'
            }`}
        >
            {msg.content}
        </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#121212]">
        <Loader2 className="w-6 h-6 animate-spin text-[#8E8E93]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#121212] text-white overflow-hidden">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0 bg-[#1C1C1E]/80 backdrop-blur-md border-b border-[#2C2C2E] z-20">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/main/gathering')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold text-white">
              {room?.title}
            </h2>
            {room?.category && (
              <span className="text-[10px] shrink-0 px-2 py-0.5 rounded-full bg-[#3A3A3C] text-[#8E8E93] border border-white/5">
                {room.category}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#8E8E93] mt-0.5">
            {realParticipantCount}명 참여 중
          </p>
        </div>

        <div className="flex items-center gap-1">
          <motion.button whileTap={{ scale: 0.9 }} onClick={loadMembers}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-[#8E8E93] hover:text-white">
            <Users className="w-5 h-5" />
          </motion.button>

          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowLeaveConfirm(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-[#8E8E93] hover:text-[#FF203A]">
            {isHost ? <Trash2 className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
          </motion.button>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col bg-[#121212]">
        {messages.length === 0 && (
          <div className="text-center py-20 my-auto opacity-50">
            <div className="w-16 h-16 bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                <Hash className="w-8 h-8 text-[#636366]" />
            </div>
            <p className="text-sm text-[#8E8E93]">대화를 시작해보세요!</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.user_id === user?.id;
          const prevMsg = messages[idx - 1];
          const showDay = !prevMsg || getDayStr(msg.created_at) !== getDayStr(prevMsg.created_at);
          const showAvatar = !isMe && (!prevMsg || prevMsg.user_id !== msg.user_id || showDay);

          return (
            <div key={msg.id}>
              {showDay && (
                <div className="flex items-center gap-4 py-6">
                  <div className="flex-1 h-[1px] bg-[#2C2C2E]" />
                  <span className="text-[11px] font-medium text-[#636366] bg-[#1C1C1E] px-3 py-1 rounded-full border border-[#2C2C2E]">
                    {getDayStr(msg.created_at)}
                  </span>
                  <div className="flex-1 h-[1px] bg-[#2C2C2E]" />
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-4' : 'mt-1'}`}
              >
                {!isMe && (
                  <div className="w-9 h-9 shrink-0 mr-3 self-start">
                    {showAvatar ? (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden bg-[#2C2C2E] border border-white/5 text-[#8E8E93]">
                        {msg.user_avatar
                          ? <img src={msg.user_avatar} className="w-full h-full object-cover" alt="" />
                          : msg.user_name?.charAt(0)}
                      </div>
                    ) : <div className="w-9" />}
                  </div>
                )}

                <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && showAvatar && (
                    <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                      <span className="text-[12px] text-[#8E8E93] font-medium">
                        {msg.user_name}
                      </span>
                      {room?.host_id === msg.user_id && (
                        <Crown className="w-3 h-3 text-yellow-500/80" />
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    {isMe && (
                      <span className="text-[10px] text-[#636366] mb-1 shrink-0">
                        {getTimeStr(msg.created_at)}
                      </span>
                    )}
                    
                    {renderMessageContent(msg, isMe)}

                    {!isMe && (
                      <span className="text-[10px] text-[#636366] mb-1 shrink-0">
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

      {/* 개선된 입력창 및 메뉴 영역 */}
      <div className="px-3 pb-3 pt-2 shrink-0 relative z-30 bg-[#1C1C1E] border-t border-[#2C2C2E]">
        <div className="flex items-end gap-2">
          {/* 플러스 버튼 */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                isMenuOpen 
                ? 'bg-white text-black rotate-45' 
                : 'bg-[#2C2C2E] text-[#8E8E93] hover:text-white border border-[#3A3A3C]'
            }`}
          >
            <Plus className="w-6 h-6" />
          </motion.button>

          {/* 텍스트 입력 영역 (높이 자동 조절) */}
          <div className="flex-1 bg-[#2C2C2E] rounded-[24px] px-4 py-2.5 border border-[#3A3A3C] focus-within:border-[#8E8E93]/50 transition-colors flex items-center min-h-[44px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="메시지를 입력하세요"
              rows={1}
              className="bg-transparent text-[15px] w-full focus:outline-none placeholder-[#636366] text-white resize-none max-h-[120px] custom-scrollbar leading-[1.4]"
              style={{ padding: 0 }}
            />
          </div>

          {/* 전송 버튼 (활성화 시 색상 변경) */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                input.trim() 
                ? 'bg-[#FF203A] text-white shadow-lg shadow-[#FF203A]/20' 
                : 'bg-[#2C2C2E] text-[#636366] border border-[#3A3A3C]'
            }`}
          >
            {isSending
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Send className="w-5 h-5 ml-0.5" />
            }
          </motion.button>
        </div>

        {/* 플러스 메뉴 팝업 */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-[60px] left-3 bg-[#1C1C1E]/95 backdrop-blur-xl rounded-2xl p-4 border border-[#3A3A3C] shadow-2xl z-40"
              style={{ minWidth: '280px' }}
            >
              <div className="grid grid-cols-4 gap-4">
                {[
                    { icon: ImageIcon, label: '앨범', onClick: () => fileInputRef.current?.click() },
                    { icon: Camera, label: '카메라', onClick: () => cameraInputRef.current?.click() },
                    { icon: FileText, label: '파일', onClick: () => docInputRef.current?.click() },
                    { icon: Smile, label: '이모티콘', onClick: () => setShowEmojiModal(true) }
                ].map((item, i) => (
                    <button
                        key={i}
                        onClick={() => { item.onClick(); setIsMenuOpen(false); }}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="w-12 h-12 bg-[#2C2C2E] rounded-2xl flex items-center justify-center border border-[#3A3A3C] group-hover:bg-[#3A3A3C] group-hover:border-[#8E8E93]/30 transition-all">
                            <item.icon className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-xs text-[#8E8E93] group-hover:text-white transition-colors">{item.label}</span>
                    </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* 히든 파일 인풋 */}
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" ref={docInputRef} onChange={handleFileUpload} className="hidden" />

      {/* 나가기/삭제 확인 모달 */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowLeaveConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-[300px] rounded-[24px] overflow-hidden bg-[#1C1C1E] border border-[#3A3A3C] shadow-2xl"
            >
              <div className="px-6 pt-8 pb-6 text-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${isHost ? 'bg-[#FF203A]/10 border border-[#FF203A]/20' : 'bg-[#2C2C2E] border border-[#3A3A3C]'}`}>
                  {isHost ? (
                    <Trash2 className="w-7 h-7 text-[#FF203A]" />
                  ) : (
                    <LogOut className="w-7 h-7 text-[#8E8E93]" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {isHost ? '게더링을 종료할까요?' : '게더링을 나갈까요?'}
                </h3>
                <p className="text-[13px] leading-relaxed text-[#8E8E93]">
                  {isHost 
                    ? '방장이 나가면 게더링과 모든 대화 내용이\n영구적으로 삭제됩니다.' 
                    : '목록으로 돌아갑니다.\n언제든 다시 참여할 수 있습니다.'}
                </p>
              </div>
              <div className="flex border-t border-[#2C2C2E]">
                <button 
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-4 text-[14px] text-[#8E8E93] hover:text-white hover:bg-white/5 transition-colors font-medium border-r border-[#2C2C2E]"
                >
                  취소
                </button>
                <button 
                  onClick={handleLeaveOrDeleteRoom}
                  className="flex-1 py-4 text-[14px] text-[#FF203A] hover:bg-[#FF203A]/10 transition-colors font-bold"
                >
                  {isHost ? '종료 및 삭제' : '나가기'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 멤버 바텀시트 */}
      <AnimatePresence>
        {showMembers && (
          <div className="fixed inset-0 z-50 flex items-end">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowMembers(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="relative z-10 w-full rounded-t-[32px] px-6 pt-6 pb-12 bg-[#1C1C1E] border-t border-[#3A3A3C] shadow-2xl"
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-8 bg-[#3A3A3C]" />
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">참여자</span>
                    <span className="text-sm font-medium text-[#FF203A] bg-[#FF203A]/10 px-2 py-0.5 rounded-full">
                        {members.length}
                    </span>
                </div>
                <button onClick={() => setShowMembers(false)} className="p-2 -mr-2 text-[#8E8E93] hover:text-white">
                    <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden bg-[#2C2C2E] border border-[#3A3A3C] text-[#8E8E93]">
                      {m.avatar
                        ? <img src={m.avatar} className="w-full h-full object-cover" alt="" />
                        : m.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-[15px] font-medium text-white/90">{m.name}</p>
                      {room?.host_id === m.id && (
                        <div className="flex items-center gap-1 mt-1">
                          <Crown className="w-3.5 h-3.5 text-yellow-500" />
                          <span className="text-[11px] text-yellow-500/90 font-medium">호스트</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* 이모티콘 모달 */}
      <AnimatePresence>
        {showEmojiModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setShowEmojiModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-[320px] bg-[#1C1C1E] border border-[#3A3A3C] rounded-[32px] p-8 overflow-hidden shadow-2xl text-center"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FF203A]/10 blur-[80px] rounded-full pointer-events-none" />
              <button onClick={() => setShowEmojiModal(false)} className="absolute top-5 right-5 text-[#8E8E93] hover:text-white">
                <X className="w-6 h-6" />
              </button>

              <div className="relative mb-6 flex justify-center">
                <div className="w-24 h-24 bg-gradient-to-b from-[#2C2C2E] to-[#1C1C1E] rounded-full flex items-center justify-center shadow-lg border border-[#3A3A3C] relative z-10">
                  <Rocket className="w-12 h-12 text-[#FF203A] fill-[#FF203A]/20 -ml-1 -mt-1" />
                </div>
                <motion.div 
                  className="absolute -top-2 -right-1 z-20"
                  animate={{ y: [0, -8, 0], rotate: [0, 15, -5], scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity, repeatType: "mirror" }}
                >
                  <Sparkles className="w-8 h-8 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                </motion.div>
              </div>

              <h3 className="text-xl font-bold text-white mb-3">곧 만나요!</h3>
              <p className="text-[14px] text-[#8E8E93] leading-relaxed mb-8">
                더 풍부한 감정 표현을 위해<br/>
                <span className="text-[#FF203A] font-semibold">이모티콘 기능</span>을 준비하고 있습니다.
              </p>

              <button 
                onClick={() => setShowEmojiModal(false)}
                className="w-full py-4 bg-[#FF203A] rounded-2xl text-white font-bold text-[15px] hover:bg-[#FF203A]/90 transition-all shadow-lg shadow-[#FF203A]/20"
              >
                확인
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 이미지 뷰어 */}
      <ImageViewerModal 
        isOpen={isViewerOpen} 
        initialIndex={initialImageIndex} 
        images={allImages} 
        onClose={() => setIsViewerOpen(false)} 
      />
    </div>
  );
}

function ImageViewerModal({ isOpen, initialIndex, images, onClose }: { 
  isOpen: boolean; initialIndex: number; images: string[]; onClose: () => void; 
}) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => { if (isOpen) setIndex(initialIndex); }, [isOpen, initialIndex]);

  const paginate = (d: number) => { 
    const n = index + d; 
    if (n >= 0 && n < images.length) { 
      setDirection(d); 
      setIndex(n); 
    } 
  };

  const handleDragEnd = (_: any, info: any) => { 
    if (info.offset.x < -50 && index < images.length - 1) paginate(1); 
    else if (info.offset.x > 50 && index > 0) paginate(-1); 
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-black/98 backdrop-blur-2xl">
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between z-20">
        <span className="text-white/80 font-mono text-sm bg-black/40 px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </span>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {index > 0 && (
        <button 
          onClick={() => paginate(-1)} 
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block transition-all"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      
      {index < images.length - 1 && (
        <button 
          onClick={() => paginate(1)} 
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block transition-all"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
      
      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img 
            key={index} 
            src={images[index]} 
            custom={direction} 
            variants={{
              enter: (d: number) => ({ x: d > 0 ? 500 : -500, opacity: 0, scale: 0.9 }),
              center: { x: 0, opacity: 1, scale: 1 },
              exit: (d: number) => ({ x: d < 0 ? 500 : -500, opacity: 0, scale: 0.9 })
            }}
            initial="enter" animate="center" exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7}
            onDragEnd={handleDragEnd}
            className="absolute max-w-full max-h-full object-contain touch-none cursor-grab active:cursor-grabbing" 
            alt="" 
          />
        </AnimatePresence>
      </div>
    </div>
  );
}