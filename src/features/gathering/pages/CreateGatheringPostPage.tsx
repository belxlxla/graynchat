import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Camera, X, Image as ImageIcon, HelpCircle, Info, Smile, Heart, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

// 카테고리별 설정 (아이콘, 힌트, 플레이스홀더)
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
    color: '#FFD43B' // Yellow
  },
  '질문': {
    icon: HelpCircle,
    label: '질문',
    placeholderTitle: '무엇이 궁금한가요?',
    placeholderContent: '궁금한 내용을 구체적으로 적어주세요.',
    guide: '자세히 질문할수록 정확한 답변을 받을 수 있어요.',
    color: '#FF6B6B' // Red
  },
  '정보': {
    icon: Info,
    label: '정보',
    placeholderTitle: '공유하고 싶은 꿀팁이 있나요?',
    placeholderContent: '나만 알기 아까운 정보를 공유해주세요.',
    guide: '출처나 정확한 정보를 함께 적어주면 좋아요.',
    color: '#339AF0' // Blue
  },
  '유머': {
    icon: Smile,
    label: '유머',
    placeholderTitle: '재미있는 이야기를 들려주세요!',
    placeholderContent: '피식 웃음이 나오는 이야기나 짤을 공유해보세요.',
    guide: '센스 있는 제목은 필수!',
    color: '#FCC419' // Orange
  },
  '감동': {
    icon: Heart,
    label: '감동',
    placeholderTitle: '따뜻한 이야기를 전해주세요.',
    placeholderContent: '마음이 따뜻해지는 순간을 기록해보세요.',
    guide: '진심이 담긴 글은 모두에게 힘이 됩니다.',
    color: '#FF8787' // Pink
  },
  '고민': {
    icon: MessageCircle,
    label: '고민',
    placeholderTitle: '어떤 고민이 있으신가요?',
    placeholderContent: '혼자 끙끙 앓지 말고 털어놓아 보세요.',
    guide: '익명으로도 편하게 이야기할 수 있어요.',
    color: '#51CF66' // Teal
  }
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG);
const BUCKET_NAME = 'gathering-uploads'; // 이미 생성된 버킷 사용

export default function CreateGatheringPostPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('일상');
  const [images, setImages] = useState<File[]>([]); // 업로드할 파일 객체들
  const [previewUrls, setPreviewUrls] = useState<string[]>([]); // 미리보기 URL들
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 현재 선택된 카테고리의 설정
  const currentConfig = CATEGORY_CONFIG[category];

  const isValid = title.trim().length > 0 && content.trim().length > 0;

  // 이미지 선택 핸들러
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

  // 이미지 삭제 핸들러
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      // 메모리 누수 방지를 위해 URL revoke
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // 이미지 업로드 함수 (Supabase Storage)
  const uploadImages = async (): Promise<string[]> => {
    if (images.length === 0) return [];

    const uploadPromises = images.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
      const filePath = `posts/${user?.id}/${fileName}`;

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      return data.publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async () => {
    if (!user) return toast.error('로그인이 필요합니다.');
    if (!title.trim()) return toast.error('제목을 입력해주세요.');
    if (!content.trim()) return toast.error('내용을 입력해주세요.');

    setIsLoading(true);
    const toastId = toast.loading('게시글을 등록하고 있어요...');

    try {
      // 1. 이미지 업로드
      const imageUrls = await uploadImages();

      // 2. 사용자 정보 가져오기
      const { data: userData } = await supabase.from('users').select('name, avatar').eq('id', user.id).single();

      // 3. 게시글 DB 저장
      const { error } = await supabase.from('gathering_posts').insert({
        author_id: user.id,
        author_name: userData?.name || '사용자',
        author_avatar: userData?.avatar || null,
        title: title.trim(),
        content: content.trim(),
        category,
        image_urls: imageUrls, // 이미지 URL 배열 저장 (스키마에 맞춰짐)
      });

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

  return (
    <div className="flex flex-col h-[100dvh] text-white bg-[#080808]">
      {/* 헤더 */}
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
        {/* 카테고리 선택 영역 (가로 스크롤) */}
        <div className="pt-5 pb-2">
          <div className="px-5 mb-2">
            <span className="text-[11px] font-medium text-[#8E8E93] tracking-wide">주제 선택</span>
          </div>
          <div className="flex gap-2 px-5 overflow-x-auto pb-3 custom-scrollbar">
            {CATEGORIES.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const isSelected = category === cat;
              return (
                <motion.button 
                  key={cat} 
                  whileTap={{ scale: 0.95 }} 
                  onClick={() => setCategory(cat)}
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

        <div className="px-5 space-y-6">
          {/* 가이드 메시지 (인터랙티브 요소) */}
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
                <p className="text-[13px] text-white font-medium mb-0.5">{currentConfig.label} 글쓰기 Tip</p>
                <p className="text-[12px] text-[#8E8E93] leading-relaxed">
                  {currentConfig.guide}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* 이미지 첨부 영역 */}
          <div>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
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

          {/* 제목 입력 */}
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

          {/* 내용 입력 */}
          <div className="relative pb-10">
            <textarea
              value={content} 
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000} 
              placeholder={currentConfig.placeholderContent} 
              className="w-full bg-transparent text-[15px] leading-relaxed text-white/90 placeholder-[#636366] focus:outline-none resize-none min-h-[300px]"
            />
            <div className="absolute bottom-0 right-0 text-[11px] text-[#636366] font-medium bg-[#080808] pl-2">
              {content.length} / 2000
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}