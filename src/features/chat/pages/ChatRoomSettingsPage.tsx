import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Bell, Users, Image, FileText, Link as LinkIcon, 
  LogOut, ChevronRight, Download, ExternalLink,
  X, AlertTriangle, Search, CheckCircle2, Circle, ArrowLeft,
  Play, ImageIcon, UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

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
  const ext = lowerUrl.split('.').pop() || '';
  const isStorage = lowerUrl.includes('supabase.co/storage') || lowerUrl.includes('chat-uploads');

  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].some(e => ext.includes(e))) return 'image';
  if (['mp4', 'mov', 'webm', 'avi', 'm4v'].some(e => ext.includes(e))) return 'video';
  if (isStorage) return 'file';
  if (lowerUrl.startsWith('http')) return 'link';

  return null;
};

export default function ChatRoomSettingsPage() {
  const navigate = useNavigate();
  const { chatId } = useParams(); 

  const [currentView, setCurrentView] = useState<ViewState>('main');
  const [isNotificationsOn, setIsNotificationsOn] = useState(true);

  const [roomInfo, setRoomInfo] = useState<{ title: string; count: number; avatar: string | null; status: string | null }>({
    title: '로딩 중...', count: 0, avatar: null, status: null
  });
  
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [linkList, setLinkList] = useState<LinkItem[]>([]);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  useEffect(() => {
    if (!chatId) return;

    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const myId = session?.user.id;
        if (!myId) return;

        const { data: room } = await supabase
          .from('chat_rooms')
          .select('id, type, title, avatar, members_count')
          .eq('id', chatId)
          .maybeSingle();

        let title = '알 수 없는 대화방';
        let avatar: string | null = null;
        let memberCount = 0;

        if (room) {
          title = room.title || title;
          avatar = room.avatar;
          memberCount = room.members_count || 0;
        }

        const { count: realCount } = await supabase
          .from('room_members')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', chatId);

        memberCount = realCount || memberCount;

        if (chatId.includes('_') && !chatId.startsWith('group_')) {
          const friendId = chatId.split('_').find(id => id !== myId);
          if (friendId) {
            const { data: userProfile } = await supabase
              .from('users')
              .select('name, avatar, status_message')
              .eq('id', friendId)
              .maybeSingle();

            if (userProfile) {
              title = userProfile.name;
              avatar = userProfile.avatar;
            }
          }
        }

        setRoomInfo({ title, count: memberCount, avatar, status: null });

        const { data: messages } = await supabase
          .from('messages')
          .select('id, content, created_at')
          .eq('room_id', chatId)
          .order('created_at', { ascending: false })
          .limit(300);

        if (messages) {
          const medias: MediaItem[] = [];
          const files: FileItem[] = [];
          const links: LinkItem[] = [];

          messages.forEach(msg => {
            const type = classifyContent(msg.content);
            if (type === 'image' || type === 'video') {
              medias.push({ 
                id: msg.id, 
                url: msg.content, 
                type, 
                created_at: msg.created_at 
              });
            } else if (type === 'file') {
              files.push({ 
                id: msg.id, 
                url: msg.content, 
                name: getFileName(msg.content),
                ext: msg.content.split('.').pop()?.toUpperCase() || 'FILE',
                created_at: msg.created_at 
              });
            } else if (type === 'link') {
              links.push({ 
                id: msg.id, 
                url: msg.content, 
                created_at: msg.created_at 
              });
            }
          });

          setMediaList(medias);
          setFileList(files);
          setLinkList(links);
        }

        const { data: friends } = await supabase
          .from('friends')
          .select('*')
          .eq('user_id', myId);

        if (friends) setFriendsList(friends);

      } catch (error) {
        console.error('Settings Load Error:', error);
        toast.error('채팅방 정보를 불러오지 못했습니다.');
      }
    };

    fetchData();
  }, [chatId]);

  const handleToggleNotifications = () => {
    const newState = !isNotificationsOn;
    setIsNotificationsOn(newState);
    toast.success(newState ? '알림이 켜졌습니다.' : '알림이 꺼졌습니다.', {
      icon: newState ? '🔔' : '🔕'
    });
  };

  const handleConfirmLeave = async () => {
    try {
      if (!chatId) return;

      const { data: { session } } = await supabase.auth.getSession();
      const myId = session?.user.id;
      if (!myId) return;

      const { error } = await supabase
        .from('room_members')
        .delete()
        .eq('room_id', chatId)
        .eq('user_id', myId);

      if (error) throw error;

      toast.success('채팅방을 나갔습니다.');
      setIsLeaveModalOpen(false);
      navigate('/main/chats');

    } catch (error) {
      console.error('나가기 실패:', error);
      toast.error('나가기에 실패했습니다.');
    }
  };

  const handleInvite = async (selectedFriendIds: number[]) => {
    if (!chatId || selectedFriendIds.length === 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const myId = session?.user.id;
      if (!myId) return;

      const inserts = selectedFriendIds.map(friendId => {
        const friend = friendsList.find(f => f.id === friendId);
        return {
          room_id: chatId,
          user_id: friend?.friend_user_id
        };
      }).filter(Boolean);

      if (inserts.length === 0) return;

      const { error } = await supabase
        .from('room_members')
        .insert(inserts);

      if (error) throw error;

      toast.success(`${inserts.length}명을 초대했습니다.`);
      setIsInviteModalOpen(false);

      window.location.reload(); 

    } catch (err) {
      console.error('초대 실패:', err);
      toast.error('초대에 실패했습니다.');
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    const loadingToast = toast.loading('다운로드 중...');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('다운로드 실패');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      
      toast.success('저장 완료', { id: loadingToast });
    } catch {
      toast.error('다운로드 실패', { id: loadingToast });
    }
  };

  const openImageViewer = (index: number) => {
    setInitialImageIndex(index);
    setViewerOpen(true);
  };

  if (currentView === 'media') {
    return (
      <SubPageView title="사진/동영상" onBack={() => setCurrentView('main')}>
        {mediaList.length === 0 ? (
          <EmptyState message="주고받은 사진/동영상이 없습니다." />
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {mediaList.map((media, i) => (
              <motion.button 
                key={media.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openImageViewer(i)}
                className="aspect-square bg-[#2C2C2E] relative group overflow-hidden"
              >
                {media.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    <video src={media.url} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="w-8 h-8 text-white fill-white/50" />
                    </div>
                  </div>
                ) : (
                  <img src={media.url} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </motion.button>
            ))}
          </div>
        )}
        <ImageViewerModal 
          isOpen={viewerOpen}
          initialIndex={initialImageIndex}
          items={mediaList} 
          onClose={() => setViewerOpen(false)}
        />
      </SubPageView>
    );
  }

  if (currentView === 'files') {
    return (
      <SubPageView title="파일" onBack={() => setCurrentView('main')}>
        {fileList.length === 0 ? (
          <EmptyState message="주고받은 파일이 없습니다." />
        ) : (
          <div className="px-5 py-4 space-y-3">
            {fileList.map((file, i) => (
              <motion.div 
                key={file.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors group"
              >
                <div className="w-12 h-12 bg-[#3A3A3C] rounded-xl flex items-center justify-center shrink-0 text-[#8E8E93] group-hover:text-white transition-colors border border-white/5">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-white truncate font-medium">{file.name}</p>
                  <p className="text-xs text-[#8E8E93] mt-1">{new Date(file.created_at).toLocaleDateString()} • {file.ext}</p>
                </div>
                <button 
                  onClick={() => handleDownload(file.url, file.name)}
                  className="p-2.5 text-[#8E8E93] hover:text-white hover:bg-[#48484A] rounded-full transition-colors"
                >
                  <Download className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </SubPageView>
    );
  }

  if (currentView === 'links') {
    return (
      <SubPageView title="링크" onBack={() => setCurrentView('main')}>
        {linkList.length === 0 ? (
          <EmptyState message="공유된 링크가 없습니다." />
        ) : (
          <div className="px-5 py-4 space-y-3">
            {linkList.map((link, i) => (
              <motion.button 
                key={link.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => window.open(link.url, '_blank')}
                className="w-full flex items-center gap-4 p-4 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors text-left group"
              >
                <div className="w-12 h-12 bg-[#3A3A3C] rounded-xl flex items-center justify-center shrink-0 text-brand-DEFAULT">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-white truncate font-medium">{link.url}</p>
                  <p className="text-xs text-[#8E8E93] truncate mt-1 flex items-center gap-1">
                    {new Date(link.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </motion.button>
            ))}
          </div>
        )}
      </SubPageView>
    );
  }

  // 메인 뷰
  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">채팅방 설정</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <div className="p-6 flex flex-col items-center border-b border-[#2C2C2E]">
          <div className="w-24 h-24 bg-[#3A3A3C] rounded-[30px] mb-4 flex items-center justify-center overflow-hidden border border-[#2C2C2E]">
            {roomInfo.avatar ? (
              <img src={roomInfo.avatar} className="w-full h-full object-cover" alt="" />
            ) : (
              <Users className="w-10 h-10 text-[#8E8E93] opacity-50" />
            )}
          </div>
          <h2 className="text-xl font-bold mb-1">{roomInfo.title}</h2>
          <p className="text-[#8E8E93] text-sm mt-1">
            {roomInfo.status || `멤버 ${roomInfo.count}명`}
          </p>
        </div>

        <div className="px-5 mt-6 space-y-6">
          <Section title="모아보기">
            <NavMenuItem 
              icon={<Image className="w-5 h-5" />} 
              label="사진/동영상" 
              count={mediaList.length} 
              onClick={() => setCurrentView('media')} 
            />
            <NavMenuItem 
              icon={<FileText className="w-5 h-5" />} 
              label="파일" 
              count={fileList.length} 
              onClick={() => setCurrentView('files')} 
            />
            <NavMenuItem 
              icon={<LinkIcon className="w-5 h-5" />} 
              label="링크" 
              count={linkList.length} 
              onClick={() => setCurrentView('links')} 
            />
          </Section>

          <Section title="관리">
            <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
              <button 
                onClick={() => navigate(`/settings/display/wallpaper?chatId=${chatId}`)} 
                className="w-full flex items-center justify-between p-4 hover:bg-[#3A3A3C] transition-colors border-b border-[#3A3A3C]"
              >
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">배경화면 설정</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#636366]" />
              </button>

              <div className="flex items-center justify-between p-4 hover:bg-[#3A3A3C] transition-colors border-b border-[#3A3A3C]">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">알림 설정</span>
                </div>
                <button 
                  onClick={handleToggleNotifications}
                  className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${isNotificationsOn ? 'bg-brand-DEFAULT' : 'bg-[#48484A]'}`}
                >
                  <motion.div 
                    className="w-5 h-5 bg-white rounded-full shadow-sm" 
                    animate={{ x: isNotificationsOn ? 20 : 0 }} 
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full flex items-center justify-between p-4 hover:bg-[#3A3A3C] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">대화상대 초대</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#636366]" />
              </button>
            </div>
          </Section>

          <div className="space-y-3 pt-4">
            <button 
              onClick={() => setIsLeaveModalOpen(true)} 
              className="w-full py-4 bg-[#2C2C2E] text-[#FF203A] font-medium rounded-2xl flex items-center justify-center gap-2 hover:bg-[#3A3A3C] transition-colors border border-[#3A3A3C]"
            >
              <LogOut className="w-5 h-5" />채팅방 나가기
            </button>
          </div>
        </div>
      </div>

      <LeaveChatModal 
        isOpen={isLeaveModalOpen} 
        onClose={() => setIsLeaveModalOpen(false)} 
        onConfirm={handleConfirmLeave} 
      />
      <InviteMemberModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        friends={friendsList}
        onInvite={handleInvite}
      />
    </div>
  );
}

// ────────────────────────────────────────────────
// Helper Components
// ────────────────────────────────────────────────

function SubPageView({ title, onBack, children }: { title: string, onBack: () => void, children: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ x: '100%' }} 
      animate={{ x: 0 }} 
      exit={{ x: '100%' }} 
      transition={{ type: 'spring', stiffness: 300, damping: 30 }} 
      className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden absolute inset-0 z-50"
    >
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={onBack} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ArrowLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">{title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar">{children}</div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function NavMenuItem({ icon, label, count, onClick }: { 
  icon: React.ReactNode, 
  label: string, 
  count?: number, 
  onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick} 
      className="w-full flex items-center justify-between px-5 py-4 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C] hover:bg-[#3A3A3C] transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93] group-hover:text-white transition-colors">{icon}</div>
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {count !== undefined && <span className="text-[13px] text-[#8E8E93]">{count}</span>}
        <ChevronRight className="w-4 h-4 text-[#636366]" />
      </div>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-[#8E8E93] opacity-60">
      <AlertTriangle className="w-10 h-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function LeaveChatModal({ isOpen, onClose, onConfirm }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void 
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center"
      >
        <div className="p-6">
          <div className="w-12 h-12 bg-[#FF203A]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#FF203A]" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">채팅방 나가기</h3>
          <p className="text-[#8E8E93] text-sm leading-relaxed">
            대화 내용이 삭제되며<br/>목록에서 사라집니다.
          </p>
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button 
            onClick={onClose} 
            className="flex-1 text-[#8E8E93] font-medium text-[16px] hover:bg-[#2C2C2E] border-r border-[#3A3A3C]"
          >
            취소
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 text-[#FF203A] font-bold text-[16px] hover:bg-[#2C2C2E]"
          >
            나가기
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InviteMemberModal({ 
  isOpen, 
  onClose, 
  friends,
  onInvite 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  friends: Friend[],
  onInvite: (selectedIds: number[]) => void
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleInviteClick = () => {
    if (selectedIds.length === 0) return;
    onInvite(selectedIds);
    setSelectedIds([]);
  };

  const filtered = friends.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ y: 50, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        className="relative z-10 w-full max-w-[340px] bg-[#1C1C1E] rounded-2xl overflow-hidden border border-[#2C2C2E] shadow-2xl h-[500px] flex flex-col"
      >
        <div className="h-14 bg-[#2C2C2E] flex items-center justify-between px-4 shrink-0">
          <span className="w-6" />
          <h3 className="text-white font-bold text-base">대화상대 초대</h3>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-[#8E8E93]" />
          </button>
        </div>

        <div className="px-4 pb-2 bg-[#2C2C2E]">
          <div className="bg-[#3A3A3C] rounded-xl flex items-center px-3 py-2">
            <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="이름 검색" 
              className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#8E8E93]" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-[#8E8E93] mt-10 text-sm">아직 초대할 수 있는 친구가 없습니다.</p>
          ) : (
            filtered.map(friend => {
              const isSelected = selectedIds.includes(friend.id);
              return (
                <div 
                  key={friend.id} 
                  onClick={() => toggleSelect(friend.id)} 
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-brand-DEFAULT/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                    {friend.avatar ? (
                      <img src={friend.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <UserPlus className="w-5 h-5 m-auto mt-2.5 opacity-50"/>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isSelected ? 'text-brand-DEFAULT' : 'text-white'}`}>
                      {friend.name}
                    </p>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT fill-brand-DEFAULT/20" />
                  ) : (
                    <Circle className="w-5 h-5 text-[#3A3A3C]" />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-[#2C2C2E]">
          <button 
            onClick={handleInviteClick}
            disabled={selectedIds.length === 0}
            className={`w-full h-12 rounded-xl font-bold text-white transition-all ${
              selectedIds.length > 0 
                ? 'bg-brand-DEFAULT hover:bg-brand-hover shadow-lg' 
                : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'
            }`}
          >
            초대하기 ({selectedIds.length})
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ImageViewerModal({ 
  isOpen, 
  initialIndex, 
  items, 
  onClose 
}: { 
  isOpen: boolean, 
  initialIndex: number, 
  items: MediaItem[], 
  onClose: () => void 
}) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => { 
    if (isOpen) setIndex(initialIndex); 
  }, [isOpen, initialIndex]);

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

  const paginate = (newDirection: number) => {
    const newIndex = index + newDirection;
    if (newIndex >= 0 && newIndex < items.length) {
      setDirection(newDirection);
      setIndex(newIndex);
    }
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -50 && index < items.length - 1) paginate(1);
    else if (info.offset.x > 50 && index > 0) paginate(-1);
  };

  const handleDownload = async () => {
    const currentItem = items[index];
    const loadingToast = toast.loading('다운로드 중...');
    try {
      const response = await fetch(currentItem.url);
      if (!response.ok) throw new Error();
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `media_${Date.now()}.${currentItem.type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('저장되었습니다.', { id: loadingToast });
    } catch {
      toast.error('다운로드 실패', { id: loadingToast });
    }
  };

  const variants = {
    enter: (direction: number) => ({ x: direction > 0 ? 500 : -500, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 500 : -500, opacity: 0 })
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-black/95 backdrop-blur-md">
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between z-20">
        <span className="text-white font-bold drop-shadow-md bg-black/20 px-3 py-1 rounded-full text-sm">
          {index + 1} / {items.length}
        </span>
        <button 
          onClick={onClose} 
          className="p-2 bg-white/10 rounded-full text-white backdrop-blur-md hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {index > 0 && (
        <button 
          onClick={() => paginate(-1)} 
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      
      {index < items.length - 1 && (
        <button 
          onClick={() => paginate(1)} 
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            className="absolute w-full h-full flex items-center justify-center"
          >
            {items[index].type === 'video' ? (
              <video 
                src={items[index].url} 
                controls 
                autoPlay 
                className="max-w-full max-h-full" 
              />
            ) : (
              <img 
                src={items[index].url} 
                className="max-w-full max-h-full object-contain" 
                alt="" 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-safe left-0 w-full flex justify-center pb-8 z-20">
        <button 
          onClick={handleDownload} 
          className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-full text-white shadow-xl hover:bg-white/20 active:scale-95 transition-all group"
        >
          <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-sm">저장하기</span>
        </button>
      </div>
    </div>
  );
}