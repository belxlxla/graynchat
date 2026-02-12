import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Bell, Users, FileText, Link as LinkIcon,
  LogOut, ChevronRight, Download, ExternalLink,
  X, AlertTriangle, Search, CheckCircle2, Circle, ArrowLeft,
  Play, ImageIcon, UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

// ─── 타입 ────────────────────────────────────────────────────
interface MediaItem {
  id: number;
  url: string;
  type: 'image' | 'video';
  created_at: string;
}

interface FileItem {
  id: number;
  name: string;
  url: string;
  ext: string;
  created_at: string;
}

interface LinkItem {
  id: number;
  url: string;
  created_at: string;
}

interface Friend {
  id: number;
  friend_user_id: string;
  name: string;
  avatar: string | null;
  status: string | null;
}

type ViewState = 'main' | 'media' | 'files' | 'links';

// ─── 유틸 ────────────────────────────────────────────────────
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

const classifyContent = (url: string) => {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();
  const trimmed = url.trim();
  
  // 링크 체크 우선 (https://, http://, www. 로 시작)
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) return 'link';
  
  const ext = lowerUrl.split('.').pop() || '';
  const isStorage = lowerUrl.includes('supabase.co/storage') || lowerUrl.includes('chat-uploads');
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].some(e => ext.includes(e))) return 'image';
  if (['mp4', 'mov', 'webm', 'avi', 'm4v'].some(e => ext.includes(e))) return 'video';
  if (isStorage) return 'file';
  return null;
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
export default function ChatRoomSettingsPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();

  const [currentView, setCurrentView]     = useState<ViewState>('main');
  const [isNotificationsOn, setIsNotificationsOn] = useState(true);
  const [roomInfo, setRoomInfo]           = useState<{ title: string; count: number; avatar: string | null; status: string | null }>({
    title: '로딩 중...', count: 0, avatar: null, status: null
  });
  const [mediaList, setMediaList]         = useState<MediaItem[]>([]);
  const [fileList, setFileList]           = useState<FileItem[]>([]);
  const [linkList, setLinkList]           = useState<LinkItem[]>([]);
  const [friendsList, setFriendsList]     = useState<Friend[]>([]);
  const [isLeaveModalOpen, setIsLeaveModalOpen]   = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [viewerOpen, setViewerOpen]       = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  useEffect(() => {
    if (!chatId) return;
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const myId = session?.user.id;
        if (!myId) return;

        const { data: room } = await supabase.from('chat_rooms')
          .select('id, type, title, avatar, members_count').eq('id', chatId).maybeSingle();

        let title = '알 수 없는 대화방';
        let avatar: string | null = null;
        let memberCount = 0;

        if (room) { title = room.title || title; avatar = room.avatar; memberCount = room.members_count || 0; }

        const { count: realCount } = await supabase.from('room_members')
          .select('*', { count: 'exact', head: true }).eq('room_id', chatId);
        memberCount = realCount || memberCount;

        if (chatId.includes('_') && !chatId.startsWith('group_')) {
          const friendId = chatId.split('_').find(id => id !== myId);
          if (friendId) {
            const { data: up } = await supabase.from('users')
              .select('name, avatar, status_message').eq('id', friendId).maybeSingle();
            if (up) { title = up.name; avatar = up.avatar; }
          }
        }

        setRoomInfo({ title, count: memberCount, avatar, status: null });

        const { data: messages } = await supabase.from('messages').select('id, content, created_at')
          .eq('room_id', chatId).order('created_at', { ascending: false }).limit(300);

        if (messages) {
          const medias: MediaItem[] = [];
          const files: FileItem[]   = [];
          const links: LinkItem[]   = [];
          messages.forEach(msg => {
            const type = classifyContent(msg.content);
            if (type === 'image' || type === 'video') {
              medias.push({ id: msg.id, url: msg.content, type, created_at: msg.created_at });
            } else if (type === 'file') {
              files.push({ id: msg.id, url: msg.content, name: getFileName(msg.content), ext: msg.content.split('.').pop()?.toUpperCase() || 'FILE', created_at: msg.created_at });
            } else if (type === 'link') {
              links.push({ id: msg.id, url: msg.content, created_at: msg.created_at });
            }
          });
          setMediaList(medias); setFileList(files); setLinkList(links);
        }

        const { data: friends } = await supabase.from('friends').select('*').eq('user_id', myId);
        if (friends) setFriendsList(friends);
      } catch (error) {
        console.error('Settings Load Error:', error);
        toast.error('채팅방 정보를 불러오지 못했습니다.');
      }
    };
    fetchData();
  }, [chatId]);

  const handleToggleNotifications = () => {
    const n = !isNotificationsOn;
    setIsNotificationsOn(n);
    toast.success(n ? '알림이 켜졌습니다.' : '알림이 꺼졌습니다.', { icon: n ? '🔔' : '🔕' });
  };

  // ✅ 수정된 채팅방 나가기 (대화내용 삭제 + AI 점수 초기화 + 나가기)
  const handleConfirmLeave = async () => {
    try {
      if (!chatId) return;
      const { data: { session } } = await supabase.auth.getSession();
      const myId = session?.user.id;
      if (!myId) return;

      // 1. [AI 점수 초기화] 1:1 채팅방인 경우
      const isGroup = chatId.startsWith('group_');
      if (!isGroup) {
        const friendId = chatId.split('_').find(id => id !== myId);
        if (friendId) {
           await supabase.from('friends')
             .update({ friendly_score: 1 })
             .match({ user_id: myId, friend_user_id: friendId });
        }
      }

      // 2. [대화 내용 삭제] 해당 채팅방의 모든 메시지 삭제
      await supabase.from('messages').delete().eq('room_id', chatId);

      // 3. [멤버 삭제] 방 나가기 처리
      const { error } = await supabase.from('room_members').delete()
        .eq('room_id', chatId).eq('user_id', myId);

      if (error) throw error;

      // 4. [방 청소] 멤버가 0명이면 방 자체 삭제
      const { count } = await supabase.from('room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', chatId);

      if (count === 0) {
        await supabase.from('chat_rooms').delete().eq('id', chatId);
      } else {
        await supabase.from('chat_rooms').update({ members_count: count }).eq('id', chatId);
      }

      toast.success('채팅방을 나갔습니다. (초기화 완료)');
      setIsLeaveModalOpen(false);
      navigate('/main/chats');

    } catch (err) {
      console.error('나가기 실패:', err);
      toast.error('나가기에 실패했습니다.');
    }
  };

  const handleInvite = async (selectedFriendIds: number[]) => {
    if (!chatId || selectedFriendIds.length === 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const myId = session?.user.id;
      if (!myId) return;

      const { data: currentMembers } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', chatId);

      const currentMemberIds = currentMembers?.map(m => m.user_id) || [];

      const selectedUserIds = selectedFriendIds
        .map(fid => friendsList.find(fr => fr.id === fid)?.friend_user_id)
        .filter(Boolean) as string[];

      if (selectedUserIds.length === 0) {
        toast.error('선택한 친구를 찾을 수 없습니다.');
        return;
      }

      const alreadyMembers = selectedUserIds.filter(uid => currentMemberIds.includes(uid));
      const newMembers = selectedUserIds.filter(uid => !currentMemberIds.includes(uid));

      if (alreadyMembers.length > 0) {
        const alreadyMemberNames = alreadyMembers
          .map(uid => friendsList.find(f => f.friend_user_id === uid)?.name)
          .filter(Boolean);
        toast.error(`${alreadyMemberNames.join(', ')}님은 이미 채팅방에 있습니다.`);
      }

      if (newMembers.length === 0) {
        return;
      }

      const isGroupChat = chatId.startsWith('group_');

      if (!isGroupChat) {
        const allMembers = [...currentMemberIds, ...newMembers];
        const groupId = `group_${Date.now()}`;

        const { data: userProfiles } = await supabase
          .from('users')
          .select('id, name')
          .in('id', allMembers);

        const memberNames = userProfiles?.map(u => u.name).filter(Boolean) || [];
        const groupTitle = memberNames.length > 0
          ? `${memberNames.slice(0, 3).join(', ')}${memberNames.length > 3 ? ` 외 ${memberNames.length - 3}명` : ''}`
          : `그룹 채팅 (${allMembers.length}명)`;

        const { error: roomError } = await supabase
          .from('chat_rooms')
          .insert({
            id: groupId,
            type: 'group',
            title: groupTitle,
            created_by: myId,
            members_count: allMembers.length,
          });

        if (roomError) throw roomError;

        const memberInserts = allMembers.map(uid => ({
          room_id: groupId,
          user_id: uid,
        }));

        const { error: membersError } = await supabase
          .from('room_members')
          .insert(memberInserts);

        if (membersError) throw membersError;

        toast.success('새 그룹 채팅방이 생성되었습니다.');
        setIsInviteModalOpen(false);
        navigate(`/chat/room/${groupId}`);
        return;
      }

      const memberInserts = newMembers.map(uid => ({
        room_id: chatId,
        user_id: uid,
      }));

      const { error: insertError } = await supabase
        .from('room_members')
        .insert(memberInserts);

      if (insertError) throw insertError;

      const newMemberCount = currentMemberIds.length + newMembers.length;
      const { error: updateError } = await supabase
        .from('chat_rooms')
        .update({ members_count: newMemberCount })
        .eq('id', chatId);

      if (updateError) console.warn('멤버 수 업데이트 실패:', updateError);

      toast.success(`${newMembers.length}명을 초대했습니다.`);
      setIsInviteModalOpen(false);
      window.location.reload();

    } catch (err) {
      console.error('초대 실패:', err);
      toast.error('초대에 실패했습니다.');
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    const t = toast.loading('다운로드 중...');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const bu = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = bu; a.download = filename;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(bu); document.body.removeChild(a);
      toast.success('저장 완료', { id: t });
    } catch { toast.error('다운로드 실패', { id: t }); }
  };

  const openImageViewer = (index: number) => { setInitialImageIndex(index); setViewerOpen(true); };

  const handleLinkClick = (url: string) => {
    const normalizedUrl = normalizeUrl(url);
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  };

  // ── 서브뷰: 미디어 ────────────────────────────────────────
  if (currentView === 'media') {
    return (
      <SubPageView title="사진/동영상" count={mediaList.length} onBack={() => setCurrentView('main')}>
        {mediaList.length === 0 ? (
          <EmptyState icon={<ImageIcon className="w-8 h-8" />} message="주고받은 사진/동영상이 없습니다." />
        ) : (
          <div className="grid grid-cols-3 gap-0.5 px-0">
            {mediaList.map((media, i) => (
              <motion.button
                key={media.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openImageViewer(i)}
                className="aspect-square bg-[#2a2a2a] relative overflow-hidden group"
              >
                {media.type === 'video' ? (
                  <>
                    <video src={media.url} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img src={media.url} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors" />
              </motion.button>
            ))}
          </div>
        )}
        <ImageViewerModal
          isOpen={viewerOpen} initialIndex={initialImageIndex}
          items={mediaList} onClose={() => setViewerOpen(false)}
        />
      </SubPageView>
    );
  }

  // ── 서브뷰: 파일 ──────────────────────────────────────────
  if (currentView === 'files') {
    return (
      <SubPageView title="파일" count={fileList.length} onBack={() => setCurrentView('main')}>
        {fileList.length === 0 ? (
          <EmptyState icon={<FileText className="w-8 h-8" />} message="주고받은 파일이 없습니다." />
        ) : (
          <div className="px-4 py-3 space-y-2.5">
            {fileList.map((file, i) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3.5 p-3.5 bg-[#242424] rounded-[18px] border border-white/[0.06]"
              >
                <div className="w-11 h-11 rounded-[13px] bg-[#FF203A]/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-[#FF203A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-white/88 truncate font-medium">{file.name}</p>
                  <p className="text-[11px] text-white/28 mt-0.5 tabular-nums">
                    {new Date(file.created_at).toLocaleDateString()} · {file.ext}
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(file.url, file.name)}
                  className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-white/[0.05] text-white/40 hover:text-white/70 hover:bg-white/[0.09] transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </SubPageView>
    );
  }

  // ── 서브뷰: 링크 ──────────────────────────────────────────
  if (currentView === 'links') {
    return (
      <SubPageView title="링크" count={linkList.length} onBack={() => setCurrentView('main')}>
        {linkList.length === 0 ? (
          <EmptyState icon={<LinkIcon className="w-8 h-8" />} message="공유된 링크가 없습니다." />
        ) : (
          <div className="px-4 py-3 space-y-2.5">
            {linkList.map((link, i) => (
              <motion.button
                key={link.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => handleLinkClick(link.url)}
                className="w-full flex items-center gap-3.5 p-3.5 bg-[#242424] rounded-[18px] border border-white/[0.06] text-left group hover:border-white/10 transition-colors"
              >
                <div className="w-11 h-11 rounded-[13px] bg-blue-500/10 flex items-center justify-center shrink-0">
                  <LinkIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-white/88 truncate font-medium">{link.url}</p>
                  <p className="text-[11px] text-white/28 mt-0.5 tabular-nums">
                    {new Date(link.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-white/45 transition-colors shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </SubPageView>
    );
  }

  // ── 메인 뷰 ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[100dvh] bg-[#212121] text-white overflow-hidden">

      {/* 헤더 */}
      <header className="h-[54px] px-3 flex items-center bg-[#212121]/90 backdrop-blur-xl border-b border-white/[0.05] shrink-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/65 hover:bg-white/[0.07] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[16px] font-semibold text-white/90 ml-1 tracking-tight">채팅방 설정</h1>
      </header>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">

        {/* ── 프로필 섹션 ─ */}
        <div className="flex flex-col items-center pt-7 pb-6 px-6 border-b border-white/[0.05]">
          <div className="w-[84px] h-[84px] rounded-[26px] bg-[#2a2a2a] border border-white/[0.07] mb-4 flex items-center justify-center overflow-hidden shadow-xl">
            {roomInfo.avatar
              ? <img src={roomInfo.avatar} className="w-full h-full object-cover" alt="" />
              : <Users className="w-9 h-9 text-white/20" />
            }
          </div>
          <h2 className="text-[19px] font-bold tracking-tight text-white mb-1">{roomInfo.title}</h2>
          <p className="text-[13px] text-white/35">
            {roomInfo.status || `멤버 ${roomInfo.count}명`}
          </p>
        </div>

        {/* ── 모아보기 ─ */}
        <div className="px-4 pt-6">
          <SectionLabel>모아보기</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5 mt-3">
            {[
              {
                icon: <ImageIcon className="w-6 h-6" />,
                label: '사진/동영상',
                count: mediaList.length,
                color: 'from-purple-500/18 to-pink-500/10',
                iconColor: 'text-purple-400',
                view: 'media' as ViewState,
              },
              {
                icon: <FileText className="w-6 h-6" />,
                label: '파일',
                count: fileList.length,
                color: 'from-[#FF203A]/15 to-orange-500/8',
                iconColor: 'text-[#FF203A]',
                view: 'files' as ViewState,
              },
              {
                icon: <LinkIcon className="w-6 h-6" />,
                label: '링크',
                count: linkList.length,
                color: 'from-blue-500/18 to-cyan-500/10',
                iconColor: 'text-blue-400',
                view: 'links' as ViewState,
              },
            ].map(({ icon, label, count, color, iconColor, view }) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`flex flex-col items-center gap-2.5 py-4 rounded-[18px] bg-gradient-to-br ${color} border border-white/[0.06] hover:border-white/10 active:scale-95 transition-all`}
              >
                <div className={iconColor}>{icon}</div>
                <div className="text-center">
                  <p className="text-[11.5px] text-white/55">{label}</p>
                  <p className="text-[17px] font-bold text-white/85 tabular-nums leading-tight">{count}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── 채팅 관리 ─ */}
        <div className="px-4 pt-6">
          <SectionLabel>채팅 관리</SectionLabel>
          <div className="mt-3 bg-[#242424] rounded-[20px] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.05]">

            {/* 배경화면 */}
            <button
              onClick={() => navigate(`/settings/display/wallpaper?chatId=${chatId}`)}
              className="w-full flex items-center gap-3.5 px-4 py-4 hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-9 h-9 rounded-[11px] bg-white/[0.05] flex items-center justify-center shrink-0">
                <ImageIcon className="w-[18px] h-[18px] text-white/45" />
              </div>
              <span className="flex-1 text-[14.5px] text-white/85 text-left">배경화면 설정</span>
              <ChevronRight className="w-4 h-4 text-white/20" />
            </button>

            {/* 알림 설정 */}
            <div className="flex items-center gap-3.5 px-4 py-4">
              <div className="w-9 h-9 rounded-[11px] bg-white/[0.05] flex items-center justify-center shrink-0">
                <Bell className="w-[18px] h-[18px] text-white/45" />
              </div>
              <span className="flex-1 text-[14.5px] text-white/85">알림 설정</span>
              <button
                onClick={handleToggleNotifications}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                  isNotificationsOn ? 'bg-[#FF203A]' : 'bg-white/12'
                }`}
              >
                <motion.div
                  className="absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-md"
                  animate={{ x: isNotificationsOn ? 20 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* 대화상대 초대 */}
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full flex items-center gap-3.5 px-4 py-4 hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-9 h-9 rounded-[11px] bg-white/[0.05] flex items-center justify-center shrink-0">
                <Users className="w-[18px] h-[18px] text-white/45" />
              </div>
              <span className="flex-1 text-[14.5px] text-white/85 text-left">대화상대 초대</span>
              <ChevronRight className="w-4 h-4 text-white/20" />
            </button>
          </div>
        </div>

        {/* ── 나가기 버튼 ─ */}
        <div className="px-4 pt-5">
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="w-full py-4 rounded-[18px] bg-[#FF203A]/8 border border-[#FF203A]/20 text-[#FF203A] font-semibold text-[15px] flex items-center justify-center gap-2.5 hover:bg-[#FF203A]/12 transition-colors active:scale-[0.98]"
          >
            <LogOut className="w-[18px] h-[18px]" />
            채팅방 나가기
          </button>
        </div>
      </div>

      {/* ── 나가기 바텀시트 ─ */}
      <BottomSheet isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} maxH="max-h-[44vh]">
        <div className="px-6 pt-4 pb-3 text-center">
          <div className="w-14 h-14 rounded-[20px] bg-[#FF203A]/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#FF203A]" />
          </div>
          <h3 className="text-[18px] font-bold text-white mb-1.5 tracking-tight">채팅방 나가기</h3>
          <p className="text-[13.5px] text-white/38 leading-relaxed">
            대화 내용이 삭제되며<br />AI 지수도 1점으로 초기화 됩니다.
          </p>
        </div>
        <div className="px-4 pb-8 pt-2 flex gap-2.5 shrink-0">
          <button
            onClick={() => setIsLeaveModalOpen(false)}
            className="flex-1 h-[50px] bg-[#2c2c2c] text-white/65 font-semibold rounded-2xl text-[15px] hover:bg-[#333] transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirmLeave}
            className="flex-1 h-[50px] bg-[#FF203A] text-white font-bold rounded-2xl text-[15px] hover:bg-[#e0001c] transition-colors"
          >
            나가기
          </button>
        </div>
      </BottomSheet>

      {/* ── 초대 바텀시트 ─ */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        friends={friendsList}
        onInvite={handleInvite}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Helper Components
// ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-white/28 uppercase tracking-widest px-1">
      {children}
    </p>
  );
}

function SubPageView({ title, count, onBack, children }: {
  title: string; count?: number; onBack: () => void; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col h-[100dvh] bg-[#212121] text-white overflow-hidden absolute inset-0 z-50"
    >
      <header className="h-[54px] px-3 flex items-center bg-[#212121]/90 backdrop-blur-xl border-b border-white/[0.05] shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/65 hover:bg-white/[0.07] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="ml-2 flex items-center gap-2">
          <h1 className="text-[16px] font-semibold text-white/90 tracking-tight">{title}</h1>
          {count !== undefined && count > 0 && (
            <span className="text-[12px] font-semibold text-white/30 bg-white/[0.07] px-2 py-0.5 rounded-full tabular-nums">
              {count}
            </span>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar">{children}</div>
    </motion.div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[55vh] gap-3">
      <div className="w-14 h-14 rounded-[18px] bg-white/[0.04] flex items-center justify-center text-white/18">
        {icon}
      </div>
      <p className="text-[13.5px] text-white/25">{message}</p>
    </div>
  );
}

// ── 초대 바텀시트 ────────────────────────────────────────────
function InviteMemberModal({ isOpen, onClose, friends, onInvite }: {
  isOpen: boolean; onClose: () => void; friends: Friend[]; onInvite: (ids: number[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch]           = useState('');

  useEffect(() => { if (isOpen) { setSelectedIds([]); setSearch(''); } }, [isOpen]);

  const toggle = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleInviteClick = () => {
    if (selectedIds.length === 0) return;
    onInvite(selectedIds);
    setSelectedIds([]);
  };

  const filtered = friends.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

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
            className="relative z-10 bg-[#1c1c1c] rounded-t-[28px] max-h-[88vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-[3px] bg-white/12 rounded-full" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pb-4 pt-1 shrink-0">
              <h3 className="text-[18px] font-bold text-white tracking-tight">대화상대 초대</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/45 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 검색 */}
            <div className="px-4 pb-3 shrink-0">
              <div className="bg-[#2a2a2a] rounded-[14px] flex items-center gap-2 px-3.5 h-[42px] border border-white/[0.05]">
                <Search className="w-4 h-4 text-white/28 shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="이름으로 검색"
                  className="bg-transparent text-white/90 placeholder-white/22 text-[14px] w-full focus:outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')}>
                    <X className="w-4 h-4 text-white/28" />
                  </button>
                )}
              </div>
            </div>

            {/* 선택 인원 표시 */}
            {selectedIds.length > 0 && (
              <div className="px-4 pb-2 shrink-0">
                <div className="flex items-center gap-2 text-[12px]">
                  <div className="w-4 h-4 bg-[#FF203A] rounded-full flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{selectedIds.length}</span>
                  </div>
                  <span className="text-white/38">{selectedIds.length}명 선택됨</span>
                </div>
              </div>
            )}

            {/* 목록 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 min-h-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/22 gap-2">
                  <Users className="w-8 h-8" />
                  <p className="text-[13px]">초대할 수 있는 친구가 없습니다.</p>
                </div>
              ) : (
                filtered.map(f => {
                  const selected = selectedIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggle(f.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-[16px] transition-colors text-left ${
                        selected ? 'bg-[#FF203A]/10' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="w-[42px] h-[42px] rounded-[14px] bg-[#2e2e2e] border border-white/[0.06] overflow-hidden shrink-0">
                        {f.avatar
                          ? <img src={f.avatar} className="w-full h-full object-cover" alt="" />
                          : <UserPlus className="w-4 h-4 m-auto mt-[11px] text-white/22" />
                        }
                      </div>
                      <span className={`flex-1 text-[14.5px] font-medium ${selected ? 'text-[#FF203A]' : 'text-white/85'}`}>
                        {f.name}
                      </span>
                      {selected
                        ? <CheckCircle2 className="w-[22px] h-[22px] text-[#FF203A] shrink-0" />
                        : <Circle className="w-[22px] h-[22px] text-white/14 shrink-0" />
                      }
                    </button>
                  );
                })
              )}
            </div>

            {/* 초대 버튼 */}
            <div className="px-4 pt-3 pb-8 shrink-0">
              <button
                onClick={handleInviteClick}
                disabled={selectedIds.length === 0}
                className="w-full h-[52px] rounded-2xl bg-[#FF203A] text-white font-bold text-[15.5px] disabled:opacity-25 transition-opacity"
              >
                {selectedIds.length > 0 ? `${selectedIds.length}명 초대하기` : '초대하기'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── 이미지/비디오 뷰어 ───────────────────────────────────────
function ImageViewerModal({ isOpen, initialIndex, items, onClose }: {
  isOpen: boolean; initialIndex: number; items: MediaItem[]; onClose: () => void;
}) {
  const [index, setIndex]         = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => { if (isOpen) setIndex(initialIndex); }, [isOpen, initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowLeft') paginate(-1);
      else if (e.key === 'ArrowRight') paginate(1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, index]);

  if (!isOpen || items.length === 0) return null;

  const paginate = (d: number) => {
    const n = index + d;
    if (n >= 0 && n < items.length) { setDirection(d); setIndex(n); }
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -50 && index < items.length - 1) paginate(1);
    else if (info.offset.x > 50 && index > 0) paginate(-1);
  };

  const handleDownload = async () => {
    const current = items[index];
    const t = toast.loading('다운로드 중...');
    try {
      const response = await fetch(current.url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `media_${Date.now()}.${current.type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('저장되었습니다.', { id: t });
    } catch { toast.error('다운로드 실패', { id: t }); }
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 500 : -500, opacity: 0, scale: 0.92 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d < 0 ? 500 : -500, opacity: 0, scale: 0.92 }),
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-black/98 backdrop-blur-2xl">
      {/* 상단 바 */}
      <div className="absolute top-0 left-0 w-full px-4 py-4 flex items-center justify-between z-20">
        <span className="text-white/50 text-[12px] font-mono bg-white/[0.07] px-3 py-1 rounded-full tabular-nums">
          {index + 1} / {items.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-white/[0.08] rounded-full text-white/65 hover:bg-white/14 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 이전/다음 (데스크탑) */}
      {index > 0 && (
        <button onClick={() => paginate(-1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/[0.07] hover:bg-white/14 rounded-full text-white/55 hover:text-white z-20 hidden md:flex transition-all">
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {index < items.length - 1 && (
        <button onClick={() => paginate(1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/[0.07] hover:bg-white/14 rounded-full text-white/55 hover:text-white z-20 hidden md:flex transition-all">
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* 콘텐츠 */}
      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={index} custom={direction}
            variants={variants} initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7}
            onDragEnd={handleDragEnd}
            className="absolute w-full h-full flex items-center justify-center"
          >
            {items[index].type === 'video' ? (
              <video src={items[index].url} controls autoPlay className="max-w-full max-h-full" />
            ) : (
              <img src={items[index].url} className="max-w-full max-h-full object-contain touch-none cursor-grab active:cursor-grabbing" alt="" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 다운로드 */}
      <div className="absolute bottom-0 left-0 w-full flex justify-center pb-10 z-20">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2.5 px-6 py-3 bg-white/[0.08] backdrop-blur-xl border border-white/12 rounded-full text-white/75 hover:text-white hover:bg-white/14 transition-all group"
        >
          <Download className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
          <span className="text-[13.5px] font-semibold">저장하기</span>
        </button>
      </div>
    </div>
  );
}