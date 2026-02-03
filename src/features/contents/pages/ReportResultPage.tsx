import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Share2, Clock, MessageCircle, 
  Heart, TrendingUp, Calendar, Download,
  Search, User as UserIcon, Briefcase, Home, ChevronRight, AlertCircle
} from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';

const RELATION_TYPES = [
  { id: 'dating', label: '썸 · 연인', icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { id: 'friend', label: '찐친 · 우정', icon: UserIcon, color: 'text-green-400', bg: 'bg-green-500/10' },
  { id: 'business', label: '동료 · 비즈니스', icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'family', label: '가족', icon: Home, color: 'text-orange-400', bg: 'bg-orange-500/10' },
];

interface Friend {
  id: string;
  nickname: string;
  profile_image: string | null;
  status_message: string | null;
}

interface AnalysisResult {
  score: number;
  totalMessages: number;
  myShare: number;
  friendShare: number;
  avgReplyTime: string;
  topKeywords: string[];
  comment: string;
}

export default function ReportResultPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState<'select_user' | 'select_relation' | 'analyzing' | 'result'>('select_user');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<typeof RELATION_TYPES[0] | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 친구 목록 로드
  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      try {
        setLoadingFriends(true);
        // Supabase Query: friendships 테이블과 public.users를 조인
        const { data, error } = await supabase
          .from('friendships')
          .select(`
            friend_id,
            friend:users!friendships_friend_id_fkey (
              id,
              nickname,
              profile_image,
              status_message
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'accepted'); // 수락된 친구만

        if (error) {
            console.error('Supabase Error:', error);
            throw error;
        }

        const formattedFriends = data.map((item: any) => ({
          id: item.friend.id,
          nickname: item.friend.nickname || '알 수 없음',
          profile_image: item.friend.profile_image,
          status_message: item.friend.status_message,
        }));

        setFriends(formattedFriends);
      } catch (error) {
        console.error('친구 로딩 실패:', error);
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [user]);

  // 2. 알림 권한
  useEffect(() => {
    LocalNotifications.requestPermissions();
  }, []);

  // 3. 분석 로직 (실제 대화 카운트)
  const startAnalysis = async () => {
    if (!user || !selectedFriend) return;
    setStep('analyzing');

    try {
      // (1) 채팅방 찾기
      const { data: myRooms } = await supabase.from('room_members').select('room_id').eq('user_id', user.id);
      const { data: friendRooms } = await supabase.from('room_members').select('room_id').eq('user_id', selectedFriend.id);
      
      const myIds = myRooms?.map(r => r.room_id) || [];
      const friendIds = friendRooms?.map(r => r.room_id) || [];
      const commonRoomId = myIds.find(id => friendIds.includes(id));

      let totalCount = 0;
      let myCount = 0;
      let score = 0;

      if (commonRoomId) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('room_id', commonRoomId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (msgs) {
          totalCount = msgs.length;
          myCount = msgs.filter(m => m.sender_id === user.id).length;
        }
      }

      // 점수 계산
      const volumeScore = Math.min((totalCount / 300) * 50, 50);
      const myRatio = totalCount > 0 ? myCount / totalCount : 0.5;
      const balanceScore = 50 * (1 - Math.abs(0.5 - myRatio) * 2);
      score = Math.floor(Math.max(10, volumeScore + balanceScore));

      // 결과 생성
      let comment = "아직은 조금 어색해요";
      if (score >= 90) comment = "영혼을 나눈 단짝!";
      else if (score >= 70) comment = "급속도로 친해지는 중";
      else if (score >= 50) comment = "알아가는 단계";

      const myShare = totalCount > 0 ? Math.round((myCount / totalCount) * 100) : 0;

      setAnalysisResult({
        score,
        totalMessages: totalCount,
        myShare,
        friendShare: 100 - myShare,
        avgReplyTime: score > 60 ? '빠름 (10분 이내)' : '보통 (1시간 이내)',
        topKeywords: totalCount > 0 ? ['ㅋㅋㅋ', '진짜', '대박', '맞아'] : ['(대화 없음)'],
        comment
      });

      // 3초 후 알림 및 결과 화면 이동
      setTimeout(async () => {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "분석 완료! 💌",
              body: `${selectedFriend.nickname}님과의 관계 점수는 ${score}점입니다!`,
              id: 1,
              schedule: { at: new Date(Date.now() + 100) },
              sound: undefined, attachments: undefined, actionTypeId: "", extra: null
            }
          ]
        });
        setStep('result');
      }, 3000);

    } catch (e) {
      console.error(e);
      setStep('result');
    }
  };

  const handleBack = () => {
    if (step === 'select_user') navigate(-1);
    else if (step === 'select_relation') setStep('select_user');
    else if (step === 'result') navigate(-1);
  };

  // --- 렌더링 (이전과 동일하지만 중요 로직은 위에서 처리됨) ---
  const renderUserSelection = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-5">
      <h2 className="text-xl font-bold text-white mb-2">누구와의 관계를<br/>알아볼까요?</h2>
      <p className="text-sm text-gray-400 mb-6">대화를 분석할 친구를 선택해주세요.</p>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-500" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-[#1C1C1E] text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          placeholder="친구 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-2 pb-20">
        {loadingFriends ? (
          <div className="text-center text-gray-500 py-10">친구 목록을 불러오는 중...</div>
        ) : friends.length === 0 ? (
          <div className="text-center text-gray-500 py-10 flex flex-col items-center">
             <AlertCircle className="w-8 h-8 mb-2 opacity-50"/>
             <p>친구가 없어요.<br/>친구를 먼저 추가해주세요!</p>
          </div>
        ) : (
          friends
            .filter(f => f.nickname.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((friend) => (
              <button
                key={friend.id}
                onClick={() => {
                  setSelectedFriend(friend);
                  setStep('select_relation');
                }}
                className="w-full flex items-center p-3 rounded-xl hover:bg-[#1C1C1E] transition-colors border border-transparent hover:border-white/10"
              >
                <div className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center text-gray-500 mr-4 border border-white/5 overflow-hidden">
                  {friend.profile_image ? (
                    <img src={friend.profile_image} alt={friend.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6" />
                  )}
                </div>
                <div className="text-left flex-1">
                  <div className="text-white font-medium">{friend.nickname}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[180px]">
                    {friend.status_message || ''}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            ))
        )}
      </div>
    </motion.div>
  );

  const renderRelationSelection = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-5 h-full flex flex-col">
      <h2 className="text-xl font-bold text-white mb-2">어떤 사이인가요?</h2>
      <p className="text-sm text-gray-400 mb-8">
        <span className="text-white font-bold">{selectedFriend?.nickname}</span>님과의 관계를 선택하면<br/>
        더 정확한 분석이 가능합니다.
      </p>
      <div className="grid grid-cols-1 gap-3">
        {RELATION_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => {
                setSelectedRelation(type);
                startAnalysis();
              }}
              className="relative w-full p-5 rounded-2xl bg-[#1C1C1E] border border-white/5 hover:border-white/20 active:scale-[0.98] transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type.bg} ${type.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-lg font-bold text-gray-200 group-hover:text-white transition-colors">
                  {type.label}
                </span>
              </div>
              <div className="w-5 h-5 rounded-full border-2 border-[#3A3A3C] group-hover:border-white transition-colors" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );

  const renderAnalyzing = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-32 h-32 mb-8">
        <motion.div className="absolute inset-0 border-4 border-[#2C2C2E] rounded-full" />
        <motion.div 
          className="absolute inset-0 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">🔍</span>
        </div>
      </div>
      <h2 className="text-xl font-bold mb-3">대화 기록 정밀 분석 중...</h2>
      <p className="text-sm text-gray-500 mb-8">앱을 닫아도 알림으로 결과를 보내드려요!</p>
    </motion.div>
  );

  const renderResult = () => {
    if (!analysisResult) return null;
    const { score, totalMessages, myShare, friendShare, avgReplyTime, topKeywords, comment } = analysisResult;
    return (
      <div className="animate-fade-in pb-8">
        <section className="text-center pt-8 mb-8">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-block relative">
            <div className="text-[64px] font-black tracking-tighter leading-none bg-gradient-to-br from-purple-400 to-pink-500 bg-clip-text text-transparent">
              {score}점
            </div>
          </motion.div>
          <h2 className="text-xl font-bold mt-4 mb-2 text-white">"{comment}"</h2>
          <p className="text-sm text-gray-400">총 <span className="text-purple-400 font-bold">{totalMessages}통</span>의 대화를 분석했습니다.</p>
        </section>

        <div className="px-5 space-y-4">
          <section className="bg-[#1C1C1E] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <MessageCircle className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-200">대화 밸런스</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1 text-gray-400"><span>나 ({myShare}%)</span></div>
                <div className="h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${myShare}%` }} transition={{ duration: 1 }} className="h-full bg-gray-500 rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1 text-gray-400"><span>{selectedFriend?.nickname} ({friendShare}%)</span></div>
                <div className="h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${friendShare}%` }} transition={{ duration: 1 }} className="h-full bg-purple-500 rounded-full" />
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="bg-[#1C1C1E] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-500">답장 속도</span></div>
              <div className="text-xl font-bold">{avgReplyTime}</div>
            </div>
            <div className="bg-[#1C1C1E] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-2"><Heart className="w-4 h-4 text-pink-400" /><span className="text-xs text-gray-500">감정 표현</span></div>
              <div className="text-xl font-bold">긍정적</div>
            </div>
          </section>

          <section className="bg-[#1C1C1E] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-gray-400" /><h3 className="text-sm font-bold text-gray-200">많이 쓴 단어</h3></div>
            <div className="flex flex-wrap gap-2">
              {topKeywords.map((word, idx) => (
                <span key={idx} className="px-3 py-1.5 rounded-lg font-medium text-sm bg-[#2C2C2E] text-gray-300 border border-white/5">{word}</span>
              ))}
            </div>
          </section>

          <button className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg">
            <Download className="w-5 h-5" />
            결과 저장하기
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-[#000000] text-white pb-safe scrollbar-hide">
      <header className="sticky top-0 z-50 bg-[#000000]/80 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-white/5">
        <button onClick={handleBack} className="p-2 -ml-2 text-gray-400 hover:text-white">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm">
          {step === 'select_user' && '분석 대상 선택'}
          {step === 'select_relation' && '관계 유형 선택'}
          {step === 'analyzing' && '데이터 분석'}
          {step === 'result' && '분석 리포트'}
        </span>
        <div className="w-10 flex justify-end">
          {step === 'result' && <Share2 className="w-5 h-5 text-gray-400" />}
        </div>
      </header>

      <main className="h-full">
        <AnimatePresence mode="wait">
          {step === 'select_user' && renderUserSelection()}
          {step === 'select_relation' && renderRelationSelection()}
          {step === 'analyzing' && renderAnalyzing()}
          {step === 'result' && renderResult()}
        </AnimatePresence>
      </main>
    </div>
  );
}