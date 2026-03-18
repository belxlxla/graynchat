import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Send, MoreHorizontal, ShieldAlert,
  Search, ChevronUp, ChevronDown, Plus, ImageIcon,
  Camera, FileText, Smile, X, Download, ChevronRight,
  User as UserIcon, Ban, Sparkles, Rocket, Users, Hourglass,
  WifiOff, RefreshCw, Trash2, AlertCircle, ExternalLink, Link as LinkIcon, Hash
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
  message_type?: 'user' | 'system_join' | 'system_leave' | 'system_created';
  isFailed?: boolean;
  isRetrying?: boolean;
  tempId?: string;
}

interface MemberProfile {
  id: string;
  name: string;
  avatar_url: string | null;
}

// ✅ [수정 1] 단일 → 배열 대응을 위한 타입 유지 (개별 캡슐 단위)
interface TimeCapsuleNotice {
  id: string;
  scheduled_at: string;
  receiver_name: string;
}

// ─── 유틸 ────────────────────────────────────────────────────
const isUrl = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  return /^(https?:\/\/|www\.)/i.test(trimmed);
};

const getFileType = (content: string) => {
  if (!content) return 'text';
  const isStorageFile = content.includes('chat-uploads') || content.includes('supabase.co/storage');
  if (isStorageFile) {
    const ext = content.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['mp4', 'mov', 'webm', 'avi', 'm4v'].includes(ext || '')) return 'video';
    if (['pdf'].includes(ext || '')) return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp'].includes(ext || '')) return 'office';
    if (['txt', 'log', 'md', 'json'].includes(ext || '')) return 'text-file';
    return 'file';
  }
  if (isUrl(content)) return 'link';
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
  if (trimmed.toLowerCase().startsWith('www.')) return `https://${trimmed}`;
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
  const [activeMemberCount, setActiveMemberCount] = useState<number>(0);
  const [members, setMembers] = useState<Array<{
    user_id: string;
    left_at: string | null;
    created_at?: string;
  }>>([]);
  const [inputText, setInputText]           = useState('');
  const [isMenuOpen, setIsMenuOpen]         = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [background, setBackground]         = useState<string>('');
  const [isSearching, setIsSearching]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [isViewerOpen, setIsViewerOpen]     = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  // ✅ [수정 1] 단일 객체 → 배열로 교체
  const [timeCapsules, setTimeCapsules]     = useState<TimeCapsuleNotice[]>([]);
  const [activeCapsuleIdx, setActiveCapsuleIdx] = useState(0);
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

  // ✅ friendId 미리 계산 (setupChannel + 여러 곳에서 재사용)
  const friendId = useMemo(() => {
    if (isGroupChat || !chatId || !user?.id) return null;
    return chatId.split('_').find(id => id !== user.id) || null;
  }, [chatId, isGroupChat, user?.id]);

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
    if (!chatId || !user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', chatId)
        .maybeSingle();

      const { data: myMember } = await supabase
        .from('room_members')
        .select('wallpaper_url, created_at, left_at')
        .eq('room_id', chatId)
        .eq('user_id', user.id)
        .maybeSingle();

      setBackground(myMember?.wallpaper_url || '');

      const { data: membersData } = await supabase
        .from('room_members')
        .select('user_id, left_at, created_at')
        .eq('room_id', chatId);

      setMembers(membersData || []);

      const activeMemberIds = membersData?.filter(m => !m.left_at).map(m => m.user_id) || [];
      setActiveMemberCount(activeMemberIds.length);

      let memberIds = membersData?.map(m => m.user_id) || [];

      const { data: allMessagesInRoom } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('room_id', chatId);

      const messageSenderIds = [...new Set(allMessagesInRoom?.map(m => m.sender_id) || [])];
      const additionalSenders = messageSenderIds.filter(id => !memberIds.includes(id));
      if (additionalSenders.length > 0) memberIds = [...memberIds, ...additionalSenders];

      if (!isGroupChat && memberIds.length < 2) {
        const idsInUrl = chatId.split('_');
        const extractedFriendId = idsInUrl.find(id => id !== user.id);
        if (extractedFriendId && !memberIds.includes(extractedFriendId)) {
          memberIds.push(extractedFriendId);
        }
      }

      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('users').select('id, name').in('id', memberIds);

        const { data: profileImages } = await supabase
          .from('user_profiles').select('user_id, avatar_url').in('user_id', memberIds);

        const profileImagesMap = new Map(profileImages?.map(p => [p.user_id, p.avatar_url]) || []);
        const profileMap: Record<string, MemberProfile> = {};
        profiles?.forEach(p => {
          profileMap[p.id] = { id: p.id, name: p.name, avatar_url: profileImagesMap.get(p.id) || null };
        });
        setMemberProfiles(profileMap);

        if (isGroupChat) {
          setRoomTitle(room?.title || `그룹 채팅 (${activeMemberIds.length}명)`);
          setRoomAvatar(room?.avatar_url || null);
        } else {
          const fId = memberIds.find(id => id !== user.id);
          const friendMemberData = membersData?.find(m => m.user_id === fId);

          if (fId) {
            const friendProfile = profileMap[fId];
            const { data: myFriendRecord } = await supabase
              .from('friends').select('alias_name, is_blocked')
              .eq('user_id', user.id).eq('friend_user_id', fId).maybeSingle();

            let finalTitle = myFriendRecord?.alias_name || friendProfile?.name || '알 수 없는 사용자';
            if (friendMemberData && friendMemberData.left_at !== null) finalTitle = `${finalTitle} (나간 사용자)`;

            setRoomTitle(finalTitle);
            setRoomAvatar(friendProfile?.avatar_url || null);
            setIsFriend(!!myFriendRecord && !myFriendRecord.is_blocked);
            setIsBlocked(!!myFriendRecord?.is_blocked);
          }
        }
      }

      const joinedAt = myMember?.created_at;
      let msgQuery = supabase.from('messages').select('*').eq('room_id', chatId);
      if (joinedAt) msgQuery = msgQuery.gte('created_at', joinedAt);

      const { data: msgData, error: msgError } = await msgQuery.order('created_at', { ascending: true });
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

  // ✅ [수정 2] 인자를 받는 함수로 변경 (특정 캡슐의 남은 시간 계산)
  const getTimeUntilUnlock = useCallback((capsule: TimeCapsuleNotice) => {
    const diff = new Date(capsule.scheduled_at).getTime() - Date.now();
    if (diff <= 0) return '잠금 해제됨!';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (d > 0) return `${d}일 ${h}시간 ${m}분`;
    if (h > 0) return `${h}시간 ${m}분 ${s}초`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  }, []);

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

  const handleLinkClick = (url: string, senderIsFriend: boolean) => {
    if (isGroupChat || senderIsFriend) {
      window.open(normalizeUrl(url), '_blank', 'noopener,noreferrer');
    } else {
      setPendingLink(url);
      setShowLinkWarning(true);
    }
  };

  const handleConfirmLink = () => {
    if (pendingLink) window.open(normalizeUrl(pendingLink), '_blank', 'noopener,noreferrer');
    setShowLinkWarning(false);
    setPendingLink(null);
  };

  useEffect(() => {
    if (wasOffline && isOnline) {
      toast.success('네트워크가 복구되었습니다.', { icon: '✅' });
      fetchInitialData();
    }
  }, [isOnline, wasOffline, fetchInitialData]);

  // ✅ [수정 3] checkTimeCapsule — limit(1)/maybeSingle() 제거 → 배열로 전체 조회
  const checkTimeCapsule = useCallback(async () => {
    if (!chatId || !user?.id || isGroupChat || !isOnline || !friendId) {
      setTimeCapsules([]);
      return;
    }

    try {
      const { data } = await supabase
        .from('time_capsules')
        .select('id, scheduled_at, receiver_id, is_opened')
        .eq('sender_id', user.id)
        .eq('receiver_id', friendId)
        .eq('is_opened', false)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true }); // ← limit(1) 제거

      if (data && data.length > 0) {
        const { data: rv } = await supabase
          .from('users').select('name')
          .eq('id', data[0].receiver_id).single();

        const receiverName = rv?.name || '친구';
        setTimeCapsules(data.map(d => ({
          id: d.id,
          scheduled_at: d.scheduled_at,
          receiver_name: receiverName,
        })));
        setActiveCapsuleIdx(0);
      } else {
        setTimeCapsules([]);
      }
    } catch (error) {
      console.error('타임캡슐 확인 실패:', error);
    }
  }, [chatId, user?.id, isGroupChat, isOnline, friendId]);

  useEffect(() => { checkTimeCapsule(); }, [checkTimeCapsule]);

  // ✅ [수정 4] 배열 기반 interval — 해제된 캡슐 제거 후 다음 캡슐로 자동 전환
  useEffect(() => {
    if (timeCapsules.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      const remaining = timeCapsules.filter(c => new Date(c.scheduled_at) > now);

      if (remaining.length !== timeCapsules.length) {
        const justUnlocked = timeCapsules.length - remaining.length;
        setTimeCapsules(remaining);
        setActiveCapsuleIdx(0);
        toast.success(`타임캡슐 ${justUnlocked}개가 잠금 해제되었습니다! 🎉`);
        checkTimeCapsule();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeCapsules, checkTimeCapsule]);

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
        config: { broadcast: { self: false }, presence: { key: user.id } },
      });

      channel.on('postgres_changes',
        { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${chatId}` },
        async () => {
          const { data: updatedMembers } = await supabase
            .from('room_members').select('user_id, left_at').eq('room_id', chatId);
          setMembers(updatedMembers || []);
          const activeCount = updatedMembers?.filter(m => !m.left_at).length || 0;
          setActiveMemberCount(activeCount);
          if (isGroupChat) {
            const { data: room } = await supabase
              .from('chat_rooms').select('title').eq('id', chatId).single();
            setRoomTitle(room?.title || `그룹 채팅 (${activeCount}명)`);
          }
        }
      );

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
          if (updated.user_id === user.id && updated.wallpaper_url !== undefined) {
            setBackground(updated.wallpaper_url || '');
          }
        }
      );

      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => fetchInitialData());
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles' }, () => fetchInitialData());
      channel.on('postgres_changes',
        { event: '*', schema: 'public', table: 'friends', filter: `user_id=eq.${user.id}` },
        () => fetchInitialData()
      );

      // ✅ [수정 5] time_capsules 실시간 구독 추가 (1:1 채팅 전용)
      if (!isGroupChat && friendId) {
        // 내가 상대에게 새 캡슐 보냈을 때 배너 즉시 반영
        channel.on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'time_capsules',
            filter: `receiver_id=eq.${friendId}`,
          },
          () => {
            console.log('[TC] 새 캡슐 전송됨 → 배너 갱신');
            checkTimeCapsule();
          }
        );

        // 상대방이 캡슐을 열었을 때 배너에서 제거
        channel.on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'time_capsules',
            filter: `sender_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as any;
            if (updated.is_opened) {
              setTimeCapsules(prev => prev.filter(c => c.id !== updated.id));
              toast('상대방이 타임캡슐을 확인했어요 ✉️', { icon: '👀' });
            }
          }
        );
      }

      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reconnectTimerRef.current = setTimeout(() => {
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
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [chatId, user?.id, friendId, isGroupChat, fetchInitialData, markAsRead, scrollToBottom, checkTimeCapsule]);

  useEffect(() => {
    if (!isSearching) scrollToBottom();
  }, [messages.length, isSearching, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatId || !user || isBlocked) return;
    if (!isOnline) { toast.error('네트워크 연결을 확인해주세요.', { icon: '📡' }); return; }

    const textToSend = inputText.trim();
    setInputText('');
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const tempMessage: Message = {
      id: Date.now(), room_id: chatId, sender_id: user.id, content: textToSend,
      created_at: new Date().toISOString(), is_read: false, tempId, isRetrying: false, isFailed: false,
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom('smooth');

    try {
      const { data: inserted, error: sendError } = await supabase
        .from('messages').insert({ room_id: chatId, sender_id: user.id, content: textToSend })
        .select().single();
      if (sendError) throw sendError;
      if (inserted) {
        messageIdsRef.current.add(inserted.id);
        setMessages(prev => prev.map(m => m.tempId === tempId ? { ...inserted } : m));
      }
      updateChatRoomSafely(textToSend);
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, isFailed: true } : m));
      toast.error('메시지 전송에 실패했습니다.', { icon: '❌' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;
    if (!isOnline) { toast.error('네트워크 연결을 확인해주세요.', { icon: '📡' }); return; }

    const uploadToast = toast.loading('파일 전송 중...');
    setIsMenuOpen(false);
    const tempId = `temp_file_${Date.now()}_${Math.random()}`;
    const localUrl = URL.createObjectURL(file);
    setMessages(prev => [...prev, {
      id: Date.now(), room_id: chatId, sender_id: user.id, content: localUrl,
      created_at: new Date().toISOString(), is_read: false, tempId, isRetrying: true, isFailed: false,
    }]);
    scrollToBottom('smooth');

    try {
      const fileName = `${Date.now()}___${file.name.replace(/[^a-zA-Z0-9가-힣.]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('chat-uploads').upload(`${chatId}/${fileName}`, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat-uploads').getPublicUrl(`${chatId}/${fileName}`);
      const { data: newMsg, error: insertError } = await supabase
        .from('messages').insert({ room_id: chatId, sender_id: user.id, content: publicUrl })
        .select().single();
      if (insertError) throw insertError;

      if (newMsg) {
        messageIdsRef.current.add(newMsg.id);
        setMessages(prev => prev.map(m => m.tempId === tempId ? { ...newMsg } : m));
      }
      updateChatRoomSafely('파일을 보냈습니다.');
      toast.success('전송 완료', { id: uploadToast });
    } catch (error) {
      setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, isFailed: true, isRetrying: false } : m));
      toast.error('전송 실패', { id: uploadToast });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleRetryMessage = async (msg: Message) => {
    if (!isOnline) { toast.error('네트워크 연결을 확인해주세요.', { icon: '📡' }); return; }
    setMessages(prev => prev.map(m => m.tempId === msg.tempId ? { ...m, isRetrying: true, isFailed: false } : m));

    try {
      const { data: inserted, error } = await supabase
        .from('messages').insert({ room_id: chatId!, sender_id: user!.id, content: msg.content })
        .select().single();
      if (error) throw error;
      if (inserted) {
        messageIdsRef.current.add(inserted.id);
        setMessages(prev => prev.map(m => m.tempId === msg.tempId ? { ...inserted } : m));
        toast.success('메시지가 전송되었습니다.');
      }
      updateChatRoomSafely(msg.content);
    } catch (err) {
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

  const handleAddFriend = async () => {
    if (!chatId || !user || !friendId) return;
    const loadingToast = toast.loading('친구 추가 중...');
    try {
      const { data: friendUser } = await supabase.from('users').select('name').eq('id', friendId).maybeSingle();
      const { data: friendProfile } = await supabase.from('user_profiles').select('avatar_url, status_message').eq('user_id', friendId).maybeSingle();

      const { error: friendsError } = await supabase.from('friends').upsert({
        user_id: user.id, friend_user_id: friendId,
        alias_name: friendUser?.name || roomTitle, avatar_url: friendProfile?.avatar_url || roomAvatar,
        status: friendProfile?.status_message || null, friendly_score: 10, is_blocked: false,
      }, { onConflict: 'user_id,friend_user_id' });
      if (friendsError) throw friendsError;

      await supabase.from('friendships').upsert({
        user_id: user.id, friend_id: friendId, status: 'ACCEPTED', updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,friend_id' });

      setIsFriend(true); setIsBlocked(false);
      toast.dismiss(loadingToast);
      toast.success('친구로 추가되었습니다.');
      fetchInitialData();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('친구 추가에 실패했습니다.');
    }
  };

  const handleBlockUser = async () => {
    if (!chatId || !user || !friendId) return;
    if (!window.confirm('차단하시겠습니까? 차단하면 메시지를 받을 수 없습니다.')) return;
    const loadingToast = toast.loading('차단 중...');
    try {
      const { data: friendUser } = await supabase.from('users').select('name').eq('id', friendId).maybeSingle();
      const { error: friendsError } = await supabase.from('friends').upsert({
        user_id: user.id, friend_user_id: friendId,
        alias_name: friendUser?.name || roomTitle, is_blocked: true,
      }, { onConflict: 'user_id,friend_user_id' });
      if (friendsError) throw friendsError;

      await supabase.from('friendships')
        .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

      setIsBlocked(true); setIsFriend(false);
      toast.dismiss(loadingToast);
      toast.success('사용자가 차단되었습니다.');
      fetchInitialData();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('차단 처리에 실패했습니다.');
    }
  };

  const handleUnblockUser = async () => {
    if (!chatId || !user || !friendId) return;
    const loadingToast = toast.loading('차단 해제 중...');
    try {
      const { error: friendsError } = await supabase.from('friends')
        .update({ is_blocked: false, hide_profile: false })
        .match({ user_id: user.id, friend_user_id: friendId });
      if (friendsError) throw friendsError;

      await supabase.from('friendships')
        .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

      setIsBlocked(false); setIsFriend(true);
      toast.dismiss(loadingToast);
      toast.success('차단이 해제되었습니다.');
      fetchInitialData();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('차단 해제에 실패했습니다.');
    }
  };

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

  const renderMessageContent = (msg: Message, isMe: boolean) => {
    const type = getFileType(msg.content);
    const isHighlighted = searchResults.includes(msg.id);
    const isCurrentSearch = searchResults[currentSearchIndex] === msg.id;

    if (type === 'link') {
      const senderIsFriend = isGroupChat || isMe || isFriend;
      return (
        <button
          onClick={() => !msg.isRetrying && !msg.isFailed && handleLinkClick(msg.content, senderIsFriend)}
          disabled={msg.isRetrying || msg.isFailed}
          className={`flex items-center gap-3 max-w-[280px] px-4 py-3 rounded-[18px] border transition-all text-left group ${
            isMe ? 'bg-[#FF203A]/10 border-[#FF203A]/30 hover:bg-[#FF203A]/15' : 'bg-[#2a2a2a] border-white/[0.07] hover:bg-[#303030]'
          } ${isHighlighted ? 'ring-2 ring-yellow-400/40' : ''} ${msg.isRetrying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${isMe ? 'bg-[#FF203A]/20' : 'bg-blue-500/10'}`}>
            <LinkIcon className={`w-5 h-5 ${isMe ? 'text-[#FF203A]' : 'text-blue-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[13.5px] font-medium truncate ${isMe ? 'text-[#FF203A]' : 'text-blue-400'}`}>링크</p>
            <p className={`text-[11px] truncate mt-0.5 ${isMe ? 'text-white/50' : 'text-white/35'}`}>
              {msg.content.replace(/^https?:\/\//, '').substring(0, 40)}
            </p>
          </div>
          <ExternalLink className={`w-4 h-4 shrink-0 ${isMe ? 'text-[#FF203A]/60' : 'text-white/25'} group-hover:text-white/50 transition-colors`} />
        </button>
      );
    }

    if (msg.message_type && msg.message_type !== 'user') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="flex justify-center w-full my-2"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.06] backdrop-blur-sm rounded-full border border-white/[0.08] shadow-lg">
            {msg.message_type === 'system_created' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" />}
            {msg.message_type === 'system_join' && (
              <svg className="w-3.5 h-3.5 text-blue-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            )}
            {msg.message_type === 'system_leave' && (
              <svg className="w-3.5 h-3.5 text-orange-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
            <p className="text-[11.5px] font-medium text-white/45 tracking-tight">{msg.content}</p>
          </div>
        </motion.div>
      );
    }

    if (type === 'image') {
      return (
        <div className={`rounded-[18px] overflow-hidden max-w-[220px] cursor-pointer relative border ${isHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-white/[0.06]'} ${msg.isRetrying ? 'opacity-50' : ''}`}>
          <img src={msg.content} alt="" className="w-full h-auto object-cover"
            onClick={() => { if (!msg.isRetrying && !msg.isFailed) { setInitialImageIndex(allImages.indexOf(msg.content)); setIsViewerOpen(true); } }} />
          {msg.isRetrying && <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[18px]"><RefreshCw className="w-5 h-5 text-white animate-spin" /></div>}
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div className={`rounded-[18px] overflow-hidden max-w-[240px] bg-black border ${isHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-white/[0.06]'} ${msg.isRetrying ? 'opacity-50' : ''}`}>
          <video src={msg.content} controls playsInline className="w-full h-auto" />
        </div>
      );
    }

    if (['pdf', 'file', 'office', 'text-file'].includes(type)) {
      return (
        <div className={`flex items-stretch max-w-[260px] rounded-[18px] border overflow-hidden ${isMe ? 'bg-[#FF203A]/8 border-[#FF203A]/15' : 'bg-[#2a2a2a] border-white/[0.07]'} ${isHighlighted ? 'ring-2 ring-yellow-400/40' : ''} ${msg.isRetrying ? 'opacity-50' : ''}`}>
          <button onClick={() => !msg.isRetrying && !msg.isFailed && window.open(msg.content, '_blank')}
            className="flex-1 flex items-center gap-3 p-3 hover:bg-white/[0.04] transition-colors text-left">
            <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${isMe ? 'bg-[#FF203A]/15' : 'bg-[#FF203A]/10'}`}>
              <FileText className="w-5 h-5 text-[#FF203A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/88 truncate font-medium">{getFileName(msg.content)}</p>
              <p className="text-[10px] text-white/28 uppercase tracking-wider mt-0.5">{type.replace('-file', '').toUpperCase()}</p>
            </div>
          </button>
          <div className="w-px bg-white/[0.06] self-stretch" />
          <button onClick={() => { if (!msg.isRetrying && !msg.isFailed) { const a = document.createElement('a'); a.href = msg.content; a.download = getFileName(msg.content); a.click(); } }}
            className="px-3 flex items-center text-white/28 hover:text-white/60 transition-colors">
            <Download className="w-4 h-4" />
          </button>
        </div>
      );
    }

    const renderHighlightedText = (text: string) => {
      if (!searchQuery.trim() || !isHighlighted) return text;
      const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === searchQuery.toLowerCase() ? (
          <mark key={i} className={`${isCurrentSearch ? 'bg-yellow-300 text-black' : 'bg-yellow-200/40 text-white'} rounded px-0.5`}>{part}</mark>
        ) : part
      );
    };

    return (
      <div className={`px-[14px] py-[9px] text-[14.5px] leading-[1.55] break-words ${
        isMe ? 'bg-[#FF203A] text-white rounded-[18px] rounded-tr-[5px]' : 'bg-[#2a2a2a] text-white/90 rounded-[18px] rounded-tl-[5px] border border-white/[0.07]'
      } ${isHighlighted ? 'ring-2 ring-yellow-400/40' : ''} ${msg.isRetrying ? 'opacity-60' : ''}`}>
        {renderHighlightedText(msg.content)}
      </div>
    );
  };

  const isImageBg = background && !background.startsWith('#') && !background.startsWith('rgb');
  const bgStyle = {
    backgroundColor: isImageBg ? '#212121' : background || '#212121',
    backgroundImage: isImageBg ? `url(${background})` : undefined,
    backgroundSize: 'cover', backgroundPosition: 'center', transition: 'background 0.3s ease',
  };

  // 배너에 보여줄 현재 캡슐
  const activeCapsule = timeCapsules[activeCapsuleIdx] ?? null;

  return (
    <div className="flex flex-col h-[100dvh] text-white overflow-hidden relative" style={{ ...bgStyle, paddingTop: 'env(safe-area-inset-top)' }}>
      {isImageBg && <div className="absolute inset-0 bg-black/40 pointer-events-none" />}

      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="absolute top-0 left-0 right-0 z-50 bg-[#FF203A] px-4 py-3 flex items-center justify-center gap-2 shadow-lg"
          >
            <WifiOff className="w-5 h-5" />
            <span className="text-sm font-medium">네트워크 연결이 끊어졌습니다</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="h-[54px] px-3 flex items-center gap-2 shrink-0 z-30 bg-[#212121]/90 backdrop-blur-xl border-b border-white/[0.05] relative">
        <button onClick={() => navigate('/main/chats')}
          className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/55 hover:bg-white/[0.07] hover:text-white transition-colors shrink-0">
          <ChevronLeft className="w-[18px] h-[18px]" />
        </button>
        <div className="w-9 h-9 rounded-[14px] bg-[#2e2e2e] overflow-hidden border border-white/[0.06] shrink-0">
          {roomAvatar ? <img src={roomAvatar} className="w-full h-full object-cover" alt="" />
            : isGroupChat ? <Users className="w-5 h-5 m-auto mt-2 text-white/25" />
            : <UserIcon className="w-5 h-5 m-auto mt-2 text-white/25" />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15.5px] font-semibold text-white/90 tracking-tight truncate">{roomTitle}</h1>
          {isGroupChat && <p className="text-[11px] text-white/30 mt-[2px] tabular-nums">{activeMemberCount}명</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => setIsSearching(!isSearching)}
            className={`w-9 h-9 flex items-center justify-center rounded-[12px] transition-colors ${isSearching ? 'bg-[#FF203A]/15 text-[#FF203A]' : 'text-white/38 hover:bg-white/[0.07] hover:text-white/75'}`}>
            <Search className="w-[17px] h-[17px]" />
          </button>
          <button onClick={() => navigate(`/chat/room/${chatId}/settings`)}
            className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/38 hover:bg-white/[0.07] hover:text-white/75 transition-colors">
            <MoreHorizontal className="w-[17px] h-[17px]" />
          </button>
        </div>
      </header>

      {/* 검색바 */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#2C2C2E] px-4 py-3 border-b border-[#3A3A3C] flex items-center gap-3 overflow-hidden z-20 relative"
          >
            <div className="flex-1 bg-[#1C1C1E] rounded-xl flex items-center px-3 py-2 border border-[#3A3A3C]">
              <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
              <input autoFocus value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentSearchIndex(-1); }}
                placeholder="대화 내용 검색"
                className="flex-1 bg-transparent text-sm focus:outline-none text-white placeholder-[#636366]" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="ml-2"><X className="w-4 h-4 text-[#8E8E93]" /></button>}
            </div>
            {searchResults.length > 0 && (
              <div className="flex items-center gap-2 bg-[#1C1C1E] px-3 py-2 rounded-xl border border-[#3A3A3C]">
                <span className="text-xs text-white font-medium whitespace-nowrap tabular-nums">{currentSearchIndex + 1}/{searchResults.length}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSearchMove('up')} className="p-1 hover:bg-white/10 rounded transition-colors"><ChevronUp className="w-4 h-4 text-white" /></button>
                  <button onClick={() => handleSearchMove('down')} className="p-1 hover:bg-white/10 rounded transition-colors"><ChevronDown className="w-4 h-4 text-white" /></button>
                </div>
              </div>
            )}
            <button onClick={handleCloseSearch} className="text-xs text-[#8E8E93] hover:text-white px-2 whitespace-nowrap transition-colors">닫기</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 미등록 사용자 배너 */}
      <AnimatePresence>
        {!isLoading && !isGroupChat && !isFriend && !isBlocked && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-[#2C2C2E] p-4 flex items-center justify-between border-b border-[#3A3A3C] z-20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[12px] bg-[#FF203A]/10 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-[#FF203A]" /></div>
              <div><p className="text-sm font-bold text-white">미등록 사용자</p><p className="text-xs text-white/40">친구로 추가할 수 있어요</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBlockUser} className="bg-[#3A3A3C] px-3 py-2 rounded-xl text-xs font-medium text-white border border-white/10 hover:bg-[#454547] transition-colors">차단</button>
              <button onClick={handleAddFriend} className="bg-[#FF203A] px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-[#e01c34] transition-colors">친구 추가</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 차단 배너 */}
      <AnimatePresence>
        {!isLoading && !isGroupChat && isBlocked && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-[#2C2C2E] p-4 flex items-center justify-between border-b border-[#3A3A3C] z-20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[12px] bg-[#FF203A]/10 flex items-center justify-center"><Ban className="w-5 h-5 text-[#FF203A]" /></div>
              <p className="text-sm font-bold text-[#FF203A]">차단된 사용자</p>
            </div>
            <button onClick={handleUnblockUser} className="bg-[#3A3A3C] px-4 py-2 rounded-xl text-xs font-bold text-white border border-white/10 hover:bg-[#454547] transition-colors">차단 해제</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ [수정 6] 타임캡슐 배너 — 다중 캡슐 지원 + 클릭 이동 + 다음 캡슐 전환 버튼 */}
      <AnimatePresence>
        {activeCapsule && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => navigate('/time-capsule/sent')}
            className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-b border-orange-500/30 px-4 py-3 z-20 cursor-pointer active:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              {/* 아이콘 + 수 뱃지 */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Hourglass className="w-5 h-5 text-orange-400 animate-pulse" />
                </div>
                {timeCapsules.length > 1 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center border-2 border-[#212121]">
                    <span className="text-[9px] font-bold text-white">{timeCapsules.length}</span>
                  </div>
                )}
              </div>

              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-orange-400">
                  {activeCapsule.receiver_name}님 타임캡슐
                  {timeCapsules.length > 1 && (
                    <span className="text-orange-300/60 font-normal text-xs ml-2">외 {timeCapsules.length - 1}개</span>
                  )}
                </p>
                <p className="text-xs text-orange-300/80 mt-0.5">
                  잠금 해제까지 {getTimeUntilUnlock(activeCapsule)}
                </p>
              </div>

              {/* 여러 개일 때 좌우 전환 버튼 */}
              {timeCapsules.length > 1 ? (
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveCapsuleIdx(i => (i - 1 + timeCapsules.length) % timeCapsules.length)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-orange-500/20 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-orange-400" />
                  </button>
                  <span className="text-[10px] text-orange-400/70 tabular-nums font-mono">
                    {activeCapsuleIdx + 1}/{timeCapsules.length}
                  </span>
                  <button
                    onClick={() => setActiveCapsuleIdx(i => (i + 1) % timeCapsules.length)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-orange-500/20 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-orange-400" />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-orange-400 font-mono bg-orange-500/10 px-3 py-1 rounded-full shrink-0">
                  {new Date(activeCapsule.scheduled_at).toLocaleDateString('ko-KR', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="w-4 h-4 animate-spin text-white/25" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 pt-20">
            <div className="w-[52px] h-[52px] rounded-[17px] bg-white/[0.04] flex items-center justify-center"><Hash className="w-6 h-6 text-white/15" /></div>
            <p className="text-[13px] text-white/20">대화를 시작해보세요!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map(msg => {
              const isMe = msg.sender_id === user?.id;
              const sender = memberProfiles[msg.sender_id];

              if (msg.message_type && msg.message_type !== 'user') {
                return <div key={msg.tempId || msg.id} className="w-full">{renderMessageContent(msg, false)}</div>;
              }

              return (
                <motion.div
                  key={msg.tempId || msg.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  ref={el => { messageRefs.current[msg.id] = el as HTMLDivElement | null; }}
                  className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <div className="w-[30px] h-[30px] rounded-[10px] bg-[#2e2e2e] overflow-hidden border border-white/[0.06] shrink-0 mb-[18px]">
                      {sender?.avatar_url ? <img src={sender.avatar_url} className="w-full h-full object-cover" alt="" />
                        : <UserIcon className="w-3.5 h-3.5 m-auto mt-[8px] text-white/22" />}
                    </div>
                  )}
                  <div className={`max-w-[73%] flex flex-col gap-[3px] ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && isGroupChat && (
                      <span className="text-[11.5px] text-white/32 ml-1 font-medium">
                        {sender?.name || '알 수 없는 사용자'}
                        {members?.find(m => m.user_id === msg.sender_id)?.left_at && (
                          <span className="text-[10px] text-white/20 ml-1">(나감)</span>
                        )}
                      </span>
                    )}
                    <div className="relative">
                      {renderMessageContent(msg, isMe)}
                      {msg.isFailed && isMe && (
                        <button onClick={() => { setFailedMessage(msg); setShowRetryModal(true); }}
                          className="absolute -left-7 top-1/2 -translate-y-1/2">
                          <AlertCircle className="w-5 h-5 text-[#FF203A]" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[#636366] tabular-nums">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.isRetrying && <RefreshCw className="w-3 h-3 text-[#636366] animate-spin" />}
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

      {/* 입력창 */}
      <div className="px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] bg-[#212121]/95 backdrop-blur-xl border-t border-white/[0.05] flex items-end gap-2 shrink-0 z-30">
        <button onClick={() => setIsMenuOpen(true)}
          className="w-[38px] h-[38px] flex items-center justify-center rounded-[12px] bg-[#2a2a2a] border border-white/[0.07] text-white/45 hover:text-white/75 hover:bg-[#303030] transition-colors shrink-0 mb-0.5">
          <Plus className="w-[17px] h-[17px]" />
        </button>
        <div className="flex-1 bg-[#2a2a2a] rounded-[18px] border border-white/[0.07] flex items-end px-[14px] py-[9px] min-h-[40px] focus-within:border-white/[0.12] transition-colors">
          <textarea ref={inputRef} value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            placeholder="메시지 입력..."
            className="flex-1 bg-transparent text-[14.5px] text-white/90 focus:outline-none resize-none max-h-28 placeholder-white/20 leading-[1.45]"
            rows={1} />
        </div>
        <button onClick={handleSendMessage} disabled={!inputText.trim()}
          className={`w-[38px] h-[38px] flex items-center justify-center rounded-[12px] transition-all shrink-0 mb-0.5 ${inputText.trim() ? 'bg-[#FF203A] text-white shadow-lg shadow-[#FF203A]/25' : 'bg-[#2a2a2a] text-white/20 border border-white/[0.07]'}`}>
          <Send className="w-[15px] h-[15px]" />
        </button>
      </div>

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" ref={docInputRef} onChange={handleFileUpload} className="hidden" />

      {/* 첨부 메뉴 */}
      <BottomSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} maxH="max-h-[36vh]">
        <div className="px-5 pt-2 pb-8">
          <p className="text-[10.5px] font-semibold text-white/25 uppercase tracking-widest mb-5">첨부하기</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { ref: fileInputRef, Icon: ImageIcon, label: '앨범', gradient: 'from-blue-500/18 to-blue-600/10', iconColor: 'text-blue-400' },
              { ref: cameraInputRef, Icon: Camera, label: '카메라', gradient: 'from-green-500/18 to-green-600/10', iconColor: 'text-green-400' },
              { ref: docInputRef, Icon: FileText, label: '파일', gradient: 'from-purple-500/18 to-purple-600/10', iconColor: 'text-purple-400' },
            ].map(({ ref, Icon, label, gradient, iconColor }) => (
              <button key={label} onClick={() => { ref.current?.click(); setIsMenuOpen(false); }}
                className="flex flex-col items-center gap-2.5 active:scale-95 transition-transform">
                <div className={`w-[56px] h-[56px] rounded-[18px] bg-gradient-to-br ${gradient} border border-white/[0.07] flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <span className="text-[11.5px] text-white/40">{label}</span>
              </button>
            ))}
            <button onClick={() => { setShowEmojiModal(true); setIsMenuOpen(false); }}
              className="flex flex-col items-center gap-2.5 active:scale-95 transition-transform">
              <div className="w-[56px] h-[56px] rounded-[18px] bg-gradient-to-br from-yellow-500/18 to-orange-500/10 border border-white/[0.07] flex items-center justify-center">
                <Smile className="w-6 h-6 text-yellow-400" />
              </div>
              <span className="text-[11.5px] text-white/40">이모티콘</span>
            </button>

            {/* ✅ [수정 6] 타임캡슐 버튼 추가 (1:1 채팅 전용) */}
            {!isGroupChat && (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate(`/time-capsule/create${friendId ? `?to=${friendId}` : ''}`);
                }}
                className="flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
              >
                <div className="w-[56px] h-[56px] rounded-[18px] bg-gradient-to-br from-orange-500/18 to-red-500/10 border border-white/[0.07] flex items-center justify-center relative">
                  <Hourglass className="w-6 h-6 text-orange-400" />
                  {timeCapsules.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-[#1c1c1c] flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white">{timeCapsules.length}</span>
                    </div>
                  )}
                </div>
                <span className="text-[11.5px] text-white/40">타임캡슐</span>
              </button>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* 링크 경고 */}
      <BottomSheet isOpen={showLinkWarning} onClose={() => { setShowLinkWarning(false); setPendingLink(null); }} maxH="max-h-[50vh]">
        <div className="px-6 pt-3 pb-2 text-center">
          <div className="w-[56px] h-[56px] rounded-[20px] bg-orange-500/10 flex items-center justify-center mx-auto mb-4"><ShieldAlert className="w-6 h-6 text-orange-400" /></div>
          <h3 className="text-[18px] font-bold text-white mb-2 tracking-tight">안전하지 않은 링크</h3>
          <p className="text-[13.5px] text-white/35 leading-relaxed mb-2">친구가 아니거나 차단된 사용자가<br />보낸 링크입니다.</p>
          <div className="bg-[#FF203A]/5 border border-[#FF203A]/15 rounded-[14px] px-4 py-3 mb-1">
            <p className="text-[12.5px] text-[#FF203A]/90 leading-relaxed">악성 링크일 수 있으며, 이 링크를 열어서 발생하는 피해에 대해 <span className="font-bold">그레인은 책임지지 않습니다.</span></p>
          </div>
          {pendingLink && <div className="mt-3 px-3 py-2 bg-[#2a2a2a] rounded-[12px] border border-white/[0.05]"><p className="text-[11px] text-white/35 truncate">{pendingLink}</p></div>}
        </div>
        <div className="px-4 pb-8 pt-4 flex gap-2.5 shrink-0">
          <button onClick={() => { setShowLinkWarning(false); setPendingLink(null); }} className="flex-1 h-[50px] bg-[#2c2c2c] hover:bg-[#333] text-white/60 font-semibold rounded-2xl text-[15px] transition-colors">취소</button>
          <button onClick={handleConfirmLink} className="flex-1 h-[50px] bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-[15px] transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" />링크 열기</button>
        </div>
      </BottomSheet>

      {/* 재전송 모달 */}
      <BottomSheet isOpen={showRetryModal && !!failedMessage} onClose={() => { setShowRetryModal(false); setFailedMessage(null); }} maxH="max-h-[44vh]">
        <div className="px-6 pt-3 pb-2 text-center">
          <div className="w-[56px] h-[56px] rounded-[20px] bg-[#FF203A]/10 flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-6 h-6 text-[#FF203A]" /></div>
          <h3 className="text-[18px] font-bold text-white mb-2 tracking-tight">전송 실패</h3>
          <p className="text-[13.5px] text-white/35 leading-relaxed">메시지 전송에 실패했습니다.<br />다시 시도하시겠습니까?</p>
        </div>
        <div className="px-4 pb-8 pt-4 flex gap-2.5 shrink-0">
          <button onClick={() => failedMessage && handleDeleteMessage(failedMessage)} className="flex-1 h-[50px] bg-[#2c2c2c] hover:bg-[#333] text-white/60 font-semibold rounded-2xl text-[15px] flex items-center justify-center gap-2 transition-colors"><Trash2 className="w-4 h-4" />삭제</button>
          <button onClick={() => failedMessage && handleRetryMessage(failedMessage)} className="flex-1 h-[50px] bg-[#FF203A] hover:bg-[#e01c34] text-white font-bold rounded-2xl text-[15px] flex items-center justify-center gap-2 transition-colors"><RefreshCw className="w-4 h-4" />재전송</button>
        </div>
      </BottomSheet>

      {/* 이모티콘 모달 */}
      <BottomSheet isOpen={showEmojiModal} onClose={() => setShowEmojiModal(false)} maxH="max-h-[52vh]">
        <div className="px-6 pt-3 pb-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-52 h-52 bg-[#FF203A]/8 blur-[60px] rounded-full pointer-events-none" />
          <div className="relative flex justify-center mb-5">
            <div className="w-[68px] h-[68px] rounded-[22px] bg-[#2a2a2a] border border-white/[0.07] flex items-center justify-center"><Rocket className="w-8 h-8 text-[#FF203A]" /></div>
            <motion.div className="absolute -top-2 -right-1"
              animate={{ y: [0, -7, 0], rotate: [0, 18, -8], scale: [1, 1.15, 1] }}
              transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}>
              <Sparkles className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.55)]" />
            </motion.div>
          </div>
          <h3 className="text-[20px] font-bold text-white mb-2 tracking-tight relative">곧 만나요!</h3>
          <p className="text-[13.5px] text-white/35 leading-relaxed mb-7 relative">더 풍부한 감정 표현을 위해<br /><span className="text-[#FF203A] font-semibold">이모티콘 기능</span>을 준비하고 있습니다.</p>
          <button onClick={() => setShowEmojiModal(false)} className="w-full h-[50px] bg-[#2a2a2a] border border-white/[0.07] rounded-2xl text-white/60 font-semibold text-[15px] hover:bg-[#303030] transition-colors relative">확인</button>
        </div>
      </BottomSheet>

      <ImageViewerModal isOpen={isViewerOpen} initialIndex={initialImageIndex} images={allImages} onClose={() => setIsViewerOpen(false)} />
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
    if (n >= 0 && n < images.length) { setDirection(d); setIndex(n); }
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -50 && index < images.length - 1) paginate(1);
    else if (info.offset.x > 50 && index > 0) paginate(-1);
  };

  const handleDownload = async () => {
    const current = images[index];
    const t = toast.loading('저장 중...');
    try {
      const response = await fetch(current);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `grayn_image_${Date.now()}.jpg`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('사진이 저장되었습니다.', { id: t });
    } catch { toast.error('저장에 실패했습니다.', { id: t }); }
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-black/98 backdrop-blur-2xl">
      <div className="absolute top-0 left-0 w-full px-4 py-4 flex items-center justify-between z-20">
        <span className="text-white/45 text-[12px] font-mono bg-white/[0.07] px-3 py-1 rounded-full tabular-nums">{index + 1} / {images.length}</span>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/[0.08] rounded-full text-white/55 hover:bg-white/[0.14] transition-colors"><X className="w-5 h-5" /></button>
      </div>
      {index > 0 && <button onClick={() => paginate(-1)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.14] rounded-full text-white/45 hover:text-white z-20 hidden md:flex transition-all"><ChevronLeft className="w-6 h-6" /></button>}
      {index < images.length - 1 && <button onClick={() => paginate(1)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.14] rounded-full text-white/45 hover:text-white z-20 hidden md:flex transition-all"><ChevronRight className="w-6 h-6" /></button>}
      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img key={index} src={images[index]} custom={direction}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? 500 : -500, opacity: 0, scale: 0.92 }),
              center: { x: 0, opacity: 1, scale: 1 },
              exit: (d: number) => ({ x: d < 0 ? 500 : -500, opacity: 0, scale: 0.92 }),
            }}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7} onDragEnd={handleDragEnd}
            className="absolute max-w-full max-h-full object-contain touch-none cursor-grab active:cursor-grabbing" alt="" />
        </AnimatePresence>
      </div>
      <div className="absolute bottom-0 left-0 w-full flex justify-center pb-10 z-20">
        <button onClick={handleDownload} className="flex items-center gap-2.5 px-6 py-3 bg-white/[0.08] backdrop-blur-xl border border-white/12 rounded-full text-white/75 hover:text-white hover:bg-white/14 transition-all group">
          <Download className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
          <span className="text-[13.5px] font-semibold">저장하기</span>
        </button>
      </div>
    </div>
  );
}