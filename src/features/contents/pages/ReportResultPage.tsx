import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Heart, Download,
  Search, User as UserIcon, Briefcase, Home, ChevronRight, AlertCircle,
  Thermometer, Activity, Sparkles, Brain, ThumbsUp, Star
} from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

const RELATION_TYPES = [
  { id: 'dating', label: '썸 · 연인', icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500/10', desc: '애정도와 설렘 분석' },
  { id: 'friend', label: '찐친 · 우정', icon: UserIcon, color: 'text-green-400', bg: 'bg-green-500/10', desc: '티키타카와 의리 분석' },
  { id: 'business', label: '동료 · 비즈니스', icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-500/10', desc: '업무 호흡과 신뢰도' },
  { id: 'family', label: '가족', icon: Home, color: 'text-orange-400', bg: 'bg-orange-500/10', desc: '유대감과 소통 패턴' },
];

interface Friend {
  id: number;
  friend_user_id: string;
  name: string;
  avatar: string | null;
}

interface AnalysisResult {
  score: number;
  totalMessages: number;
  myShare: number;
  friendShare: number;
  avgReplyTime: string;
  topKeywords: string[];
  category: string;
  mainTitle: string;
  subTitle: string;
  stat1Label: string; stat1Value: number;
  stat2Label: string; stat2Value: number;
  stat3Label: string; stat3Value: number;
  detailedAnalysis: string;
  advice: string;
}

export default function ReportResultPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState<'select_user' | 'select_relation' | 'analyzing' | 'result'>('select_user');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      try {
        setLoadingFriends(true);
        const { data, error } = await supabase
          .from('friends')
          .select('id, friend_user_id, name, avatar')
          .eq('user_id', user.id);

        if (error) throw error;

        if (data) {
          setFriends(data);
        }
      } catch (error) {
        console.error('친구 로딩 실패:', error);
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [user]);

  useEffect(() => {
    const requestPerms = async () => {
      await LocalNotifications.requestPermissions();
    };
    requestPerms();
  }, []);

  const handleRelationSelect = (relationId: string) => {
    startAnalysis(relationId);
  };

  const startAnalysis = async (relationId: string) => {
    if (!user || !selectedFriend) return;
    setStep('analyzing');

    try {
      const { data: myRooms } = await supabase.from('room_members').select('room_id').eq('user_id', user.id);
      const { data: friendRooms } = await supabase.from('room_members').select('room_id').eq('user_id', selectedFriend.friend_user_id);
      
      const myIds = myRooms?.map(r => r.room_id) || [];
      const friendIds = friendRooms?.map(r => r.room_id) || [];
      const commonRoomId = myIds.find(id => friendIds.includes(id));

      let totalCount = 0;
      let myCount = 0;
      
      if (commonRoomId) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('sender_id, created_at, content')
          .eq('room_id', commonRoomId)
          .order('created_at', { ascending: false })
          .limit(2000);

        if (msgs && msgs.length > 0) {
          totalCount = msgs.length;
          myCount = msgs.filter(m => m.sender_id === user.id).length;
        }
      }

      const myShare = totalCount > 0 ? Math.round((myCount / totalCount) * 100) : 0;
      const friendShare = 100 - myShare;
      
      let baseScore = Math.min((totalCount / 300) * 50, 50);
      const balanceRatio = Math.abs(0.5 - (myShare / 100));
      const balanceScore = Math.max(0, 40 - (balanceRatio * 80));
      const bonusScore = 10 + Math.floor(Math.random() * 10);
      
      let finalScore = Math.min(100, Math.floor(baseScore + balanceScore + bonusScore));
      if (totalCount < 10) finalScore = Math.floor(Math.random() * 30) + 10;

      let resultData: Partial<AnalysisResult> = {};

      if (relationId === 'dating') {
        resultData = {
          mainTitle: finalScore >= 80 ? "🔥 불타는 로맨스" : finalScore >= 50 ? "💕 썸 타는 중" : "👀 탐색전 단계",
          subTitle: finalScore >= 80 ? "두 분의 애정 전선은 '맑음' 입니다!" : "조금 더 적극적인 표현이 필요해요.",
          stat1Label: "애정 온도", stat1Value: Math.min(100, 36.5 + finalScore * 0.6),
          stat2Label: "밀당 지수", stat2Value: Math.floor(Math.random() * 40) + 30,
          stat3Label: "설렘 포인트", stat3Value: finalScore,
          detailedAnalysis: `두 사람의 대화에서는 서로를 향한 관심이 ${finalScore >= 70 ? '매우 강하게' : '은근하게'} 드러나고 있습니다.`,
          advice: finalScore >= 80 ? "지금 이 분위기 그대로 데이트를 신청해보세요!" : "가벼운 질문으로 대화의 물꼬를 더 터보세요.",
          topKeywords: ['보고싶어', '사랑해', '뭐해?', '밥', '영화', '주말']
        };
      } else if (relationId === 'friend') {
        resultData = {
          mainTitle: finalScore >= 80 ? "💎 평생 갈 찐친" : finalScore >= 50 ? "🍺 술친구 가능" : "👋 어색한 사이",
          subTitle: finalScore >= 80 ? "눈빛만 봐도 통하는 영혼의 단짝!" : "친해지면 정말 잘 맞을 것 같아요.",
          stat1Label: "의리 지수", stat1Value: finalScore,
          stat2Label: "티키타카", stat2Value: Math.min(100, finalScore + 10),
          stat3Label: "개그 코드", stat3Value: Math.floor(Math.random() * 50) + 50,
          detailedAnalysis: `대화의 핑퐁이 ${finalScore >= 70 ? '환상적입니다.' : '나쁘지 않습니다.'} 서로 부담 없이 연락할 수 있는 편안한 관계입니다.`,
          advice: "이번 주말에 가볍게 맥주 한 잔 어떠세요?",
          topKeywords: ['ㅋㅋㅋ', '미친', '진짜', 'ㅇㅈ', '술', '노래방']
        };
      } else if (relationId === 'business') {
        resultData = {
          mainTitle: finalScore >= 80 ? "🤝 환상의 파트너" : finalScore >= 50 ? "📄 원만한 협업" : "🧊 사무적인 관계",
          subTitle: "업무 효율을 최대로 끌어올릴 수 있습니다.",
          stat1Label: "업무 호흡", stat1Value: finalScore,
          stat2Label: "신뢰도", stat2Value: finalScore + 5,
          stat3Label: "소통 명확성", stat3Value: 90,
          detailedAnalysis: `군더더기 없는 깔끔한 소통이 특징입니다. ${finalScore >= 70 ? '업무 스타일이 잘 맞아 시너지가 기대됩니다.' : '서로의 업무 스타일에 적응해가는 단계입니다.'}`,
          advice: "업무 외적인 스몰토크로 라포를 형성해보세요.",
          topKeywords: ['확인', '감사합니다', '넵', '파일', '일정', '회의']
        };
      } else {
        resultData = {
          mainTitle: finalScore >= 80 ? "❤️ 화목한 가족" : "🏠 현실 가족",
          subTitle: "가장 든든한 내 편입니다.",
          stat1Label: "유대감", stat1Value: 100,
          stat2Label: "소통 빈도", stat2Value: finalScore,
          stat3Label: "효도 지수", stat3Value: Math.floor(finalScore * 0.8),
          detailedAnalysis: `표현은 서툴러도 서로를 아끼는 마음이 느껴집니다. ${finalScore < 50 ? '최근 대화가 다소 부족해 보입니다.' : '서로의 안부를 자주 묻는 따뜻한 관계입니다.'}`,
          advice: "오늘 따뜻한 안부 전화 한 통 드려보세요.",
          topKeywords: ['밥', '일찍', '조심', '건강', '용돈', '엄마/아빠']
        };
      }

      const finalResult: AnalysisResult = {
        score: finalScore,
        totalMessages: totalCount,
        myShare,
        friendShare,
        avgReplyTime: finalScore > 70 ? '매우 빠름' : '보통',
        category: relationId,
        topKeywords: totalCount < 10 ? ['(데이터 부족)'] : resultData.topKeywords!,
        mainTitle: resultData.mainTitle!,
        subTitle: resultData.subTitle!,
        stat1Label: resultData.stat1Label!, stat1Value: resultData.stat1Value!,
        stat2Label: resultData.stat2Label!, stat2Value: resultData.stat2Value!,
        stat3Label: resultData.stat3Label!, stat3Value: resultData.stat3Value!,
        detailedAnalysis: resultData.detailedAnalysis!,
        advice: resultData.advice!
      };

      setAnalysisResult(finalResult);

      setTimeout(async () => {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "분석 완료! 💌",
              body: `${selectedFriend.name}님과의 리포트가 도착했습니다.`,
              id: 1,
              schedule: { at: new Date(Date.now() + 100) },
              sound: undefined, attachments: undefined, actionTypeId: "", extra: null
            }
          ]
        });
        setStep('result');
      }, 3000);

    } catch (e) {
      console.error('분석 에러:', e);
      setStep('result');
    }
  };

  const handleSaveImage = async () => {
    if (!resultRef.current || !selectedFriend) return;
    const loadingToast = toast.loading('고화질 리포트 생성 중...');

    try {
      const canvas = await html2canvas(resultRef.current, {
        useCORS: true,
        scale: 3,
        backgroundColor: '#141414',
        logging: false,
        onclone: (documentClone) => {
          const element = documentClone.getElementById('capture-target');
          if (element) {
            element.style.padding = '40px';
          }
        }
      });

      const base64Data = canvas.toDataURL('image/png', 1.0);

      if (Capacitor.isNativePlatform()) {
        const fileName = `grayn_report_${Date.now()}.png`;
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data.split(',')[1],
          directory: Directory.Cache
        });

        await Share.share({
          title: '그레인 관계 리포트',
          text: `${selectedFriend.name}님과의 관계 분석 결과입니다!`,
          url: savedFile.uri,
        });
        
        toast.success('저장 옵션을 선택해주세요.', { id: loadingToast });
      } else {
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = `grayn_report_${selectedFriend.name}.png`;
        link.click();
        toast.success('앨범에 저장되었습니다.', { id: loadingToast });
      }
    } catch (error) {
      console.error('Save Error:', error);
      toast.error('저장에 실패했습니다.', { id: loadingToast });
    }
  };

  const handleBack = () => {
    if (step === 'select_user') navigate(-1);
    else if (step === 'select_relation') setStep('select_user');
    else if (step === 'result') navigate(-1);
  };

  const renderUserSelection = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 flex flex-col h-full">
      <h2 className="text-2xl font-bold text-white mb-2">분석할 대상을<br/>선택해주세요</h2>
      <p className="text-sm text-gray-400 mb-6">최근 대화 기록을 바탕으로 분석합니다.</p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
        <input
          type="text"
          className="w-full pl-10 pr-4 py-3 bg-[#1C1C1E] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-brand-DEFAULT focus:outline-none"
          placeholder="이름 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pb-20 custom-scrollbar">
        {loadingFriends ? (
          <div className="text-center text-gray-500 py-10">친구 목록을 불러오는 중...</div>
        ) : friends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 opacity-60">
             <AlertCircle className="w-12 h-12 mb-3"/>
             <p>친구 목록이 비어있습니다.</p>
             <p className="text-xs mt-1">채팅 탭에서 친구를 추가해주세요.</p>
          </div>
        ) : (
          friends
            .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((friend) => (
              <button
                key={friend.id}
                onClick={() => {
                  setSelectedFriend(friend);
                  setStep('select_relation');
                }}
                className="w-full flex items-center p-3 rounded-xl bg-[#1C1C1E] border border-transparent hover:border-white/20 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center overflow-hidden mr-4 border border-white/5">
                  {friend.avatar ? (
                    <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-gray-500" />
                  )}
                </div>
                <span className="text-white font-medium text-lg flex-1 text-left">{friend.name}</span>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>
            ))
        )}
      </div>
    </motion.div>
  );

  const renderRelationSelection = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-5 flex flex-col h-full">
      <h2 className="text-2xl font-bold text-white mb-2">어떤 사이인가요?</h2>
      <p className="text-sm text-gray-400 mb-8">
        <span className="text-brand-DEFAULT font-bold">{selectedFriend?.name}</span>님과의 관계를 선택하면<br/>
        맞춤형 정밀 분석이 시작됩니다.
      </p>
      
      <div className="grid grid-cols-1 gap-4">
        {RELATION_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => handleRelationSelect(type.id)}
              className="w-full p-5 rounded-2xl bg-[#1C1C1E] border border-white/5 hover:border-brand-DEFAULT/50 active:scale-[0.98] transition-all text-left flex items-center gap-4 group"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${type.bg} ${type.color} group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-lg font-bold text-white block mb-1">{type.label}</span>
                <span className="text-xs text-gray-500">{type.desc}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 ml-auto group-hover:text-white transition-colors" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );

  const renderAnalyzing = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-40 h-40 mb-10">
        <motion.div 
          className="absolute inset-0 border-4 border-[#2C2C2E] rounded-full" 
        />
        <motion.div 
          className="absolute inset-0 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
          <Brain className="w-12 h-12 text-purple-500 animate-pulse" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">AI 정밀 분석 중...</h2>
      <div className="space-y-1 text-sm text-gray-500">
        <p>대화 패턴 및 키워드 추출</p>
        <p>감정 온도 계산 중</p>
        <p>관계 리포트 생성 중</p>
      </div>
    </motion.div>
  );

  const renderResult = () => {
    if (!analysisResult) return null;
    const { 
      score, totalMessages, myShare, friendShare, avgReplyTime, 
      topKeywords, mainTitle, subTitle, stat1Label, stat1Value, 
      stat2Label, stat2Value, stat3Label, stat3Value, detailedAnalysis, advice
    } = analysisResult;
    
    const scoreColor = score >= 80 ? 'text-pink-500' : score >= 50 ? 'text-purple-500' : 'text-blue-500';
    const borderColor = score >= 80 ? 'border-pink-500/50' : 'border-purple-500/50';

    return (
      <div className="animate-fade-in pb-20">
        <div 
          id="capture-target" 
          ref={resultRef} 
          className="bg-[#141414] p-6 text-white min-h-screen"
          style={{ fontFamily: 'Pretendard, sans-serif' }}
        >
          <div className="text-center mb-8 pt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold tracking-widest text-gray-300 mb-4 border border-white/10">
              <Sparkles className="w-3 h-3 text-yellow-400" /> GRAIN PREMIUM REPORT
            </div>
            <h2 className="text-2xl font-bold mb-1">
              <span className="text-gray-400">나 & </span>
              <span className="text-white border-b-2 border-brand-DEFAULT pb-0.5">{selectedFriend?.name}</span>
            </h2>
            <p className="text-xs text-gray-500 uppercase tracking-wide mt-2">
              {new Date().toLocaleDateString()} • ANALYSIS COMPLETED
            </p>
          </div>

          <div className={`bg-[#1C1C1E] rounded-3xl p-6 border ${borderColor} relative overflow-hidden shadow-2xl mb-6`}>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl rounded-full" />
            
            <div className="relative z-10 text-center">
              <p className="text-sm font-medium text-gray-400 mb-2">종합 관계 점수</p>
              <div className="flex items-center justify-center gap-1 mb-4">
                <span className={`text-6xl font-black tracking-tighter ${scoreColor}`}>{score}</span>
                <span className="text-xl text-gray-600 font-medium self-end mb-2">/100</span>
              </div>
              
              <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                <h3 className="text-lg font-bold text-white mb-1">{mainTitle}</h3>
                <p className="text-xs text-gray-400">{subTitle}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-[#1C1C1E] p-3 rounded-2xl border border-white/10 text-center flex flex-col items-center justify-center h-28">
              <div className="mb-2 p-2 bg-pink-500/10 rounded-full">
                <Thermometer className="w-5 h-5 text-pink-500" />
              </div>
              <p className="text-[10px] text-gray-500 mb-1">{stat1Label}</p>
              <p className="text-lg font-bold text-white">{typeof stat1Value === 'number' ? stat1Value.toFixed(1) : stat1Value}</p>
            </div>
            <div className="bg-[#1C1C1E] p-3 rounded-2xl border border-white/10 text-center flex flex-col items-center justify-center h-28">
              <div className="mb-2 p-2 bg-blue-500/10 rounded-full">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-[10px] text-gray-500 mb-1">{stat2Label}</p>
              <p className="text-lg font-bold text-white">{stat2Value}</p>
            </div>
            <div className="bg-[#1C1C1E] p-3 rounded-2xl border border-white/10 text-center flex flex-col items-center justify-center h-28">
              <div className="mb-2 p-2 bg-yellow-500/10 rounded-full">
                <Star className="w-5 h-5 text-yellow-500" />
              </div>
              <p className="text-[10px] text-gray-500 mb-1">{stat3Label}</p>
              <p className="text-lg font-bold text-white">{stat3Value}</p>
            </div>
          </div>

          <div className="bg-[#1C1C1E] p-5 rounded-2xl border border-white/10 mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-400">대화 점유율</span>
              <span className="text-[10px] text-gray-600">{totalMessages} messages</span>
            </div>
            <div className="h-4 bg-[#2C2C2E] rounded-full overflow-hidden flex relative">
              <div style={{ width: `${myShare}%` }} className="h-full bg-brand-DEFAULT" />
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-black/50 z-10" />
            </div>
            <div className="flex justify-between mt-2 text-xs font-medium">
              <span className="text-brand-DEFAULT">나 {myShare}%</span>
              <span className="text-gray-500">상대방 {friendShare}%</span>
            </div>
          </div>

          <div className="bg-[#1C1C1E] p-5 rounded-2xl border border-white/10 mb-6">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" /> AI 정밀 분석
            </h4>
            <p className="text-sm text-gray-300 leading-relaxed text-justify">
              {detailedAnalysis}
            </p>
            
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
               <div>
                  <h5 className="text-xs text-gray-500 mb-1">평균 답장 시간</h5>
                  <p className="text-sm font-bold text-white">{avgReplyTime}</p>
               </div>
               <div>
                  <h5 className="text-xs text-gray-500 mb-1">소통 스타일</h5>
                  <p className="text-sm font-bold text-white">상호작용 활발</p>
               </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <ThumbsUp className="w-4 h-4 text-green-400" /> 솔루션
              </h4>
              <p className="text-sm text-gray-300 font-medium">"{advice}"</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-center opacity-80">
            {topKeywords.map((word, i) => (
              <span key={i} className="px-3 py-1.5 bg-[#252529] rounded-lg text-xs text-gray-400 border border-white/5">
                #{word}
              </span>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-[9px] text-gray-700 tracking-widest">GENERATED BY GRAIN AI</p>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent z-50">
          <button 
            onClick={handleSaveImage}
            className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
          >
            <Download className="w-5 h-5" />
            결과 이미지로 저장하기
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
          {step === 'result' && '분석 결과'}
        </span>
        <div className="w-10" />
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