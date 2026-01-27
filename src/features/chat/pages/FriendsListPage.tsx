import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { PanInfo, Point, Area } from 'framer-motion'; 
import { 
  Search, Settings, Star, MessageCircle, X, User as UserIcon, 
  UserPlus, MessageSquarePlus, CheckCircle2, Circle,
  Camera, Image as ImageIcon, Trash2, ZoomIn, Phone, BookUser, RefreshCw,
  ChevronRight, Users, Ban, AlertTriangle // ✨ AlertTriangle 추가
} from 'lucide-react';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';

// === [Utility] 이미지 크롭 함수 ===
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous'); 
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      resolve(URL.createObjectURL(blob));
    }, 'image/jpeg');
  });
}

// === [Types] ===
interface Friend {
  id: number;
  name: string;
  phone: string;
  status: string;
  avatar: string | null;
  bg: string | null;
  isFavorite: boolean;
  friendlyScore: number;
}

interface MyProfile {
  name: string;
  status: string;
  avatar: string | null;
  bg: string | null;
}

// === [Mock Data] ===
const MOCK_FRIENDS_DATA: Friend[] = [
    { id: 1, name: '1004천사', phone: '010-1004-1004', status: '숫자가 제일 먼저', avatar: null, bg: null, isFavorite: false, friendlyScore: 95 },
    { id: 2, name: '강민수', phone: '010-1234-5678', status: '한글은 가나다순', avatar: 'https://i.pravatar.cc/150?u=2', bg: 'https://picsum.photos/500/300?random=1', isFavorite: false, friendlyScore: 30 },
    { id: 3, name: 'Alice', phone: '010-1111-2222', status: '영어는 마지막', avatar: 'https://i.pravatar.cc/150?u=3', bg: 'https://picsum.photos/500/300?random=2', isFavorite: false, friendlyScore: 70 },
    { id: 4, name: '김철수', phone: '010-3333-4444', status: '상태메시지가 있어요', avatar: 'https://i.pravatar.cc/150?u=4', bg: null, isFavorite: false, friendlyScore: 10 },
];

export default function FriendsListPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<'permission' | 'complete' | 'list'>(() => {
    return localStorage.getItem('grayn_contact_permission') ? 'list' : 'permission';
  });
  const [isSynced, setIsSynced] = useState(() => localStorage.getItem('grayn_contact_permission') === 'granted');

  const [friends, setFriends] = useState<Friend[]>([]);

  const [myProfile, setMyProfile] = useState<MyProfile>({
    name: '나 (임정민)',
    status: '상태메시지 설정',
    avatar: 'https://i.pravatar.cc/150?u=me',
    bg: null
  });

  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  
  // 차단 모달 상태
  const [blockTarget, setBlockTarget] = useState<Friend | null>(null);
  
  // ✨ 삭제 모달 상태 추가
  const [deleteTarget, setDeleteTarget] = useState<Friend | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 설정 드롭다운 상태
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => { setFriends(MOCK_FRIENDS_DATA); }, []);

  const handlePermissionAllow = () => { 
    localStorage.setItem('grayn_contact_permission', 'granted'); 
    setIsSynced(true); 
    setStep('complete'); 
    setTimeout(() => setStep('list'), 1500); 
  };
  
  const handlePermissionDeny = () => { 
    localStorage.setItem('grayn_contact_permission', 'denied');
    setIsSynced(false); 
    setStep('list'); 
  };
  
  const handleSaveMyProfile = (newProfile: MyProfile) => { 
    setMyProfile(newProfile); 
    setShowEditProfileModal(false); 
    toast.success('프로필이 업데이트되었습니다.'); 
  };
  
  const toggleFavorite = (id: number) => {
    setFriends(prev => prev.map(f => f.id === id ? { ...f, isFavorite: !f.isFavorite } : f));
    if (selectedFriend && selectedFriend.id === id) { 
      setSelectedFriend(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null); 
    }
  };

  const handleEnterChat = (friendId: number) => {
    setSelectedFriend(null); 
    navigate(`/chat/room/${friendId}`); 
  };

  // ✨ 친구 삭제 버튼 클릭 (모달 열기)
  const handleDeleteClick = (id: number) => {
    const target = friends.find(f => f.id === id);
    if (target) {
      setDeleteTarget(target);
    }
  };

  // ✨ 친구 삭제 확정 (모달에서 확인 클릭 시)
  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      setFriends(prev => prev.filter(f => f.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('친구가 삭제되었습니다.');
    }
  };

  // 친구 차단 처리
  const handleBlockConfirm = (friendId: number, options: { blockMessage: boolean, hideProfile: boolean }) => {
    setFriends(prev => prev.filter(f => f.id !== friendId));
    setBlockTarget(null);
    toast.success('차단되었습니다. 더보기 > 친구 메뉴에서 확인 가능합니다.');
  };

  // 드롭다운 메뉴 핸들러
  const handleGoFriends = () => {
    navigate('/settings/friends');
    setIsSettingsOpen(false);
  };

  const handleGoSettings = () => {
    navigate('/main/settings'); 
    setIsSettingsOpen(false);
  };

  const filteredFriends = useMemo(() => {
    let result = friends;
    if (searchQuery) result = result.filter(f => f.name.includes(searchQuery) || f.phone.includes(searchQuery));
    return result;
  }, [friends, searchQuery]);

  const { favorites, normals } = useMemo(() => {
    const favs = filteredFriends.filter(f => f.isFavorite);
    const norms = filteredFriends.filter(f => !f.isFavorite);
    const sortFn = (a: Friend, b: Friend) => {
      const getType = (s: string) => {
        const code = s.charCodeAt(0);
        if (code >= 48 && code <= 57) return 1;
        if (code >= 44032 && code <= 55203) return 2;
        return 3;
      };
      const typeA = getType(a.name);
      const typeB = getType(b.name);
      if (typeA !== typeB) return typeA - typeB;
      return a.name.localeCompare(b.name);
    };
    return { favorites: favs, normals: norms.sort(sortFn) };
  }, [filteredFriends]);

  return (
    <div className="h-full w-full flex flex-col">
      {step === 'list' && (
        <>
          <header className="h-14 px-4 flex items-center justify-between bg-dark-bg sticky top-0 z-50 border-b border-[#2C2C2E] shrink-0">
            <h1 className="text-xl font-bold text-white ml-1">친구</h1>
            <div className="flex items-center gap-1 relative">
              <button onClick={() => setIsSearching(!isSearching)} className={`p-2 transition-colors ${isSearching ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}>
                <Search className="w-6 h-6" />
              </button>
              <button onClick={() => setShowAddFriendModal(true)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
                <UserPlus className="w-6 h-6" />
              </button>
              <button onClick={() => setShowCreateChatModal(true)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
                <MessageSquarePlus className="w-6 h-6" />
              </button>
              
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                className={`p-2 transition-colors ${isSettingsOpen ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
              >
                <Settings className="w-6 h-6" />
              </button>

              <AnimatePresence>
                {isSettingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSettingsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-10 right-0 w-40 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl shadow-xl z-50 overflow-hidden py-1.5"
                    >
                      <button 
                        onClick={handleGoFriends}
                        className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#3A3A3C] transition-colors"
                      >
                        친구 관리
                      </button>
                      <div className="h-[1px] bg-[#3A3A3C] mx-3 my-1" />
                      <button 
                        onClick={handleGoSettings}
                        className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#3A3A3C] transition-colors"
                      >
                        전체 설정
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </header>

          <AnimatePresence>
            {isSearching && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-5 py-2 bg-dark-bg shrink-0">
                <div className="bg-[#2C2C2E] rounded-xl flex items-center px-4 py-2">
                  <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
                  <input type="text" placeholder="친구 이름 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none" autoFocus />
                  {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-4 h-4 text-[#8E8E93]" /></button>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
            {isSynced && searchQuery && filteredFriends.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-[50vh] text-[#8E8E93] gap-2 animate-fade-in px-5">
                 <Search className="w-12 h-12 opacity-20 mb-2" />
                 <p className="text-base font-medium text-white">검색 결과가 없습니다.</p>
                 <button onClick={() => setShowAddFriendModal(true)} className="mt-4 px-5 py-2 bg-[#2C2C2E] rounded-full text-sm hover:bg-[#3A3A3C] transition-colors">연락처로 친구 찾기</button>
               </div>
            ) : (
              <>
                {!searchQuery && (
                  <>
                    <div className="px-5">
                        <div onClick={() => setShowEditProfileModal(true)} className="py-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-xl px-2 transition-colors">
                        <div className="w-14 h-14 rounded-[20px] bg-[#3A3A3C] overflow-hidden relative">
                            {myProfile.avatar ? <img src={myProfile.avatar} alt="Me" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#8E8E93]"><UserIcon className="w-6 h-6 opacity-50"/></div>}
                        </div>
                        <div>
                            <h2 className="text-[16px] font-bold">{myProfile.name}</h2>
                            <p className="text-xs text-[#8E8E93] mt-0.5">{myProfile.status || '상태메시지 설정'}</p>
                        </div>
                        </div>
                    </div>
                    <div className="h-[1px] bg-[#2C2C2E] w-full my-2" />
                  </>
                )}
                {!isSynced && !searchQuery ? (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-[#8E8E93] gap-4 px-5">
                    <UserIcon className="w-16 h-16 opacity-20" />
                    <p className="text-sm text-center">연락처를 동기화하면<br/>친구들을 만날 수 있어요.</p>
                    <button onClick={() => { localStorage.removeItem('grayn_contact_permission'); setStep('permission'); }} className="px-6 py-2 bg-[#2C2C2E] rounded-full text-sm font-medium hover:bg-[#3A3A3C] transition-colors">동기화하기</button>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    {favorites.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[11px] text-[#636366] font-medium mb-1 px-5 mt-2">즐겨찾기</p>
                        {favorites.map(f => (
                          <FriendItem 
                            key={f.id} 
                            friend={f} 
                            onClick={() => setSelectedFriend(f)} 
                            onBlock={() => setBlockTarget(f)}
                            onDelete={() => handleDeleteClick(f.id)} // ✨ 함수 변경
                          />
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] text-[#636366] font-medium mb-1 px-5 mt-2">친구 {normals.length}</p>
                      {normals.map(f => (
                        <FriendItem 
                          key={f.id} 
                          friend={f} 
                          onClick={() => setSelectedFriend(f)}
                          onBlock={() => setBlockTarget(f)}
                          onDelete={() => handleDeleteClick(f.id)} // ✨ 함수 변경
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {step === 'permission' && (<ModalBackdrop><div className="w-full max-w-[280px] bg-[#1C1C1E] rounded-xl overflow-hidden shadow-2xl z-10 text-center"><div className="p-6"><h3 className="text-white font-semibold text-lg mb-2">연락처 접근 권한</h3><p className="text-[#8E8E93] text-sm">친구 목록 자동 동기화를 위해<br/>권한이 필요합니다.</p></div><div className="flex border-t border-[#3A3A3C]"><button onClick={handlePermissionDeny} className="flex-1 py-3.5 text-[#0A84FF] text-[17px] border-r border-[#3A3A3C]">허용 안 함</button><button onClick={handlePermissionAllow} className="flex-1 py-3.5 text-[#0A84FF] font-semibold text-[17px]">확인</button></div></div></ModalBackdrop>)}
      
      {step === 'complete' && (<ModalBackdrop><motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-4"><div className="w-16 h-16 rounded-full bg-brand-DEFAULT flex items-center justify-center shadow-lg"><Star className="w-8 h-8 text-white fill-white" /></div><h3 className="text-xl font-bold text-white">설정 완료!</h3></motion.div></ModalBackdrop>)}
      
      <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} initialProfile={myProfile} onSave={handleSaveMyProfile} />
      
      <AddFriendModal isOpen={showAddFriendModal} onClose={() => setShowAddFriendModal(false)} />
      
      <CreateChatModal isOpen={showCreateChatModal} onClose={() => setShowCreateChatModal(false)} friends={friends} />
      
      <BlockFriendModal 
        friend={blockTarget} 
        onClose={() => setBlockTarget(null)} 
        onConfirm={handleBlockConfirm} 
      />

      {/* ✨ 친구 삭제 모달 */}
      <DeleteFriendModal
        friend={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />

      {selectedFriend && (
        <ModalBackdrop onClick={() => setSelectedFriend(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-[340px] bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl border border-[#2C2C2E]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => toggleFavorite(selectedFriend.id)} className="absolute top-4 left-4 z-20 p-2 rounded-full hover:bg-black/20"><Star className={`w-6 h-6 ${selectedFriend.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-white/70'}`} /></button>
            <button onClick={() => setSelectedFriend(null)} className="absolute top-4 right-4 z-20 p-2 bg-black/30 rounded-full text-white"><X className="w-5 h-5" /></button>
            <div className="h-64 bg-[#2C2C2E]">{selectedFriend.bg ? <img src={selectedFriend.bg} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E]" />}</div>
            <div className="px-6 pb-8 -mt-12 relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full border-[3px] border-[#1C1C1E] bg-[#2C2C2E] overflow-hidden shadow-lg mb-4">{selectedFriend.avatar ? <img src={selectedFriend.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 opacity-50 m-auto mt-6" />}</div>
              <h3 className="text-xl font-bold text-white mb-1">{selectedFriend.name}</h3>{selectedFriend.status && <p className="text-[#8E8E93] text-sm mb-6">{selectedFriend.status}</p>}
              <div className="mb-6 flex flex-col items-center gap-1"><div className="text-[10px] text-brand-DEFAULT font-bold tracking-wider">AI SCORE</div><div className="flex items-center gap-2 bg-[#2C2C2E] px-3 py-1 rounded-full border border-[#3A3A3C]"><div className={`w-2 h-2 rounded-full ${selectedFriend.friendlyScore > 80 ? 'bg-green-500' : selectedFriend.friendlyScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} /><span className="text-xs font-mono font-bold">{selectedFriend.friendlyScore}</span></div></div>
              <div className="flex gap-6 w-full justify-center"><button onClick={() => handleEnterChat(selectedFriend.id)} className="flex flex-col items-center gap-1 group"><div className="w-12 h-12 rounded-full bg-[#2C2C2E] group-hover:bg-[#3A3A3C] flex items-center justify-center text-white border border-[#3A3A3C]"><MessageCircle className="w-5 h-5" /></div><span className="text-[11px] text-[#E5E5EA]">1:1 채팅</span></button></div>
            </div>
          </motion.div>
        </ModalBackdrop>
      )}
    </div>
  );
}

// === Sub Components ===

function FriendItem({ 
  friend, 
  onClick, 
  onBlock, 
  onDelete 
}: { 
  friend: Friend; 
  onClick: () => void; 
  onBlock: () => void; 
  onDelete: () => void; 
}) {
  const controls = useAnimation();
  const SWIPE_WIDTH = -140; 

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (info.offset.x < -50) {
      await controls.start({ x: SWIPE_WIDTH }); 
    } else {
      await controls.start({ x: 0 });
    }
  };

  const scoreColor = friend.friendlyScore >= 80 ? 'text-green-500' : friend.friendlyScore >= 40 ? 'text-yellow-500' : 'text-[#8E8E93]';

  return (
    <div className="relative w-full h-[72px] overflow-hidden border-b border-[#2C2C2E] last:border-none bg-dark-bg">
      <div 
        className="absolute inset-y-0 right-0 flex h-full z-0"
        style={{ width: `140px` }}
      >
        <button 
          onClick={() => { onBlock(); controls.start({ x: 0 }); }}
          className="flex-1 h-full bg-[#3A3A3C] flex flex-col items-center justify-center text-[#E5E5EA] active:bg-[#48484A] transition-colors"
        >
          <Ban className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">차단</span>
        </button>
        <button 
          onClick={() => { onDelete(); controls.start({ x: 0 }); }}
          className="flex-1 h-full bg-[#EC5022] flex flex-col items-center justify-center text-white active:bg-red-600 transition-colors"
        >
          <Trash2 className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">삭제</span>
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: SWIPE_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        onClick={onClick}
        className="relative w-full h-full bg-dark-bg flex items-center px-4 z-10 cursor-pointer active:bg-white/5 transition-colors"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="w-[48px] h-[48px] rounded-[18px] bg-[#3A3A3C] overflow-hidden flex-shrink-0 relative mr-4">
          {friend.avatar ? <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#8E8E93]"><UserIcon className="w-6 h-6 opacity-50" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[15px] font-medium text-white leading-tight truncate">{friend.name}</h4>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#2C2C2E] ${scoreColor}`}>{friend.friendlyScore}°</span>
          </div>
          {friend.status && <p className="text-[12px] text-[#8E8E93] mt-0.5 truncate">{friend.status}</p>}
        </div>
      </motion.div>
    </div>
  );
}

function BlockFriendModal({ 
  friend, 
  onClose, 
  onConfirm 
}: { 
  friend: Friend | null; 
  onClose: () => void; 
  onConfirm: (id: number, options: { blockMessage: boolean, hideProfile: boolean }) => void; 
}) {
  const [blockMessage, setBlockMessage] = useState(true);
  const [hideProfile, setHideProfile] = useState(true);

  if (!friend) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
        onClick={(e) => e.stopPropagation()} 
        className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]"
      >
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-4 text-center">
            {friend.name}님을 차단하시겠습니까?
          </h3>
          <p className="text-xs text-[#8E8E93] text-center mb-6 leading-relaxed">
            차단하면 서로에게 연락할 수 없습니다.<br/>
            차단 친구 관리에서 해제할 수 있습니다.
          </p>
          
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-[#2C2C2E] rounded-xl cursor-pointer hover:bg-[#3A3A3C] transition-colors">
              <span className="text-sm text-white">메시지 차단</span>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${blockMessage ? 'bg-brand-DEFAULT border-brand-DEFAULT' : 'border-[#636366]'}`}>
                {blockMessage && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={blockMessage} onChange={() => setBlockMessage(!blockMessage)} />
            </label>
            <label className="flex items-center justify-between p-3 bg-[#2C2C2E] rounded-xl cursor-pointer hover:bg-[#3A3A3C] transition-colors">
              <span className="text-sm text-white">프로필 비공개</span>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${hideProfile ? 'bg-brand-DEFAULT border-brand-DEFAULT' : 'border-[#636366]'}`}>
                {hideProfile && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={hideProfile} onChange={() => setHideProfile(!hideProfile)} />
            </label>
          </div>
          {hideProfile && (
            <p className="text-[11px] text-[#EC5022] mt-2 text-center">
              * 상대방에게 기본 프로필로 보여집니다.
            </p>
          )}
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button 
            onClick={onClose} 
            className="flex-1 text-[#8E8E93] font-medium text-[15px] hover:bg-[#2C2C2E] transition-colors border-r border-[#3A3A3C]"
          >
            취소
          </button>
          <button 
            onClick={() => onConfirm(friend.id, { blockMessage, hideProfile })} 
            className="flex-1 text-brand-DEFAULT font-bold text-[15px] hover:bg-[#2C2C2E] transition-colors"
          >
            확인
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ✨ [New] 친구 삭제 모달 컴포넌트
function DeleteFriendModal({ 
  friend, 
  onClose, 
  onConfirm 
}: { 
  friend: Friend | null; 
  onClose: () => void; 
  onConfirm: () => void; 
}) {
  if (!friend) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
        onClick={(e) => e.stopPropagation()} 
        className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]"
      >
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-[#EC5022]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#EC5022]" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">
            {friend.name}님을 삭제하시겠습니까?
          </h3>
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            삭제된 친구는<br/>
            친구 추가 메뉴에서 다시 추가할 수 있습니다.
          </p>
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button 
            onClick={onClose} 
            className="flex-1 text-[#8E8E93] font-medium text-[15px] hover:bg-[#2C2C2E] transition-colors border-r border-[#3A3A3C]"
          >
            취소
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 text-[#EC5022] font-bold text-[15px] hover:bg-[#2C2C2E] transition-colors"
          >
            삭제
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EditProfileModal({ isOpen, onClose, initialProfile, onSave }: { isOpen: boolean; onClose: () => void; initialProfile: MyProfile; onSave: (p: MyProfile) => void }) {
  const [profile, setProfile] = useState(initialProfile);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'avatar' | 'bg' | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'avatar' | 'bg' | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isOpen) setProfile(initialProfile); }, [isOpen, initialProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'bg') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => { setTempImageSrc(reader.result as string); setCropType(type); setCrop({ x: 0, y: 0 }); setZoom(1); });
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => { setCroppedAreaPixels(croppedAreaPixels); }, []);
  const handleCropSave = async () => {
    if (!tempImageSrc || !croppedAreaPixels || !cropType) return;
    try { const croppedImage = await getCroppedImg(tempImageSrc, croppedAreaPixels); setProfile(prev => ({ ...prev, [cropType]: croppedImage })); setTempImageSrc(null); setCropType(null); toast.success('이미지가 변경되었습니다.'); } catch (e) { toast.error('오류가 발생했습니다.'); }
  };

  const requestDelete = (e: React.MouseEvent, type: 'avatar' | 'bg') => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(type); setShowDeleteConfirm(true); };
  const confirmDelete = () => { if (deleteTarget) { setProfile(prev => ({ ...prev, [deleteTarget]: null })); toast.success('기본 이미지로 변경되었습니다.'); } setShowDeleteConfirm(false); setDeleteTarget(null); };
  const handleSave = () => { if (!profile.name.trim()) return toast.error('닉네임을 입력해주세요.'); onSave(profile); };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
        <div className="h-14 flex items-center justify-between px-4 bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0"><button onClick={onClose}><X className="w-6 h-6 text-white" /></button><span className="font-bold text-lg text-white">프로필 편집</span><button onClick={handleSave} className="text-brand-DEFAULT font-bold text-base">완료</button></div>
        <div className="flex-1 overflow-y-auto bg-dark-bg">
          <div className="relative w-full">
            <div onClick={() => bgInputRef.current?.click()} className="h-48 bg-[#2C2C2E] relative cursor-pointer group">
              {profile.bg ? (<><img src={profile.bg} className="w-full h-full object-cover opacity-70" /><button onClick={(e) => requestDelete(e, 'bg')} className="absolute top-4 right-4 p-2.5 bg-black/70 hover:bg-red-500 rounded-full text-white backdrop-blur-sm z-50 transition-all border border-white/10 shadow-lg"><Trash2 className="w-4 h-4" /></button></>) : (<div className="w-full h-full flex items-center justify-center text-[#8E8E93] gap-2"><ImageIcon className="w-6 h-6"/><span>배경 사진</span></div>)}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"><Camera className="w-8 h-8 text-white drop-shadow-md" /></div>
            </div>
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-20">
              <div className="relative">
                <div onClick={() => avatarInputRef.current?.click()} className="w-28 h-28 rounded-full border-4 border-dark-bg bg-[#3A3A3C] overflow-hidden cursor-pointer group relative">
                  {profile.avatar ? (<img src={profile.avatar} className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />) : (<UserIcon className="w-10 h-10 text-[#8E8E93] m-auto mt-7" />)}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"><Camera className="w-6 h-6 text-white drop-shadow-md" /></div>
                </div>
                {profile.avatar && (<button onClick={(e) => requestDelete(e, 'avatar')} className="absolute -top-1 -right-1 w-9 h-9 bg-[#1C1C1E] border-2 border-white/20 rounded-full flex items-center justify-center text-white hover:bg-red-500 hover:border-red-500 transition-all z-50 shadow-lg"><Trash2 className="w-4 h-4" /></button>)}
              </div>
            </div>
            <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'bg')} />
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} />
          </div>
          <div className="mt-16 px-6 space-y-6">
            <div className="space-y-2"><label className="text-xs font-medium text-[#8E8E93] ml-1">닉네임</label><input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full bg-[#2C2C2E] rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT" /></div>
            <div className="space-y-2"><label className="text-xs font-medium text-[#8E8E93] ml-1">상태 메시지</label><input type="text" value={profile.status} onChange={(e) => setProfile({ ...profile, status: e.target.value })} className="w-full bg-[#2C2C2E] rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT" /></div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {tempImageSrc && cropType && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 bg-black/50 absolute top-0 left-0 w-full z-10"><button onClick={() => { setTempImageSrc(null); setCropType(null); }} className="p-2 text-white"><X className="w-6 h-6" /></button><span className="font-bold text-lg text-white">{cropType === 'avatar' ? '프로필' : '배경'} 편집</span><button onClick={handleCropSave} className="px-4 py-2 bg-brand-DEFAULT rounded-full text-sm font-bold text-white">완료</button></div>
            <div className="relative flex-1 bg-black"><Cropper image={tempImageSrc} crop={crop} zoom={zoom} aspect={cropType === 'avatar' ? 1 : 16 / 9} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} cropShape={cropType === 'avatar' ? 'round' : 'rect'} showGrid={false} /></div>
            <div className="h-24 bg-[#1C1C1E] flex items-center px-6 gap-4 pb-safe"><ZoomIn className="w-5 h-5 text-[#8E8E93]" /><input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-brand-DEFAULT h-1 bg-[#3A3A3C] rounded-lg appearance-none" /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-6" onClick={() => setShowDeleteConfirm(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="relative z-10 w-full max-w-[280px] bg-[#1C1C1E] rounded-xl overflow-hidden shadow-2xl text-center border border-[#2C2C2E]">
              <div className="p-6"><h3 className="text-white font-semibold text-lg mb-2">{deleteTarget === 'avatar' ? '기본 프로필로 변경' : '기본 배경으로 변경'}</h3><p className="text-[#8E8E93] text-sm">{deleteTarget === 'avatar' ? '프로필 사진을 초기화하시겠습니까?' : '배경 사진을 초기화하시겠습니까?'}</p></div>
              <div className="flex border-t border-[#3A3A3C]"><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3.5 text-[#8E8E93] text-[17px] border-r border-[#3A3A3C]">취소</button><button onClick={confirmDelete} className="flex-1 py-3.5 text-[#FF453A] font-semibold text-[17px]">초기화</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function AddFriendModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'search' | 'sync'>('search');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [searchResult, setSearchResult] = useState<'none' | 'found' | 'not-found'>('none');
  const [foundUser, setFoundUser] = useState<Friend | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab('search');
      setName('');
      setPhone('');
      setSearchResult('none');
      setIsSyncing(false);
    }
  }, [isOpen]);

  const handleSearch = () => { 
    if(!name || !phone) return toast.error('정보를 입력해주세요'); 
    const target = MOCK_FRIENDS_DATA.find(f => f.name === name && f.phone === phone); 
    if (target) { setFoundUser(target); setSearchResult('found'); } 
    else { setSearchResult('not-found'); } 
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success('연락처가 최신 상태로 동기화되었습니다.');
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <ModalBackdrop onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-w-[360px] bg-[#1C1C1E] rounded-3xl overflow-hidden border border-[#2C2C2E] shadow-2xl flex flex-col max-h-[500px]"
      >
        <div className="h-14 flex items-center justify-between px-5 bg-[#2C2C2E] shrink-0">
          <h3 className="text-white font-bold text-lg">친구 추가</h3>
          <button onClick={onClose} className="text-[#8E8E93] hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex border-b border-[#3A3A3C] bg-[#1C1C1E]">
          <button 
            onClick={() => setTab('search')} 
            className="flex-1 py-3 text-sm font-bold relative transition-colors"
          >
            <span className={tab === 'search' ? 'text-white' : 'text-[#8E8E93]'}>ID/전화번호</span>
            {tab === 'search' && (
              <motion.div layoutId="modal-tab" className="absolute bottom-0 left-0 w-full h-[2px] bg-brand-DEFAULT" />
            )}
          </button>
          <button 
            onClick={() => setTab('sync')} 
            className="flex-1 py-3 text-sm font-bold relative transition-colors"
          >
            <span className={tab === 'sync' ? 'text-white' : 'text-[#8E8E93]'}>연락처 동기화</span>
            {tab === 'sync' && (
              <motion.div layoutId="modal-tab" className="absolute bottom-0 left-0 w-full h-[2px] bg-brand-DEFAULT" />
            )}
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {tab === 'search' ? (
            <div className="flex flex-col gap-5">
              {searchResult === 'none' && (
                <>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[#8E8E93] ml-1">이름</label>
                      <div className="bg-[#2C2C2E] rounded-xl px-4 py-3 flex items-center">
                        <UserIcon className="w-5 h-5 text-[#636366] mr-3" />
                        <input 
                          type="text" 
                          value={name} 
                          onChange={(e) => setName(e.target.value)} 
                          placeholder="이름 입력" 
                          className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#636366]" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[#8E8E93] ml-1">휴대폰 번호</label>
                      <div className="bg-[#2C2C2E] rounded-xl px-4 py-3 flex items-center">
                        <Phone className="w-5 h-5 text-[#636366] mr-3" />
                        <input 
                          type="tel" 
                          value={phone} 
                          onChange={(e) => setPhone(e.target.value)} 
                          placeholder="010-0000-0000" 
                          className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#636366]" 
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleSearch} 
                    className="w-full h-12 bg-brand-DEFAULT text-white font-bold rounded-xl hover:bg-brand-hover transition-colors shadow-lg shadow-brand-DEFAULT/20 mt-2"
                  >
                    친구 찾기
                  </button>
                </>
              )}

              {searchResult === 'found' && foundUser && (
                <div className="flex flex-col items-center py-6 animate-fade-in">
                  <div className="w-24 h-24 rounded-full bg-[#3A3A3C] mb-4 overflow-hidden border-4 border-[#2C2C2E]">
                    {foundUser.avatar ? (
                      <img src={foundUser.avatar} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-10 h-10 m-auto mt-7 text-[#8E8E93] opacity-50"/>
                    )}
                  </div>
                  <p className="text-xl font-bold text-white mb-6">{foundUser.name}</p>
                  <button 
                    onClick={() => { toast.success('친구가 추가되었습니다.'); onClose(); }} 
                    className="w-full h-12 bg-brand-DEFAULT text-white font-bold rounded-xl hover:bg-brand-hover transition-colors"
                  >
                    친구 추가
                  </button>
                </div>
              )}

              {searchResult === 'not-found' && (
                <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-[#2C2C2E] flex items-center justify-center mb-4">
                    <UserIcon className="w-8 h-8 text-[#636366]" />
                  </div>
                  <p className="text-white font-bold text-lg mb-1">사용자를 찾을 수 없습니다.</p>
                  <p className="text-xs text-[#8E8E93] mb-6">입력하신 정보가 정확한지 확인해주세요.</p>
                  <button 
                    onClick={() => setSearchResult('none')} 
                    className="px-6 py-2.5 bg-[#2C2C2E] text-white text-sm font-medium rounded-lg hover:bg-[#3A3A3C] transition-colors"
                  >
                    다시 검색하기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-6 text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-[#2C2C2E] flex items-center justify-center mb-5 relative">
                <BookUser className="w-9 h-9 text-[#8E8E93]" />
                {isSyncing && (
                  <div className="absolute inset-0 border-4 border-brand-DEFAULT border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <h3 className="text-white font-bold text-lg mb-2">연락처 자동 동기화</h3>
              <p className="text-sm text-[#8E8E93] mb-8 leading-relaxed max-w-[240px]">
                내 기기의 연락처에 등록된 친구들을<br/>자동으로 찾아 친구 목록에 추가합니다.
              </p>
              <button 
                onClick={handleSync} 
                disabled={isSyncing}
                className="w-full h-12 bg-[#2C2C2E] text-white font-bold rounded-xl hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    동기화 중...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    지금 동기화하기
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

function CreateChatModal({ isOpen, onClose, friends }: { isOpen: boolean; onClose: () => void; friends: Friend[] }) {
    const [step, setStep] = useState<'select-type' | 'select-friends'>('select-type');
    const [chatType, setChatType] = useState<'individual' | 'group'>('individual');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const toggleSelection = (id: number) => { if (chatType === 'individual') { setSelectedIds([id]); } else { if (selectedIds.includes(id)) { setSelectedIds(prev => prev.filter(pid => pid !== id)); } else { if (selectedIds.length >= 100) return toast.error('최대 100명까지만 초대 가능합니다.'); setSelectedIds(prev => [...prev, id]); } } };
    const handleCreate = () => { if (selectedIds.length === 0) return toast.error('대화 상대를 선택해주세요.'); toast.success(`${chatType === 'group' ? '그룹' : '1:1'} 채팅방이 생성되었습니다.`); onClose(); setTimeout(() => setStep('select-type'), 300); };
    if (!isOpen) return null;
    return (
        <ModalBackdrop onClick={onClose}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[340px] bg-[#1C1C1E] rounded-2xl overflow-hidden border border-[#2C2C2E] shadow-2xl h-[500px] flex flex-col">
                <div className="h-14 bg-[#2C2C2E] flex items-center justify-between px-4 flex-shrink-0">{step === 'select-friends' ? (<button onClick={() => setStep('select-type')}><ChevronRight className="w-6 h-6 rotate-180 text-white" /></button>) : (<span />)}<h3 className="text-white font-bold text-base">{step === 'select-type' ? '새로운 채팅' : chatType === 'group' ? '대화 상대 초대' : '대화 상대 선택'}</h3><button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button></div>
                {step === 'select-type' && (<div className="flex-1 p-6 flex flex-col gap-4 justify-center"><button onClick={() => { setChatType('individual'); setStep('select-friends'); setSelectedIds([]); }} className="flex items-center gap-4 p-5 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors text-left group"><div className="w-12 h-12 rounded-full bg-brand-DEFAULT/10 flex items-center justify-center text-brand-DEFAULT group-hover:bg-brand-DEFAULT group-hover:text-white transition-colors"><UserIcon className="w-6 h-6" /></div><div><h4 className="text-lg font-bold text-white">1:1 채팅</h4><p className="text-xs text-[#8E8E93]">친구 한 명과 대화합니다.</p></div></button><button onClick={() => { setChatType('group'); setStep('select-friends'); setSelectedIds([]); }} className="flex items-center gap-4 p-5 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors text-left group"><div className="w-12 h-12 rounded-full bg-brand-DEFAULT/10 flex items-center justify-center text-brand-DEFAULT group-hover:bg-brand-DEFAULT group-hover:text-white transition-colors"><Users className="w-6 h-6" /></div><div><h4 className="text-lg font-bold text-white">그룹 채팅</h4><p className="text-xs text-[#8E8E93]">여러 친구와 함께 대화합니다.</p></div></button></div>)}
                {step === 'select-friends' && (<><div className="flex-1 overflow-y-auto custom-scrollbar p-2">{friends.map(friend => { const isSelected = selectedIds.includes(friend.id); return (<div key={friend.id} onClick={() => toggleSelection(friend.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-brand-DEFAULT/10' : 'hover:bg-white/5'}`}><div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">{friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover"/> : <UserIcon className="w-5 h-5 m-auto mt-2.5 opacity-50"/>}</div><div className="flex-1"><p className={`text-sm font-medium ${isSelected ? 'text-brand-DEFAULT' : 'text-white'}`}>{friend.name}</p></div>{isSelected ? <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT fill-brand-DEFAULT/20" /> : <Circle className="w-5 h-5 text-[#3A3A3C]" />}</div>) })}</div><div className="p-4 border-t border-[#2C2C2E]"><button onClick={handleCreate} disabled={selectedIds.length === 0} className={`w-full h-12 rounded-xl font-bold text-white transition-all ${selectedIds.length > 0 ? 'bg-brand-DEFAULT hover:bg-brand-hover shadow-lg' : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'}`}>{selectedIds.length}명과 시작하기</button></div></>)}
            </motion.div>
        </ModalBackdrop>
    );
}

function ModalBackdrop({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClick}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative z-10 w-full flex justify-center pointer-events-none"><div className="pointer-events-auto w-full flex justify-center">{children}</div></div>
        </div>
    );
}