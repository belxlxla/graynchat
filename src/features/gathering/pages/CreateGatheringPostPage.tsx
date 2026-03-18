import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Camera, X, HelpCircle, Info, Smile, Heart, MessageCircle,
  MapPin, BarChart2, EyeOff, Eye, Plus, Trash2, AlertTriangle, Check,
  Navigation, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

// ── 카테고리별 설정 (기존 코드 유지) ──────────────────────────
const CATEGORY_CONFIG: Record<string, {
  icon: any;
  label: string;
  placeholderTitle: string;
  placeholderContent: string;
  guide: string;
  color: string;
}> = {
  '일상': {
    icon: Smile,
    label: '일상',
    placeholderTitle: '오늘 어떤 일이 있었나요?',
    placeholderContent: '소소한 일상 이야기를 이웃들과 나누어보세요.',
    guide: '사진과 함께 올리면 공감을 더 많이 받아요!',
    color: '#FFD43B'
  },
  '질문': {
    icon: HelpCircle,
    label: '질문',
    placeholderTitle: '무엇이 궁금한가요?',
    placeholderContent: '궁금한 내용을 구체적으로 적어주세요.',
    guide: '자세히 질문할수록 정확한 답변을 받을 수 있어요.',
    color: '#FF6B6B'
  },
  '정보': {
    icon: Info,
    label: '정보',
    placeholderTitle: '공유하고 싶은 꿀팁이 있나요?',
    placeholderContent: '나만 알기 아까운 정보를 공유해주세요.',
    guide: '출처나 정확한 정보를 함께 적어주면 좋아요.',
    color: '#339AF0'
  },
  '유머': {
    icon: Smile,
    label: '유머',
    placeholderTitle: '재미있는 이야기를 들려주세요!',
    placeholderContent: '피식 웃음이 나오는 이야기나 짤을 공유해보세요.',
    guide: '센스 있는 제목은 필수!',
    color: '#FCC419'
  },
  '감동': {
    icon: Heart,
    label: '감동',
    placeholderTitle: '따뜻한 이야기를 전해주세요.',
    placeholderContent: '마음이 따뜻해지는 순간을 기록해보세요.',
    guide: '진심이 담긴 글은 모두에게 힘이 됩니다.',
    color: '#FF8787'
  },
  '고민': {
    icon: MessageCircle,
    label: '고민',
    placeholderTitle: '어떤 고민이 있으신가요?',
    placeholderContent: '혼자 끙끙 앓지 말고 털어놓아 보세요.',
    guide: '익명으로도 편하게 이야기할 수 있어요.',
    color: '#51CF66'
  }
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG);
const BUCKET_NAME = 'gathering-uploads';

// ── 유머 태그 옵션 ──────────────────────────────────────────
const HUMOR_TAGS = ['😂 빵터짐', '😏 몰래 피식', '🥲 공감 각', '🤣 인정', '😅 당황'];

// ── 감동 무드 옵션 ──────────────────────────────────────────
const MOOD_OPTIONS = [
  { emoji: '🥺', label: '찡하다' },
  { emoji: '😊', label: '따뜻해' },
  { emoji: '😢', label: '울컥함' },
  { emoji: '🙏', label: '감사함' },
  { emoji: '💪', label: '힘났어' },
];

export default function CreateGatheringPostPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── 기존 상태 (유지) ──────────────────────────────────────
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('일상');
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentConfig = CATEGORY_CONFIG[category];

  // ── 추가 상태 (카테고리별 인터랙티브) ─────────────────────
  // 질문 — 투표 옵션
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [hasPoll, setHasPoll] = useState(false);

  // 정보 — 장소 입력
  const [location, setLocation] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [hasLocation, setHasLocation] = useState(false);

  // 유머 — 웃음 태그
  const [humorTag, setHumorTag] = useState<string | null>(null);

  // 감동 — 무드 선택
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // 고민 — 익명 토글
  const [isAnonymous, setIsAnonymous] = useState(false);

  // 커뮤니티 가이드라인 동의
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);

  // ── 유효성 검사 ─────────────────────────────────────────
  const isPollValid = !hasPoll || pollOptions.filter(o => o.trim()).length >= 2;
  const isValid =
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    agreedToTerms &&
    isPollValid;

  // ── 기존 이미지 핸들러 (유지) ────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    const totalImages = images.length + newFiles.length;
    if (totalImages > 5) {
      toast.error('이미지는 최대 5장까지 첨부할 수 있어요.');
      return;
    }
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setImages(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    if (images.length === 0) return [];
    const uploadPromises = images.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
      const filePath = `posts/${user?.id}/${fileName}`;
      const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      return data.publicUrl;
    });
    return Promise.all(uploadPromises);
  };

  // ── 투표 옵션 핸들러 ─────────────────────────────────────
  const addPollOption = () => {
    if (pollOptions.length >= 4) return toast.error('투표 항목은 최대 4개까지 추가할 수 있어요.');
    setPollOptions(prev => [...prev, '']);
  };

  const removePollOption = (idx: number) => {
    if (pollOptions.length <= 2) return toast.error('투표 항목은 최소 2개가 필요해요.');
    setPollOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePollOption = (idx: number, val: string) => {
    setPollOptions(prev => prev.map((o, i) => i === idx ? val : o));
  };

  // ── 카테고리 변경 시 부가 상태 초기화 ────────────────────
  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setHasPoll(false);
    setPollOptions(['', '']);
    setHasLocation(false);
    setLocation('');
    setLocationDetail('');
    setHumorTag(null);
    setSelectedMood(null);
    setIsAnonymous(false);
  };

  // ── 제출 ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) return toast.error('로그인이 필요합니다.');
    if (!title.trim()) return toast.error('제목을 입력해주세요.');
    if (!content.trim()) return toast.error('내용을 입력해주세요.');
    if (!agreedToTerms) return toast.error('커뮤니티 가이드라인에 동의해주세요.');
    if (hasPoll && pollOptions.filter(o => o.trim()).length < 2) {
      return toast.error('투표 항목을 2개 이상 입력해주세요.');
    }

    setIsLoading(true);
    const toastId = toast.loading('게시글을 등록하고 있어요...');

    try {
      const imageUrls = await uploadImages();
      const { data: userData } = await supabase
        .from('users').select('name').eq('id', user.id).single();
      const { data: userProfile } = await supabase
        .from('user_profiles').select('avatar_url').eq('user_id', user.id).single();

      const insertData: Record<string, any> = {
        author_id: user.id,
        author_name: isAnonymous ? '익명' : (userData?.name || '사용자'),
        author_avatar: isAnonymous ? null : (userProfile?.avatar_url || null),
        title: title.trim(),
        content: content.trim(),
        category,
        image_urls: imageUrls,
      };

      // 카테고리별 추가 데이터
      if (category === '질문' && hasPoll) {
        insertData.poll_options = pollOptions.filter(o => o.trim());
      }
      if (category === '정보' && hasLocation && location.trim()) {
        insertData.location = location.trim();
        if (locationDetail.trim()) insertData.location_addr = locationDetail.trim();
      }
      if (category === '유머' && humorTag) {
        insertData.humor_tag = humorTag;
      }
      if (category === '감동' && selectedMood) {
        insertData.mood = selectedMood;
      }
      if (category === '고민') {
        insertData.is_anonymous = isAnonymous;
      }

      const { error } = await supabase.from('gathering_posts').insert(insertData);
      if (error) throw error;

      toast.success('게시글이 등록되었습니다!', { id: toastId });
      navigate(-1);
    } catch (err: any) {
      console.error(err);
      toast.error('등록에 실패했습니다. 잠시 후 다시 시도해주세요.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  // ── 카테고리별 인터랙티브 섹션 렌더 ─────────────────────
  const renderCategoryExtras = () => {
    switch (category) {

      // ── 질문: 투표 추가 ──────────────────────────────────
      case '질문':
        return (
          <div className="space-y-3">
            {/* 투표 토글 버튼 */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setHasPoll(prev => !prev)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
              style={{
                background: hasPoll ? 'rgba(255,32,58,0.08)' : 'rgba(255,255,255,0.04)',
                border: hasPoll
                  ? '1px solid rgba(255,32,58,0.25)'
                  : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: hasPoll ? 'rgba(255,32,58,0.12)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <BarChart2
                  className="w-[18px] h-[18px]"
                  style={{ color: hasPoll ? '#FF203A' : 'rgba(255,255,255,0.35)' }}
                />
              </div>
              <div className="flex-1 text-left">
                <p
                  className="text-[13px] font-medium"
                  style={{ color: hasPoll ? '#FF203A' : 'rgba(255,255,255,0.65)' }}
                >
                  투표 항목 추가하기
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  2~4개 항목으로 의견을 모아보세요
                </p>
              </div>
              {/* 토글 */}
              <div
                className="w-11 h-6 rounded-full transition-all relative shrink-0"
                style={{ background: hasPoll ? '#FF203A' : 'rgba(255,255,255,0.1)' }}
              >
                <motion.div
                  animate={{ x: hasPoll ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </div>
            </motion.button>

            {/* 투표 항목 입력 */}
            <AnimatePresence>
              {hasPoll && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {pollOptions.map((option, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-black"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {idx + 1}
                      </div>
                      <input
                        value={option}
                        onChange={e => updatePollOption(idx, e.target.value)}
                        maxLength={30}
                        placeholder={`항목 ${idx + 1}`}
                        className="flex-1 bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none placeholder-[#636366]"
                        style={{
                          color: 'rgba(255,255,255,0.85)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      />
                      {pollOptions.length > 2 && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removePollOption(idx)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: 'rgba(255,60,60,0.08)',
                            color: 'rgba(255,100,100,0.6)',
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                    </motion.div>
                  ))}

                  {pollOptions.length < 4 && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={addPollOption}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px]"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.3)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      항목 추가 ({pollOptions.length}/4)
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      // ── 정보: 장소 입력 ──────────────────────────────────
      case '정보':
        return (
          <div className="space-y-3">
            {/* 장소 토글 버튼 */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setHasLocation(prev => !prev)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
              style={{
                background: hasLocation ? 'rgba(51,154,240,0.08)' : 'rgba(255,255,255,0.04)',
                border: hasLocation
                  ? '1px solid rgba(51,154,240,0.3)'
                  : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: hasLocation ? 'rgba(51,154,240,0.12)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <MapPin
                  className="w-[18px] h-[18px]"
                  style={{ color: hasLocation ? '#339AF0' : 'rgba(255,255,255,0.35)' }}
                />
              </div>
              <div className="flex-1 text-left">
                <p
                  className="text-[13px] font-medium"
                  style={{ color: hasLocation ? '#339AF0' : 'rgba(255,255,255,0.65)' }}
                >
                  장소 정보 추가하기
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  가게, 명소, 주소 등을 입력해보세요
                </p>
              </div>
              <div
                className="w-11 h-6 rounded-full transition-all relative shrink-0"
                style={{ background: hasLocation ? '#339AF0' : 'rgba(255,255,255,0.1)' }}
              >
                <motion.div
                  animate={{ x: hasLocation ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </div>
            </motion.button>

            {/* 장소 상세 입력 */}
            <AnimatePresence>
              {hasLocation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <div
                    className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
                    style={{
                      background: '#1C1C1E',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <Navigation className="w-4 h-4 shrink-0" style={{ color: '#339AF0' }} />
                    <input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      maxLength={50}
                      placeholder="장소 이름 (예: 성수 카페거리, 광화문)"
                      className="flex-1 bg-transparent text-[13px] focus:outline-none placeholder-[#636366]"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    />
                  </div>
                  <div
                    className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
                    style={{
                      background: '#1C1C1E',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <MapPin
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'rgba(255,255,255,0.2)' }}
                    />
                    <input
                      value={locationDetail}
                      onChange={e => setLocationDetail(e.target.value)}
                      maxLength={80}
                      placeholder="상세 주소 또는 설명 (선택)"
                      className="flex-1 bg-transparent text-[13px] focus:outline-none placeholder-[#636366]"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      // ── 유머: 웃음 태그 선택 ──────────────────────────────
      case '유머':
        return (
          <div>
            <p
              className="text-[11px] font-medium mb-3"
              style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}
            >
              이 글의 웃음 포인트는?
            </p>
            <div className="flex gap-2 flex-wrap">
              {HUMOR_TAGS.map(tag => (
                <motion.button
                  key={tag}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setHumorTag(prev => prev === tag ? null : tag)}
                  className="px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
                  style={
                    humorTag === tag
                      ? {
                          background: 'rgba(252,196,25,0.15)',
                          border: '1px solid rgba(252,196,25,0.4)',
                          color: '#FCC419',
                        }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          color: 'rgba(255,255,255,0.4)',
                        }
                  }
                >
                  {tag}
                </motion.button>
              ))}
            </div>
          </div>
        );

      // ── 감동: 무드 선택 ───────────────────────────────────
      case '감동':
        return (
          <div>
            <p
              className="text-[11px] font-medium mb-3"
              style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}
            >
              이 글을 읽으면 어떤 기분이 드나요?
            </p>
            <div className="flex gap-2">
              {MOOD_OPTIONS.map(({ emoji, label }) => (
                <motion.button
                  key={label}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSelectedMood(prev => prev === label ? null : label)}
                  className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all"
                  style={
                    selectedMood === label
                      ? {
                          background: 'rgba(255,135,135,0.12)',
                          border: '1px solid rgba(255,135,135,0.35)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }
                  }
                >
                  <span className="text-xl">{emoji}</span>
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: selectedMood === label ? '#FF8787' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        );

      // ── 고민: 익명 토글 ───────────────────────────────────
      case '고민':
        return (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsAnonymous(prev => !prev)}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all"
            style={{
              background: isAnonymous ? 'rgba(81,207,102,0.07)' : 'rgba(255,255,255,0.04)',
              border: isAnonymous
                ? '1px solid rgba(81,207,102,0.25)'
                : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isAnonymous ? 'rgba(81,207,102,0.12)' : 'rgba(255,255,255,0.06)',
              }}
            >
              {isAnonymous
                ? <EyeOff className="w-[18px] h-[18px]" style={{ color: '#51CF66' }} />
                : <Eye className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.3)' }} />
              }
            </div>
            <div className="flex-1 text-left">
              <p
                className="text-[13px] font-medium"
                style={{ color: isAnonymous ? '#51CF66' : 'rgba(255,255,255,0.65)' }}
              >
                {isAnonymous ? '익명으로 올리기' : '이름으로 올리기'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {isAnonymous
                  ? '작성자 이름이 "익명"으로 표시돼요'
                  : '작성자 이름이 표시됩니다'}
              </p>
            </div>
            <div
              className="w-11 h-6 rounded-full transition-all relative shrink-0"
              style={{ background: isAnonymous ? '#51CF66' : 'rgba(255,255,255,0.1)' }}
            >
              <motion.div
                animate={{ x: isAnonymous ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
              />
            </div>
          </motion.button>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] text-white bg-[#080808]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* ── 헤더 (기존 유지) ────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0 bg-[#0d0d0d] border-b border-[#2C2C2E]">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-[#8E8E93] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="flex-1 text-[16px] font-semibold text-white/90">
          게더링 글쓰기
        </h1>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={isLoading || !isValid}
          className={`px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
            isValid
              ? 'bg-[#FF203A] text-white shadow-lg shadow-[#FF203A]/20'
              : 'bg-[#2C2C2E] text-[#636366]'
          }`}
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '완료'}
        </motion.button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* ── 카테고리 선택 (기존 유지) ─────────────────── */}
        <div className="pt-5 pb-2">
          <div className="px-5 mb-2">
            <span className="text-[11px] font-medium text-[#8E8E93] tracking-wide">주제 선택</span>
          </div>
          <div className="flex gap-2 px-5 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const isSelected = category === cat;
              return (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCategoryChange(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[13px] whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-[#FF203A]/10 border-[#FF203A] text-[#FF203A]'
                      : 'bg-[#1C1C1E] border-[#2C2C2E] text-[#8E8E93] hover:bg-[#2C2C2E]'
                  }`}
                >
                  <config.icon className="w-3.5 h-3.5" />
                  {cat}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="px-5 space-y-5">
          {/* ── 가이드 메시지 (기존 유지) ──────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={category}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-[#1C1C1E] rounded-2xl p-4 border border-[#2C2C2E] flex items-start gap-3"
            >
              <div className="p-2 rounded-full bg-[#2C2C2E]">
                {currentConfig.icon && <currentConfig.icon className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1">
                <p className="text-[13px] text-white font-medium mb-0.5">
                  {currentConfig.label} 글쓰기 Tip
                </p>
                <p className="text-[12px] text-[#8E8E93] leading-relaxed">
                  {currentConfig.guide}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ── 이미지 첨부 (기존 유지, 일상/유머/감동/정보만) ── */}
          {['일상', '유머', '감동', '정보'].includes(category) && (
            <div>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center bg-[#1C1C1E] border border-[#2C2C2E] text-[#8E8E93] hover:text-white hover:border-[#FF203A]/50 transition-colors shrink-0"
                >
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-medium">{images.length}/5</span>
                </motion.button>
                <AnimatePresence>
                  {previewUrls.map((url, idx) => (
                    <motion.div
                      key={url}
                      initial={{ opacity: 0, scale: 0.8, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[#2C2C2E]"
                    >
                      <img src={url} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/80 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
          )}

          {/* ── 제목 입력 (기존 유지) ──────────────────── */}
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              placeholder={currentConfig.placeholderTitle}
              className="w-full bg-transparent text-[18px] font-bold text-white placeholder-[#636366] focus:outline-none"
            />
            <div className="h-[1px] bg-[#2C2C2E] w-full" />
          </div>

          {/* ── 내용 입력 (기존 유지) ──────────────────── */}
          <div className="relative pb-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              placeholder={currentConfig.placeholderContent}
              className="w-full bg-transparent text-[15px] leading-relaxed text-white/90 placeholder-[#636366] focus:outline-none resize-none min-h-[200px]"
            />
            <div className="absolute bottom-0 right-0 text-[11px] text-[#636366] font-medium bg-[#080808] pl-2">
              {content.length} / 2000
            </div>
          </div>

          {/* ── 카테고리별 인터랙티브 섹션 (추가) ────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`extras-${category}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderCategoryExtras()}
            </motion.div>
          </AnimatePresence>

          {/* ── 커뮤니티 가이드라인 동의 (추가) ──────────── */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl overflow-hidden"
            style={{
              border: agreedToTerms
                ? '1px solid rgba(255,32,58,0.2)'
                : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* 헤더 — 동의 체크 + 펼치기 */}
            <div
              className="flex items-center gap-3 px-4 py-3.5"
              style={{
                background: agreedToTerms
                  ? 'rgba(255,32,58,0.05)'
                  : 'rgba(255,255,255,0.03)',
              }}
            >
              {/* 체크박스 */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setAgreedToTerms(prev => !prev)}
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all"
                style={{
                  background: agreedToTerms ? '#FF203A' : 'rgba(255,255,255,0.07)',
                  border: agreedToTerms ? 'none' : '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <AnimatePresence>
                  {agreedToTerms && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="w-3.5 h-3.5 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-medium"
                  style={{
                    color: agreedToTerms
                      ? 'rgba(255,255,255,0.8)'
                      : 'rgba(255,255,255,0.5)',
                  }}
                >
                  커뮤니티 가이드라인에 동의합니다
                </p>
                {!agreedToTerms && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    내용 확인 후 동의해야 게시할 수 있어요
                  </p>
                )}
              </div>

              {/* 펼치기 버튼 */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setTermsExpanded(prev => !prev)}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                {termsExpanded
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />
                }
              </motion.button>
            </div>

            {/* 가이드라인 상세 내용 — 펼침 */}
            <AnimatePresence>
              {termsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div
                    className="px-4 pt-3 pb-4 space-y-3"
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      background: 'rgba(0,0,0,0.25)',
                    }}
                  >
                    {/* 경고 배너 */}
                    <div
                      className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl"
                      style={{
                        background: 'rgba(255,32,58,0.07)',
                        border: '1px solid rgba(255,32,58,0.15)',
                      }}
                    >
                      <AlertTriangle
                        className="w-4 h-4 shrink-0 mt-0.5"
                        style={{ color: '#FF203A' }}
                      />
                      <p
                        className="text-[12px] leading-relaxed font-medium"
                        style={{ color: 'rgba(255,100,100,0.85)' }}
                      >
                        아래 내용을 위반한 게시글은{' '}
                        <span className="font-bold">즉시 삭제</span>되며,
                        작성자 계정은{' '}
                        <span className="font-bold">영구 차단</span>될 수 있어요.
                      </p>
                    </div>

                    {/* 가이드라인 항목 */}
                    {[
                      {
                        emoji: '🔞',
                        title: '불건전·성희롱성 콘텐츠 금지',
                        desc: '성적 수치심을 유발하거나 음란물에 해당하는 게시글은 즉시 삭제됩니다.',
                      },
                      {
                        emoji: '🚫',
                        title: '스팸·광고·도배 금지',
                        desc: '반복적인 홍보글, 외부 링크 유도, 동일 내용 도배는 허용되지 않아요.',
                      },
                      {
                        emoji: '🤝',
                        title: '타인 존중',
                        desc: '욕설, 혐오 발언, 특정인 비방, 개인정보 노출은 즉각 제재됩니다.',
                      },
                      {
                        emoji: '✅',
                        title: '사실에 기반한 정보 공유',
                        desc: '허위 정보, 가짜 뉴스 유포는 커뮤니티의 신뢰를 해칩니다.',
                      },
                    ].map(({ emoji, title, desc }) => (
                      <div key={title} className="flex items-start gap-3">
                        <span className="text-[16px] shrink-0 mt-0.5">{emoji}</span>
                        <div>
                          <p
                            className="text-[12px] font-semibold mb-0.5"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                          >
                            {title}
                          </p>
                          <p
                            className="text-[11px] leading-relaxed"
                            style={{ color: 'rgba(255,255,255,0.3)' }}
                          >
                            {desc}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* 동의 버튼 */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setAgreedToTerms(true);
                        setTermsExpanded(false);
                      }}
                      className="w-full py-3 rounded-xl text-[13px] font-semibold mt-1 transition-all"
                      style={
                        agreedToTerms
                          ? {
                              background: 'rgba(255,32,58,0.12)',
                              color: '#FF203A',
                              border: '1px solid rgba(255,32,58,0.2)',
                            }
                          : { background: '#FF203A', color: 'white' }
                      }
                    >
                      {agreedToTerms ? '✓ 이미 동의하셨습니다' : '확인하고 동의하기'}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 하단 여백 */}
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}