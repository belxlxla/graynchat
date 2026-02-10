import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal,
  Send, Loader2, User as UserIcon, Trash2, AlertCircle, Eye, Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface PostDetail {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  content: string;
  category: string;
  image_urls: string[];
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
}

interface Comment {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
}

const getTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
};

export default function GatheringPostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  
  // 모달 상태 관리
  const [showMenu, setShowMenu] = useState(false);
  const [showDeletePostModal, setShowDeletePostModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!postId || !user) return;
    const loadData = async () => {
      try {
        try { await supabase.rpc('increment_view', { post_id_input: postId }); } catch {}
        
        const { data: postData } = await supabase.from('gathering_posts').select('*').eq('id', postId).single();
        if (postData) setPost(postData);

        const { data: likeData } = await supabase.from('gathering_post_likes').select('id')
          .eq('post_id', postId).eq('user_id', user.id).maybeSingle();
        setIsLiked(!!likeData);

        const { data: commentData } = await supabase.from('gathering_comments').select('*')
          .eq('post_id', postId).order('created_at', { ascending: true });
        setComments(commentData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [postId, user]);

  const handleShare = async () => {
    if (!post) return;
    const shareData = {
      title: post.title,
      text: post.content.substring(0, 50) + '...',
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('링크가 복사되었습니다!');
      } catch { toast.error('공유하기를 사용할 수 없습니다.'); }
    }
  };

  const handleToggleLike = async () => {
    if (!post || !user) return;
    const prevIsLiked = isLiked;
    setIsLiked(!prevIsLiked);
    setPost(prev => prev ? { ...prev, like_count: prev.like_count + (prevIsLiked ? -1 : 1) } : null);
    try {
      await supabase.rpc('toggle_gathering_post_like', { post_id_input: postId });
    } catch {
      setIsLiked(prevIsLiked);
      setPost(prev => prev ? { ...prev, like_count: prev.like_count + (prevIsLiked ? 1 : -1) } : null);
    }
  };

  const handleSendComment = async () => {
    if (!commentInput.trim() || !user || !postId) return;
    setIsSendingComment(true);
    try {
      const { data: userData } = await supabase.from('users').select('name, avatar').eq('id', user.id).single();
      const { data: newComment } = await supabase.from('gathering_comments').insert({
        post_id: postId, author_id: user.id, author_name: userData?.name || '익명', author_avatar: userData?.avatar,
        content: commentInput.trim()
      }).select().single();
      
      if (newComment) {
        setComments(prev => [...prev, newComment]);
        setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null);
        setCommentInput('');
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch {
      toast.error('전송 실패');
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleDeletePost = async () => {
    try {
      await supabase.from('gathering_posts').delete().eq('id', postId);
      toast.success('삭제되었습니다');
      navigate(-1);
    } catch { toast.error('삭제 실패'); }
  };

  const executeDeleteComment = async () => {
    if (!commentToDelete) return;
    try {
      await supabase.from('gathering_comments').delete().eq('id', commentToDelete);
      setComments(prev => prev.filter(c => c.id !== commentToDelete));
      setPost(prev => prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : null);
      toast.success('댓글이 삭제되었습니다.');
    } catch { 
        toast.error('삭제 실패'); 
    } finally {
        setCommentToDelete(null); 
    }
  };

  if (isLoading) return <div className="h-screen bg-[#111] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>;
  if (!post) return null;

  const isAuthor = user?.id === post.author_id;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#111] text-[#eee] relative">
      {/* Header */}
      <header className="fixed top-0 w-full h-[52px] flex items-center justify-between px-4 bg-[#111]/80 backdrop-blur-md z-50 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white">
            <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex gap-2">
            <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                className="p-2 text-white"
            >
                <Share2 className="w-5 h-5" />
            </motion.button>
            {isAuthor && (
                <button onClick={() => setShowMenu(true)} className="p-2 -mr-2 text-white">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pt-[52px] pb-[80px]">
        <div className="px-5 pt-6 pb-8">
            <div className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] bg-[#222] text-[#999] text-[11px] font-medium mb-5">
                {post.category}
            </div>

            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#222] overflow-hidden">
                    {post.author_avatar ? (
                        <img src={post.author_avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#555]"><UserIcon className="w-5 h-5" /></div>
                    )}
                </div>
                <div>
                    <div className="text-[14px] font-semibold text-white mb-0.5">{post.author_name}</div>
                    <div className="text-[12px] text-[#666] flex items-center gap-1.5">
                        {getTimeAgo(post.created_at)} 
                        <span className="w-0.5 h-0.5 bg-[#444] rounded-full" /> 
                        조회 {post.view_count}
                    </div>
                </div>
            </div>

            <h1 className="text-[20px] font-bold text-white leading-snug mb-3">{post.title}</h1>
            <p className="text-[15px] text-[#ccc] leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {post.image_urls?.length > 0 && (
                <div className="mt-6 -mx-5 px-5 flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                    {post.image_urls.map((url, i) => (
                        <div key={i} className="flex-shrink-0 w-[240px] h-[240px] rounded-[12px] overflow-hidden bg-[#222]">
                            <img src={url} className="w-full h-full object-cover" alt="" />
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-4 mt-8 text-[13px] text-[#777]">
                <div className="flex items-center gap-1.5">
                    <Heart className={`w-4 h-4 ${isLiked ? 'text-[#FF203A] fill-[#FF203A]' : ''}`} />
                    <span>좋아요 {post.like_count}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4" />
                    <span>댓글 {post.comment_count}</span>
                </div>
            </div>
        </div>

        <div className="h-2 bg-[#0a0a0a]" />

        <div className="px-5 py-6">
            <h3 className="text-[15px] font-bold mb-5 text-white">댓글</h3>
            <div className="space-y-6">
                {comments.length === 0 ? (
                    <p className="text-center text-[#555] py-8 text-[13px]">첫 댓글을 남겨보세요.</p>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#222] overflow-hidden flex-shrink-0 mt-0.5">
                                {comment.author_avatar ? (
                                    <img src={comment.author_avatar} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#555]"><UserIcon className="w-4 h-4" /></div>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] font-semibold text-[#ddd]">{comment.author_name}</span>
                                        <span className="text-[11px] text-[#555]">{getTimeAgo(comment.created_at)}</span>
                                    </div>
                                    {user?.id === comment.author_id && (
                                        <button 
                                            onClick={() => setCommentToDelete(comment.id)} 
                                            className="text-[11px] text-[#555] hover:text-[#FF203A]"
                                        >
                                            삭제
                                        </button>
                                    )}
                                </div>
                                <p className="text-[14px] text-[#bbb] leading-relaxed break-all">{comment.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div ref={commentsEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 w-full bg-[#111] border-t border-white/5 px-4 pt-3 pb-safe z-50">
        <div className="flex items-end gap-2 pb-3">
            <motion.button 
                whileTap={{ scale: 0.9 }} 
                onClick={handleToggleLike}
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#888] hover:bg-[#222] transition-colors"
            >
                <Heart className={`w-6 h-6 ${isLiked ? 'text-[#FF203A] fill-[#FF203A]' : ''}`} />
            </motion.button>
            <div className="flex-1 bg-[#222] rounded-[20px] px-4 py-2.5 flex items-center">
                <input 
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    className="bg-transparent w-full text-[14px] text-white placeholder-[#555] focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSendComment()}
                />
                <button 
                    onClick={handleSendComment} 
                    disabled={!commentInput.trim() || isSendingComment}
                    className={`ml-2 p-1 rounded-full transition-colors ${commentInput.trim() ? 'text-[#FF203A]' : 'text-[#444]'}`}
                >
                    {isSendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
            </div>
        </div>
      </div>

      {/* Author Menu (Bottom Sheet) */}
      <AnimatePresence>
        {showMenu && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowMenu(false)}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-md bg-[#1a1a1a] rounded-t-[20px] p-2 pb-8 overflow-hidden"
                >
                    <div className="w-10 h-1 bg-[#333] rounded-full mx-auto my-3" />
                    
                    {/* 수정 버튼 추가 */}
                    <button 
                        onClick={() => { setShowMenu(false); navigate(`/gathering/edit/${postId}`); }}
                        className="w-full p-4 flex items-center gap-3 text-white hover:bg-[#222] rounded-xl transition-colors"
                    >
                        <Edit2 className="w-5 h-5 text-[#888]" />
                        <span className="text-[15px] font-medium">게시글 수정</span>
                    </button>

                    <button 
                        onClick={() => { setShowMenu(false); setShowDeletePostModal(true); }}
                        className="w-full p-4 flex items-center gap-3 text-[#FF203A] hover:bg-[#222] rounded-xl transition-colors"
                    >
                        <Trash2 className="w-5 h-5" />
                        <span className="text-[15px] font-medium">게시글 삭제</span>
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Post Delete Modal */}
      <AnimatePresence>
        {showDeletePostModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={() => setShowDeletePostModal(false)}
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-[280px] bg-[#1a1a1a] rounded-[18px] overflow-hidden text-center"
                >
                    <div className="p-6">
                        <div className="w-12 h-12 bg-[#FF203A]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#FF203A]">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-2">게시글 삭제</h3>
                        <p className="text-[13px] text-[#888] leading-relaxed">
                            정말로 삭제하시겠습니까?<br/>삭제 후에는 복구할 수 없습니다.
                        </p>
                    </div>
                    <div className="flex border-t border-[#333]">
                        <button onClick={() => setShowDeletePostModal(false)} className="flex-1 py-3.5 text-[14px] text-[#888] font-medium active:bg-[#222]">취소</button>
                        <div className="w-[1px] bg-[#333]" />
                        <button onClick={handleDeletePost} className="flex-1 py-3.5 text-[14px] text-[#FF203A] font-medium active:bg-[#222]">삭제</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Comment Delete Modal */}
      <AnimatePresence>
        {commentToDelete && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={() => setCommentToDelete(null)}
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-[280px] bg-[#1a1a1a] rounded-[18px] overflow-hidden text-center"
                >
                    <div className="p-6">
                        <div className="w-12 h-12 bg-[#FF203A]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#FF203A]">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-2">댓글 삭제</h3>
                        <p className="text-[13px] text-[#888] leading-relaxed">
                            이 댓글을 삭제하시겠습니까?
                        </p>
                    </div>
                    <div className="flex border-t border-[#333]">
                        <button onClick={() => setCommentToDelete(null)} className="flex-1 py-3.5 text-[14px] text-[#888] font-medium active:bg-[#222]">취소</button>
                        <div className="w-[1px] bg-[#333]" />
                        <button onClick={executeDeleteComment} className="flex-1 py-3.5 text-[14px] text-[#FF203A] font-medium active:bg-[#222]">삭제</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}