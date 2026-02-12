import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Send, MoreHorizontal, ShieldAlert,
  Search, ChevronUp, ChevronDown, Plus, ImageIcon,
  Camera, FileText, Smile, X, Download, ChevronRight,
  User as UserIcon, Ban, Sparkles, Rocket, Users, Hourglass,
  WifiOff, RefreshCw, Trash2, AlertCircle, ExternalLink, Link as LinkIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── 타입 ────────────────────────────────────────────────────
interface Message {
  id: number;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  isFailed?: boolean;
  isRetrying?: boolean;
  tempId?: string;
}

interface MemberProfile {
  id: string;
  name: string;
  avatar: string | null;
}

interface TimeCapsuleNotice {
  id: string;
  unlock_at: string;
  receiver_name: string;
}

// ─── 유틸 ────────────────────────────────────────────────────
const isUrl = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  // https://, http://, www. 로 시작하는지 체크
  return /^(https?:\/\/|www\.)/i.test(trimmed);
};

const getFileType = (content: string) => {
  if (!content) return 'text';
  
  // URL 체크 (링크 우선)
  if (isUrl(content)) return 'link';
  
  const isStorageFile = content.includes('chat-uploads');
  if (isStorageFile) {
    const ext = content.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['mp4', 'mov', 'webm', 'avi', 'm4v'].includes(ext || '')) return 'video';
    if (['pdf'].includes(ext || '')) return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp'].includes(ext || '')) return 'office';
    if (['txt', 'log', 'md', 'json'].includes(ext || '')) return 'text-file';
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

const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  // www. 로 시작하면 https:// 추가
  if (trimmed.toLowerCase().startsWith('www.')) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

// ─── 공통 바텀시트 ───────────────────────────────────────────
function BottomSheet({ isOpen, onClose, children, maxH = 'max-h-[90vh]' }: {
  isOpen: boolean; onClose: () => void; children: React.ReactNode; maxH?: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
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
              <div className="w-9 h-[3px] bg-white/12 rounded-full" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════
export default function ChatRoomPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, wasOffline } = useNetworkStatus();

  const [messages, setMessages]             = useState<Message[]>([]);
  const [roomTitle, setRoomTitle]           = useState('대화 중...');
  const [roomAvatar, setRoomAvatar]         = useState<string | null>(null);
  const [isLoading, setIsLoading]           = useState(true);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [isFriend, setIsFriend]             = useState<boolean>(true);
  const [isBlocked, setIsBlocked]           = useState<boolean>(false);
  const [inputText, setInputText]           = useState('');
  const [isMenuOpen, setIsMenuOpen]         = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [background, setBackground]         = useState<string>('');
  const [isSearching, setIsSearching]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [isViewerOpen, setIsViewerOpen]     = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  const [timeCapsuleNotice, setTimeCapsuleNotice] = useState<TimeCapsuleNotice | null>(null);
  const [timeRemaining, setTimeRemaining]   = useState('');
  const [failedMessage, setFailedMessage]   = useState<Message | null>(null);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [pendingLink, setPendingLink]       = useState<string | null>(null);
  const [showLinkWarning, setShowLinkWarning] = useState(false);

  const scrollRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const messageRefs    = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef    = useRef<HTMLInputElement>(null);
  const channelRef     = useRef<RealtimeChannel | null>(null);
  const messageIdsRef  = useRef<Set<number>>(new Set());
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isGroupChat = chatId?.startsWith('group_') ?? false;

  const allImages = useMemo(() =>
    messages.filter(m => m.content && getFileType(m.content) === 'image').map(m => m.content),
  [messages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  const markAsRead = useCallback(async () => {
    if (!chatId || !user?.id || !isOnline) return;
    try {
      await supabase.from('room_members').update({ unread_count: 0 })
        .eq('room_id', chatId).eq('user_id', user.id);
    } catch (err) {
      console.warn('[ChatRoom] 읽음 처리 스킵:', err);
    }
  }, [chatId, user?.id, isOnline]);

  const fetchInitialData = useCallback(async () => {
    if (!chatId || !user?.id) { setIsLoading(false); return; }
    try {
      const { data: room } = await supabase.from('chat_rooms').select('*').eq('id', chatId).maybeSingle();
      const { data: myMember } = await supabase.from('room_members').select('wallpaper')
        .eq('room_id', chatId).eq('user_id', user.id).maybeSingle();
      setBackground(myMember?.wallpaper || '');

      const { data: members } = await supabase.from('room_members').select('user_id').eq('room_id', chatId);
      const memberIds = members?.map(m => m.user_id) || [];

      if (memberIds.length > 0) {
        const { data: profiles } = await supabase.from('users').select('id, name, avatar').in('id', memberIds);
        const profileMap: Record<string, MemberProfile> = {};
        profiles?.forEach(p => { profileMap[p.id] = { id: p.id, name: p.name, avatar: p.avatar }; });
        setMemberProfiles(profileMap);

        if (isGroupChat) {
          setRoomTitle(room?.title || `그룹 채팅 (${memberIds.length}명)`);
          setRoomAvatar(room?.avatar || null);
        } else {
          const friendId = memberIds.find(id => id !== user.id);
          if (friendId) {
            const fp = profileMap[friendId];
            const { data: friendRecord } = await supabase.from('friends').select('name, is_blocked')
              .eq('user_id', user.id).eq('friend_user_id', friendId).maybeSingle();
            setRoomTitle(fp?.name || '알 수 없는 사용자');
            setRoomAvatar(fp?.avatar || null);
            setIsFriend(!!friendRecord);
            setIsBlocked(!!friendRecord?.is_blocked);
          }
        }
      }

      const { data: msgData, error: msgError } = await supabase.from('messages').select('*')
        .eq('room_id', chatId).order('created_at', { ascending: true });
      if (msgError) throw msgError;
      messageIdsRef.current.clear();
      msgData?.forEach(m => messageIdsRef.current.add(m.id));
      setMessages(msgData || []);
      markAsRead();
    } catch (e) {
      console.error('[ChatRoom] 초기 데이터 로드 오류:', e);
      if (isOnline) toast.error('채팅방 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, user?.id, isGroupChat, markAsRead, isOnline]);

  const checkTimeCapsule = useCallback(async () => {
    if (!chatId || !user?.id || isGroupChat || !isOnline) { setTimeCapsuleNotice(null); return; }
    const friendId = chatId.split('_').find(id => id !== user.id);
    if (!friendId) return;
    try {
      const { data } = await supabase.from('time_capsules').select('id, unlock_at, receiver_id')
        .eq('sender_id', user.id).eq('receiver_id', friendId)
        .eq('is_unlocked', false).gte('unlock_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        const { data: rv } = await supabase.from('users').select('name').eq('id', data.receiver_id).single();
        setTimeCapsuleNotice({ id: data.id, unlock_at: data.unlock_at, receiver_name: rv?.name || '친구' });
      } else {
        setTimeCapsuleNotice(null);
      }
    } catch (error) { console.error('타임캡슐 확인 실패:', error); }
  }, [chatId, user?.id, isGroupChat, isOnline]);

  const getTimeUntilUnlock = useCallback(() => {
    if (!timeCapsuleNotice) return '';
    const diff = new Date(timeCapsuleNotice.unlock_at).getTime() - Date.now();
    if (diff <= 0) return '잠금 해제됨!';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (d > 0) return `${d}일 ${h}시간 ${m}분`;
    if (h > 0) return `${h}시간 ${m}분 ${s}초`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  }, [timeCapsuleNotice]);

  // ── chat_rooms 업데이트 헬퍼 (에러 무시) ──────────────────
  const updateChatRoomSafely = useCallback(async (lastMessage: string) => {
    if (!chatId) return;
    try {
      await supabase.from('chat_rooms').update({
        last_message: lastMessage.length > 50 ? lastMessage.substring(0, 47) + '...' : lastMessage,
        last_message_at: new Date().toISOString(),
      }).eq('id', chatId);
    } catch (err) {
      console.warn('[ChatRoom] chat_rooms 업데이트 실패 (무시):', err);
    }
  }, [chatId]);

  // ── 링크 클릭 핸들러 ────────────────────────────────────
  const handleLinkClick = (url: string, senderIsFriend: boolean) => {
    // 그룹 채팅이거나 친구인 경우 바로 열기
    if (isGroupChat || senderIsFriend) {
      const normalizedUrl = normalizeUrl(url);
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
    } else {
      // 친구가 아닌 경우 경고 모달 표시
      setPendingLink(url);
      setShowLinkWarning(true);
    }
  };

  const handleConfirmLink = () => {
    if (pendingLink) {
      const normalizedUrl = normalizeUrl(pendingLink);
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
    }
    setShowLinkWarning(false);
    setPendingLink(null);
  };

  useEffect(() => {
    if (wasOffline && isOnline) {
      toast.success('네트워크가 복구되었습니다.', { icon: '✅' });
      fetchInitialData();
    }
  }, [isOnline, wasOffline, fetchInitialData]);

  // ── 실시간 구독 (재연결 로직 개선) ─────────────────────────
  useEffect(() => {
    fetchInitialData();
    if (!chatId || !user?.id) return;

    const handleVisibilityChange = () => { if (!document.hidden) markAsRead(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', markAsRead);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const setupChannel = () => {
      const channel = supabase.channel(`room_messages_${chatId}_${Date.now()}`, {
        config: {
          broadcast: { self: false },
          presence: { key: user.id },
        },
      });

      channel.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${chatId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          if (messageIdsRef.current.has(newMsg.id)) return;
          messageIdsRef.current.add(newMsg.id);
          setMessages(prev => [...prev, newMsg]);
          scrollToBottom();
          if (newMsg.sender_id !== user.id) setTimeout(markAsRead, 300);
        }
      );

      channel.on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'room_members', filter: `room_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.user_id === user.id && updated.wallpaper !== undefined) {
            setBackground(updated.wallpaper || '');
          }
        }
      );

      channel.on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        () => fetchInitialData()
      );

      channel.subscribe((status) => {
        console.log('[Realtime] 상태:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ 연결 성공:', chatId);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Realtime] ⚠️ 연결 실패:', status);
          reconnectTimerRef.current = setTimeout(() => {
            console.log('[Realtime] 🔄 재연결 시도...');
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            channelRef.current = setupChannel();
          }, 3000);
        }
      });

      return channel;
    };

    channelRef.current = setupChannel();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', markAsRead);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatId, user?.id, fetchInitialData, markAsRead, scrollToBottom]);

  useEffect(() => { checkTimeCapsule(); }, [checkTimeCapsule]);

  useEffect(() => {
    if (!timeCapsuleNotice) return;
    const interval = setInterval(() => {
      if (new Date() >= new Date(timeCapsuleNotice.unlock_at)) {
        setTimeCapsuleNotice(null);
        toast.success('타임캡슐이 잠금 해제되었습니다! 🎉');
        checkTimeCapsule();
      } else setTimeRemaining(getTimeUntilUnlock());
    }, 1000);
    return () => clearInterval(interval);
  }, [timeCapsuleNotice, getTimeUntilUnlock, checkTimeCapsule]);

  useEffect(() => {
    if (!isSearching) scrollToBottom();
  }, [messages.length, isSearching, scrollToBottom]);

  // ── 메시지 전송 ─────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatId || !user || isBlocked) return;
    if (!isOnline) {
      toast.error('네트워크 연결을 확인해주세요.', { icon: '📡' });
      return;
    }

    const textToSend = inputText.trim();
    setInputText('');

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const tempMessage: Message = {
      id: Date.now(),
      room_id: chatId,
      sender_id: user.id,
      content: textToSend,
      created_at: new Date().toISOString(),
      is_read: false,
      tempId,
      isRetrying: false,
      isFailed: false,
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom('smooth');

    try {
      const { data: inserted, error: sendError } = await supabase
        .from('messages')
        .insert({
          room_id: chatId,
          sender_id: user.id,
          content: textToSend,
          is_read: false,
        })
        .select()
        .single();

      if (sendError) throw sendError;

      if (inserted) {
        messageIdsRef.current.add(inserted.id);
        setMessages(prev => prev.map(m => m.tempId === tempId ? { ...inserted } : m));
      }

      updateChatRoomSafely(textToSend);
    } catch (err: any) {
      console.error('[ChatRoom] 메시지 전송 실패:', err);
      setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, isFailed: true } : m));
      toast.error('메시지 전송에 실패했습니다.', { icon: '❌' });
    }
  };

  // ── 파일 업로드 ─────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;
    if (!isOnline) {
      toast.error('네트워크 연결을 확인해주세요.', { icon: '📡' });
      return;
    }

    const uploadToast = toast.loading('파일 전송 중...');
    setIsMenuOpen(false);

    const tempId = `temp_file_${Date.now()}_${Math.random()}`;
    const localUrl = URL.createObjectURL(file);
    const tempMessage: Message = {
      id: Date.now(),
      room_id: chatId,
      sender_id: user.id,
      content: localUrl,
      created_at: new Date().toISOString(),
      is_read: false,
      tempId,
      isRetrying: true,
      isFailed: false,
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom('smooth');

    try {
      const fileName = `${Date.now()}___${file.name.replace(/[^a-zA-Z0-9가-힣.]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(`${chatId}/${fileName}`, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(`${chatId}/${fileName}`);

      const { data: newMsg, error: insertError } = await supabase
        .from('messages')
        .insert({
          room_id: chatId,
          sender_id: user.id,
          content: publicUrl,
          is_read: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (newMsg) {
        messageIdsRef.current.add(newMsg.id);
        setMessages(prev => prev.map(m => m.tempId === tempId ? { ...newMsg } : m));
      }

      updateChatRoomSafely('파일을 보냈습니다.');
      toast.success('전송 완료', { id: uploadToast });
    } catch (error) {
      console.error('[ChatRoom] 파일 업로드 실패:', error);
      setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, isFailed: true, isRetrying: false } : m));
      toast.error('전송 실패', { id: uploadToast });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
      URL.revokeObjectURL(localUrl);
    }
  };

  // ── 재전송 ──────────────────────────────────────────────
  const handleRetryMessage = async (msg: Message) => {
    if (!isOnline) {
      toast.error('네트워크 연결을 확인해주세요.', { icon: '📡' });
      return;
    }
    setMessages(prev => prev.map(m => m.tempId === msg.tempId ? { ...m, isRetrying: true, isFailed: false } : m));

    try {
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert({
          room_id: chatId!,
          sender_id: user!.id,
          content: msg.content,
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      if (inserted) {
        messageIdsRef.current.add(inserted.id);
        setMessages(prev => prev.map(m => m.tempId === msg.tempId ? { ...inserted } : m));
        toast.success('메시지가 전송되었습니다.');
      }

      updateChatRoomSafely(msg.content);
    } catch (err) {
      console.error('[ChatRoom] 재전송 실패:', err);
      setMessages(prev => prev.map(m => m.tempId === msg.tempId ? { ...m, isFailed: true, isRetrying: false } : m));
      toast.error('재전송에 실패했습니다.');
    }
    setShowRetryModal(false);
    setFailedMessage(null);
  };

  const handleDeleteMessage = (msg: Message) => {
    setMessages(prev => prev.filter(m => m.tempId !== msg.tempId));
    setShowRetryModal(false);
    setFailedMessage(null);
    toast.success('메시지가 삭제되었습니다.');
  };

  // ── 친구 추가 / 차단 ────────────────────────────────────
  const handleAddFriend = async () => {
    if (!chatId || !user) return;
    const friendId = chatId.split('_').find(id => id !== user.id);
    if (!friendId) return;
    try {
      const { data: friendUser } = await supabase
        .from('users')
        .select('name, avatar, status_message')
        .eq('id', friendId)
        .maybeSingle();

      await supabase.from('friends').upsert({
        user_id: user.id,
        friend_user_id: friendId,
        name: friendUser?.name || roomTitle,
        avatar: friendUser?.avatar || roomAvatar,
        status: friendUser?.status_message || null,
        friendly_score: 10,
        is_blocked: false,
      });

      setIsFriend(true);
      setIsBlocked(false);
      toast.success('친구로 추가되었습니다.');
      fetchInitialData();
    } catch {
      toast.error('친구 추가에 실패했습니다.');
    }
  };

  const handleBlockUser = async () => {
    if (!chatId || !user) return;
    const friendId = chatId.split('_').find(id => id !== user.id);
    if (!friendId) return;
    if (!window.confirm('차단하시겠습니까? 차단하면 메시지를 받을 수 없습니다.')) return;

    try {
      const { data: friendUser } = await supabase
        .from('users')
        .select('name')
        .eq('id', friendId)
        .maybeSingle();

      await supabase.from('friends').upsert({
        user_id: user.id,
        friend_user_id: friendId,
        name: friendUser?.name || roomTitle,
        is_blocked: true,
      });

      setIsBlocked(true);
      toast.success('사용자가 차단되었습니다.');
    } catch {
      toast.error('차단에 실패했습니다.');
    }
  };

  // ── 검색 ────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages
      .filter(m => m.content && getFileType(m.content) === 'text' && m.content.toLowerCase().includes(q))
      .map(m => m.id);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (searchResults.length > 0 && currentSearchIndex === -1) {
      setCurrentSearchIndex(0);
      setTimeout(() => {
        messageRefs.current[searchResults[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [searchResults, currentSearchIndex]);

  const handleSearchMove = (dir: 'up' | 'down') => {
    if (!searchResults.length) return;
    const next = dir === 'up'
      ? (currentSearchIndex - 1 + searchResults.length) % searchResults.length
      : (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(next);
    messageRefs.current[searchResults[next]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCloseSearch = () => {
    setIsSearching(false);
    setSearchQuery('');
    setCurrentSearchIndex(-1);
  };

  // ── 메시지 렌더링 ────────────────────────────────────────
  const renderMessageContent = (msg: Message, isMe: boolean) => {
    const type = getFileType(msg.content);
    const isHighlighted = searchResults.includes(msg.id);
    const isCurrentSearch = searchResults[currentSearchIndex] === msg.id;

    // 링크 메시지
    if (type === 'link') {
      // 발신자가 친구인지 확인
      const senderIsFriend = isGroupChat || isMe || isFriend;

      return (
        <button
          onClick={() => !msg.isRetrying && !msg.isFailed && handleLinkClick(msg.content, senderIsFriend)}
          disabled={msg.isRetrying || msg.isFailed}
          className={`flex items-center gap-3 max-w-[280px] px-4 py-3 rounded-[18px] border transition-all text-left group ${
            isMe
              ? 'bg-[#FF203A]/10 border-[#FF203A]/30 hover:bg-[#FF203A]/15'
              : 'bg-[#2a2a2a] border-white/[0.07] hover:bg-[#303030]'
          } ${isHighlighted ? 'ring-2 ring-yellow-400/40' : ''} ${
            msg.isRetrying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
            isMe ? 'bg-[#FF203A]/20' : 'bg-blue-500/10'
          }`}>
            <LinkIcon className={`w-5 h-5 ${isMe ? 'text-[#FF203A]' : 'text-blue-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[13.5px] font-medium truncate ${
              isMe ? 'text-[#FF203A]' : 'text-blue-400'
            }`}>
              링크
            </p>
            <p className={`text-[11px] truncate mt-0.5 ${
              isMe ? 'text-white/50' : 'text-white/35'
            }`}>
              {msg.content.replace(/^https?:\/\//, '').substring(0, 40)}
            </p>
          </div>
          <ExternalLink className={`w-4 h-4 shrink-0 ${
            isMe ? 'text-[#FF203A]/60' : 'text-white/25'
          } group-hover:text-white/50 transition-colors`} />
        </button>
      );
    }

    if (type === 'image') {
      return (
        <div
          className={`rounded-[18px] overflow-hidden max-w-[220px] cursor-pointer relative border ${
            isHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-white/[0.06]'
          } ${msg.isRetrying ? 'opacity-50' : ''}`}
        >
          <img
            src={msg.content}
            alt=""
            className="w-full h-auto object-cover"
            onClick={() => {
              if (!msg.isRetrying && !msg.isFailed) {
                setInitialImageIndex(allImages.indexOf(msg.content));
                setIsViewerOpen(true);
              }
            }}
          />
          {msg.isRetrying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[18px]">
              <RefreshCw className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div
          className={`rounded-[18px] overflow-hidden max-w-[260px] bg-black border ${
            isHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-white/[0.06]'
          } ${msg.isRetrying ? 'opacity-50' : ''}`}
        >
          <video src={msg.content} controls playsInline className="w-full h-auto max-h-[280px]" />
        </div>
      );
    }

    if (['pdf', 'file', 'office', 'text-file'].includes(type)) {
      return (
        <div
          className={`flex items-stretch max-w-[268px] bg-[#2a2a2a] rounded-[18px] border overflow-hidden ${
            isHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-white/[0.07]'
          } ${msg.isRetrying ? 'opacity-50' : ''}`}
        >
          <button
            onClick={() => !msg.isRetrying && !msg.isFailed && window.open(msg.content, '_blank')}
            className="flex-1 flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.04] transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-[12px] bg-[#FF203A]/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#FF203A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] text-white/90 truncate font-medium">{getFileName(msg.content)}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">
                {type.replace('-file', '').toUpperCase()}
              </p>
            </div>
          </button>
          <div className="w-px bg-white/[0.06]" />
          <button
            onClick={() => {
              if (!msg.isRetrying && !msg.isFailed) {
                const a = document.createElement('a');
                a.href = msg.content;
                a.download = getFileName(msg.content);
                a.click();
              }
            }}
            className="px-3.5 flex items-center text-white/35 hover:text-white/70 transition-colors"
          >
            <Download className="w-4.5 h-4.5" />
          </button>
        </div>
      );
    }

    const renderHighlightedText = (text: string) => {
      if (!searchQuery.trim() || !isHighlighted) return text;
      const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === searchQuery.toLowerCase() ? (
          <mark
            key={i}
            className={`${
              isCurrentSearch ? 'bg-yellow-300 text-black' : 'bg-yellow-200/40 text-white'
            } rounded px-0.5`}
          >
            {part}
          </mark>
        ) : (
          part
        )
      );
    };

    return (
      <div
        className={`px-[14px] py-[9px] text-[14.5px] leading-[1.55] break-words ${
          isMe
            ? 'bg-[#FF203A] text-white rounded-[18px] rounded-tr-[5px]'
            : 'bg-[#2a2a2a] text-white/92 rounded-[18px] rounded-tl-[5px] border border-white/[0.07]'
        } ${isHighlighted ? 'ring-2 ring-yellow-400/40' : ''} ${msg.isRetrying ? 'opacity-60' : ''}`}
      >
        {renderHighlightedText(msg.content)}
      </div>
    );
  };

  // ── 배경 스타일 ─────────────────────────────────────────
  const isImageBg = background && !background.startsWith('#') && !background.startsWith('rgb');
  const bgStyle = {
    backgroundColor: isImageBg ? '#212121' : background || '#212121',
    backgroundImage: isImageBg ? `url(${background})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    transition: 'background 0.3s ease',
  };

  return (
    <div className="flex flex-col h-[100dvh] text-white overflow-hidden relative" style={bgStyle}>
      {isImageBg && <div className="absolute inset-0 bg-black/45 pointer-events-none" />}

      {/* ── 오프라인 배너 ─ */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -44, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -44, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="absolute top-0 left-0 right-0 z-50 bg-[#FF203A] px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg"
          >
            <WifiOff className="w-4 h-4" />
            <span className="text-[13px] font-semibold">네트워크 연결이 끊어졌습니다</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 헤더 ─ */}
      <header className="h-[54px] px-3 flex items-center justify-between shrink-0 z-30 relative bg-[#212121]/88 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/main/chats')}
            className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/75 hover:bg-white/[0.07] transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="w-[34px] h-[34px] rounded-[11px] bg-[#2e2e2e] overflow-hidden border border-white/[0.07] shrink-0">
            {roomAvatar ? (
              <img src={roomAvatar} className="w-full h-full object-cover" alt="" />
            ) : isGroupChat ? (
              <Users className="w-4 h-4 m-auto mt-[9px] text-white/25" />
            ) : (
              <UserIcon className="w-4 h-4 m-auto mt-[9px] text-white/25" />
            )}
          </div>
          <h1 className="text-[15.5px] font-semibold text-white/90 tracking-tight truncate max-w-[160px]">
            {roomTitle}
          </h1>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setIsSearching(!isSearching)}
            className={`w-9 h-9 flex items-center justify-center rounded-[12px] transition-colors ${
              isSearching
                ? 'bg-[#FF203A]/15 text-[#FF203A]'
                : 'text-white/55 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => navigate(`/chat/room/${chatId}/settings`)}
            className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/55 hover:bg-white/[0.07] hover:text-white transition-colors"
          >
            <MoreHorizontal className="w-[18px] h-[18px]" />
          </button>
        </div>
      </header>

      {/* ── 검색 바 ─ */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#1e1e1e]/95 backdrop-blur-xl px-4 py-2.5 border-b border-white/[0.05] flex items-center gap-2.5 overflow-hidden z-20 relative"
          >
            <div className="flex-1 bg-[#2a2a2a] rounded-[13px] flex items-center px-3 h-[38px] border border-white/[0.05]">
              <Search className="w-3.5 h-3.5 text-white/28 mr-2 shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentSearchIndex(-1);
                }}
                placeholder="대화 내용 검색"
                className="flex-1 bg-transparent text-[13.5px] focus:outline-none text-white placeholder-white/22"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="ml-1.5 shrink-0">
                  <X className="w-3.5 h-3.5 text-white/28" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#2a2a2a] px-2.5 h-[38px] rounded-[13px] border border-white/[0.05]">
                <span className="text-[11.5px] text-white/65 font-medium whitespace-nowrap tabular-nums">
                  {currentSearchIndex + 1}/{searchResults.length}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleSearchMove('up')}
                    className="p-1 hover:bg-white/[0.07] rounded-lg transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-white/65" />
                  </button>
                  <button
                    onClick={() => handleSearchMove('down')}
                    className="p-1 hover:bg-white/[0.07] rounded-lg transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-white/65" />
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={handleCloseSearch}
              className="text-[13px] text-white/38 hover:text-white/70 px-1 whitespace-nowrap transition-colors"
            >
              닫기
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 미등록 사용자 배너 ─ */}
      <AnimatePresence>
        {!isLoading && !isGroupChat && !isFriend && !isBlocked && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-3 mt-2.5 mb-0 bg-[#2a2a2a] border border-white/[0.07] rounded-[16px] px-4 py-3 flex items-center justify-between z-20 relative"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-[#FF203A]/10 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-[#FF203A]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white/85">미등록 사용자</p>
                <p className="text-[11px] text-white/35">친구로 추가할 수 있어요</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBlockUser}
                className="h-8 px-3 bg-[#333] text-white/60 text-[12px] font-medium rounded-[10px] hover:bg-[#3a3a3a] transition-colors"
              >
                차단
              </button>
              <button
                onClick={handleAddFriend}
                className="h-8 px-3 bg-[#FF203A] text-white text-[12px] font-semibold rounded-[10px]"
              >
                친구 추가
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 차단 배너 ─ */}
      <AnimatePresence>
        {!isLoading && !isGroupChat && isBlocked && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-3 mt-2.5 bg-[#2a2a2a] border border-[#FF203A]/20 rounded-[16px] px-4 py-3 flex items-center justify-between z-20 relative"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-[#FF203A]/10 flex items-center justify-center">
                <Ban className="w-4 h-4 text-[#FF203A]" />
              </div>
              <p className="text-[13px] font-semibold text-[#FF203A]">차단된 사용자</p>
            </div>
            <button
              onClick={handleAddFriend}
              className="h-8 px-3 bg-[#333] text-white/65 text-[12px] font-medium rounded-[10px] hover:bg-[#3a3a3a] transition-colors"
            >
              차단 해제
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 타임캡슐 배너 ─ */}
      <AnimatePresence>
        {timeCapsuleNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-3 mt-2.5 bg-[#2a2418] border border-orange-500/20 rounded-[16px] px-4 py-3 z-20 relative"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/15 rounded-[12px] flex items-center justify-center shrink-0">
                <Hourglass className="w-[18px] h-[18px] text-orange-400 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-orange-300">
                  {timeCapsuleNotice.receiver_name}님 타임캡슐
                </p>
                <p className="text-[11px] text-orange-400/60 mt-0.5">
                  잠금 해제까지 {timeRemaining || getTimeUntilUnlock()}
                </p>
              </div>
              <div className="text-[11px] text-orange-400/70 font-mono bg-orange-500/10 px-2.5 py-1 rounded-full">
                {new Date(timeCapsuleNotice.unlock_at).toLocaleDateString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 메시지 영역 ─ */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-[10px] custom-scrollbar relative z-10">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <RefreshCw className="w-4 h-4 animate-spin text-white/25" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 pt-20">
            <div className="w-14 h-14 rounded-[18px] bg-white/[0.04] flex items-center justify-center">
              <Users className="w-6 h-6 text-white/18" />
            </div>
            <p className="text-[13.5px] text-white/28">아직 메시지가 없습니다</p>
            <p className="text-[12px] text-white/18">대화를 시작해보세요!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map(msg => {
              const isMe = msg.sender_id === user?.id;
              const sender = memberProfiles[msg.sender_id];

              return (
                <motion.div
                  key={msg.tempId || msg.id}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  ref={el => {
                    messageRefs.current[msg.id] = el as HTMLDivElement | null;
                  }}
                  className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <div className="w-[30px] h-[30px] rounded-[10px] bg-[#2e2e2e] overflow-hidden border border-white/[0.06] shrink-0 mb-[18px]">
                      {sender?.avatar ? (
                        <img src={sender.avatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <UserIcon className="w-3.5 h-3.5 m-auto mt-[8px] text-white/22" />
                      )}
                    </div>
                  )}

                  <div className={`max-w-[73%] flex flex-col gap-[3px] ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && isGroupChat && (
                      <span className="text-[11.5px] text-white/35 ml-1">
                        {sender?.name || '알 수 없는 사용자'}
                      </span>
                    )}

                    <div className="relative">
                      {renderMessageContent(msg, isMe)}
                      {msg.isFailed && isMe && (
                        <button
                          onClick={() => {
                            setFailedMessage(msg);
                            setShowRetryModal(true);
                          }}
                          className="absolute -left-7 top-1/2 -translate-y-1/2"
                        >
                          <AlertCircle className="w-5 h-5 text-[#FF203A]" />
                        </button>
                      )}
                    </div>

                    <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[10px] text-white/20 tabular-nums">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {msg.isRetrying && <RefreshCw className="w-2.5 h-2.5 text-white/22 animate-spin" />}
                    </div>
                  </div>

                  {isMe && <div className="w-0 shrink-0" />}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={scrollRef} />
      </div>

      {/* ── 입력창 ─ */}
      <div className="px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] bg-[#212121]/95 backdrop-blur-xl border-t border-white/[0.05] flex items-end gap-2 relative z-30">
        <button
          onClick={() => setIsMenuOpen(true)}
          className="w-[38px] h-[38px] flex items-center justify-center rounded-[12px] bg-[#2a2a2a] border border-white/[0.07] text-white/55 hover:text-white/80 hover:bg-[#303030] transition-colors shrink-0 mb-0.5"
        >
          <Plus className="w-[18px] h-[18px]" />
        </button>

        <div className="flex-1 bg-[#2a2a2a] rounded-[18px] border border-white/[0.07] flex items-end px-4 py-2.5 min-h-[40px]">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="메시지 입력..."
            className="flex-1 bg-transparent text-[14.5px] text-white/90 focus:outline-none resize-none max-h-28 placeholder-white/22 leading-[1.45]"
            rows={1}
          />
        </div>

        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim()}
          className={`w-[38px] h-[38px] flex items-center justify-center rounded-[12px] transition-all shrink-0 mb-0.5 ${
            inputText.trim()
              ? 'bg-[#FF203A] text-white shadow-lg shadow-[#FF203A]/30 scale-100'
              : 'bg-[#2a2a2a] text-white/22 border border-white/[0.07]'
          }`}
        >
          <Send className="w-[16px] h-[16px]" />
        </button>
      </div>

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />
      <input type="file" ref={docInputRef} onChange={handleFileUpload} className="hidden" />

      {/* ── 첨부 메뉴 (바텀시트) ─ */}
      <BottomSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} maxH="max-h-[38vh]">
        <div className="px-5 pt-1 pb-8">
          <p className="text-[11.5px] font-semibold text-white/28 uppercase tracking-widest mb-5">첨부하기</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                ref: fileInputRef,
                Icon: ImageIcon,
                label: '앨범',
                color: 'from-blue-500/20 to-blue-600/10',
                iconColor: 'text-blue-400',
              },
              {
                ref: cameraInputRef,
                Icon: Camera,
                label: '카메라',
                color: 'from-green-500/20 to-green-600/10',
                iconColor: 'text-green-400',
              },
              {
                ref: docInputRef,
                Icon: FileText,
                label: '파일',
                color: 'from-purple-500/20 to-purple-600/10',
                iconColor: 'text-purple-400',
              },
            ].map(({ ref, Icon, label, color, iconColor }) => (
              <button
                key={label}
                onClick={() => {
                  ref.current?.click();
                  setIsMenuOpen(false);
                }}
                className="flex flex-col items-center gap-2.5"
              >
                <div
                  className={`w-14 h-14 rounded-[18px] bg-gradient-to-br ${color} border border-white/[0.07] flex items-center justify-center`}
                >
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <span className="text-[11.5px] text-white/50">{label}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setShowEmojiModal(true);
                setIsMenuOpen(false);
              }}
              className="flex flex-col items-center gap-2.5"
            >
              <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-white/[0.07] flex items-center justify-center">
                <Smile className="w-6 h-6 text-yellow-400" />
              </div>
              <span className="text-[11.5px] text-white/50">이모티콘</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ── 링크 경고 모달 ─ */}
      <BottomSheet
        isOpen={showLinkWarning}
        onClose={() => {
          setShowLinkWarning(false);
          setPendingLink(null);
        }}
        maxH="max-h-[50vh]"
      >
        <div className="px-6 pt-4 pb-3 text-center">
          <div className="w-16 h-16 rounded-[22px] bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-[19px] font-bold text-white mb-2 tracking-tight">안전하지 않은 링크</h3>
          <p className="text-[14px] text-white/45 leading-relaxed mb-2">
            친구가 아니거나 차단된 사용자가
            <br />
            보낸 링크입니다.
          </p>
          <div className="bg-[#FF203A]/5 border border-[#FF203A]/15 rounded-[14px] px-4 py-3 mb-1">
            <p className="text-[12.5px] text-[#FF203A]/90 leading-relaxed">
              악성 링크일 수 있으며, 이 링크를 열어서 발생하는 피해에 대해{' '}
              <span className="font-bold">그레인은 책임지지 않습니다.</span>
            </p>
          </div>
          {pendingLink && (
            <div className="mt-3 px-3 py-2 bg-[#2a2a2a] rounded-[12px] border border-white/[0.05]">
              <p className="text-[11px] text-white/35 truncate">{pendingLink}</p>
            </div>
          )}
        </div>
        <div className="px-4 pb-8 pt-2 flex gap-2.5 shrink-0">
          <button
            onClick={() => {
              setShowLinkWarning(false);
              setPendingLink(null);
            }}
            className="flex-1 h-[52px] bg-[#2c2c2c] text-white/70 font-semibold rounded-2xl text-[15px] hover:bg-[#333] transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirmLink}
            className="flex-1 h-[52px] bg-orange-500 text-white font-bold rounded-2xl text-[15px] hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            링크 열기
          </button>
        </div>
      </BottomSheet>

      {/* ── 재전송 바텀시트 ─ */}
      <BottomSheet
        isOpen={showRetryModal && !!failedMessage}
        onClose={() => {
          setShowRetryModal(false);
          setFailedMessage(null);
        }}
        maxH="max-h-[44vh]"
      >
        <div className="px-6 pt-4 pb-3 text-center">
          <div className="w-14 h-14 rounded-[20px] bg-[#FF203A]/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-[#FF203A]" />
          </div>
          <h3 className="text-[18px] font-bold text-white mb-1.5 tracking-tight">전송 실패</h3>
          <p className="text-[13.5px] text-white/38 leading-relaxed">
            메시지 전송에 실패했습니다.
            <br />
            다시 시도하시겠습니까?
          </p>
        </div>
        <div className="px-4 pb-8 pt-2 flex gap-2.5 shrink-0">
          <button
            onClick={() => failedMessage && handleDeleteMessage(failedMessage)}
            className="flex-1 h-[50px] bg-[#2c2c2c] text-white/60 font-semibold rounded-2xl text-[15px] flex items-center justify-center gap-2 hover:bg-[#333] transition-colors"
          >
            <Trash2 className="w-4 h-4" /> 삭제
          </button>
          <button
            onClick={() => failedMessage && handleRetryMessage(failedMessage)}
            className="flex-1 h-[50px] bg-[#FF203A] text-white font-bold rounded-2xl text-[15px] flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> 재전송
          </button>
        </div>
      </BottomSheet>

      {/* ── 이모티콘 바텀시트 ─ */}
      <BottomSheet isOpen={showEmojiModal} onClose={() => setShowEmojiModal(false)} maxH="max-h-[52vh]">
        <div className="px-6 pt-4 pb-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FF203A]/10 blur-[50px] rounded-full pointer-events-none" />

          <div className="relative mb-6 flex justify-center">
            <div className="w-[72px] h-[72px] rounded-[22px] bg-[#2a2a2a] border border-white/[0.07] flex items-center justify-center">
              <Rocket className="w-9 h-9 text-[#FF203A]" />
            </div>
            <motion.div
              className="absolute -top-2 -right-1"
              animate={{ y: [0, -7, 0], rotate: [0, 18, -8], scale: [1, 1.15, 1] }}
              transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
            >
              <Sparkles className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" />
            </motion.div>
          </div>

          <h3 className="text-[20px] font-bold text-white mb-2.5 tracking-tight">이모티콘 기능</h3>
          <p className="text-[13.5px] text-white/38 leading-relaxed mb-7">
            그레인이 더 풍성한 앱이 되기 위해
            <br />
            <span className="text-[#FF203A] font-semibold">준비 중</span>입니다. 곧 오픈할게요!
          </p>

          <button
            onClick={() => setShowEmojiModal(false)}
            className="w-full h-[50px] bg-[#2a2a2a] border border-white/[0.07] rounded-2xl text-white/65 font-semibold text-[15px] hover:bg-[#303030] transition-colors"
          >
            확인
          </button>
        </div>
      </BottomSheet>

      <ImageViewerModal
        isOpen={isViewerOpen}
        initialIndex={initialImageIndex}
        images={allImages}
        onClose={() => setIsViewerOpen(false)}
      />
    </div>
  );
}

// ─── 이미지 뷰어 ─────────────────────────────────────────────
function ImageViewerModal({
  isOpen,
  initialIndex,
  images,
  onClose,
}: {
  isOpen: boolean;
  initialIndex: number;
  images: string[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

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
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
        <span className="text-white/55 font-mono text-[12px] bg-white/[0.07] px-3 py-1 rounded-full tabular-nums">
          {index + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-white/[0.08] rounded-full text-white/70 hover:bg-white/[0.14] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {index > 0 && (
        <button
          onClick={() => paginate(-1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/40 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-full z-20 hidden md:flex items-center justify-center transition-all"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          onClick={() => paginate(1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/40 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-full z-20 hidden md:flex items-center justify-center transition-all"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}

      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={index}
            src={images[index]}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? 600 : -600, opacity: 0, scale: 0.92 }),
              center: { x: 0, opacity: 1, scale: 1 },
              exit: (d: number) => ({ x: d < 0 ? 600 : -600, opacity: 0, scale: 0.92 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
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