import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Camera, X, Image as ImageIcon, HelpCircle, Info, Smile, Heart, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

// 카테고리별 설정 (작성 페이지와 동일하게 유지)
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

export default function EditGatheringPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('일상');
  // 기존 이미지 URL과 새로 추가된 파일 객체를 구분해서 관리
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]); 
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['일상'];

  const isValid = title.trim().length > 0 && content.trim().length > 0;

  // 초기 데이터 로드
  useEffect(() => {
    if (!postId || !user) return;
    const loadPost = async () => {
      try {
        const { data, error } = await supabase
          .from('gathering_posts')
          .select('*')
          .eq('id', postId)
          .single();

        if (error) throw error;
        if (data.author_id !== user.id) {
          toast.error('수정 권한이 없습니다.');
          navigate(-1);
          return;
        }

        setTitle(data.title);
        setContent(data.content);
        setCategory(data.category);
        setExistingImages(data.image_urls || []);
      } catch (err) {
        console.error(err);
        toast.error('게시글을 불러올 수 없습니다.');
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };
    loadPost();
  }, [postId, user, navigate]);

  // 이미지 선택
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const totalCount = existingImages.length + newImages.length + newFiles.length;

    if (totalCount > 5) {
      toast.error('이미지는 최대 5장까지 첨부할 수 있어요.');
      return;
    }

    const previews = newFiles.map(file => URL.createObjectURL(file));
    setNewImages(prev => [...prev, ...newFiles]);
    setNewPreviews(prev => [...prev, ...previews]);
  };

  // 기존 이미지 삭제
  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  // 새 이미지 삭제
  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
    setNewPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // 이미지 업로드
  const uploadNewImages = async (): Promise<string[]> => {
    if (newImages.length === 0) return [];

    const uploadPromises = newImages.map(async (file) => {
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

  const handleUpdate = async () => {
    if (!user || !postId) return;
    setIsSaving(true);
    const toastId = toast.loading('수정 내용을 저장하고 있어요...');

    try {
      // 1. 새 이미지 업로드
      const newImageUrls = await uploadNewImages();
      
      // 2. 최종 이미지 배열 (기존 유지분 + 새로 올린 것)
      const finalImages = [...existingImages, ...newImageUrls];

      // 3. DB 업데이트
      const { error } = await supabase
        .from('gathering_posts')
        .update({
          title: title.trim(),
          content: content.trim(),
          category,
          image_urls: finalImages,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (error) throw error;

      toast.success('게시글이 수정되었습니다!', { id: toastId });
      navigate(-1); // 상세 페이지로 복귀
    } catch (err) {
      console.error(err);
      toast.error('수정에 실패했습니다.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="h-screen bg-[#080808] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>;

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
          게시글 수정
        </h1>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleUpdate}
          disabled={isSaving || !isValid}
          className={`px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
            isValid 
              ? 'bg-[#FF203A] text-white shadow-lg shadow-[#FF203A]/20' 
              : 'bg-[#2C2C2E] text-[#636366]'
          }`}
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '완료'}
        </motion.button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 카테고리 선택 */}
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
          {/* 가이드 메시지 */}
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
                <span className="text-[10px] font-medium">{existingImages.length + newImages.length}/5</span>
              </motion.button>

              {/* 기존 이미지 */}
              <AnimatePresence>
                {existingImages.map((url, idx) => (
                  <motion.div
                    key={`existing-${url}`}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[#2C2C2E]"
                  >
                    <img src={url} alt="existing" className="w-full h-full object-cover" />
                    <button onClick={() => removeExistingImage(idx)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80">
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
                {/* 새 이미지 미리보기 */}
                {newPreviews.map((url, idx) => (
                  <motion.div
                    key={`new-${url}`}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[#2C2C2E]"
                  >
                    <img src={url} alt="new" className="w-full h-full object-cover" />
                    <button onClick={() => removeNewImage(idx)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80">
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <input type="file" ref={fileInputRef} multiple accept="image/*" className="hidden" onChange={handleImageSelect} />
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